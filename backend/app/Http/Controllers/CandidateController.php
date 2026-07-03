<?php

namespace App\Http\Controllers;

use App\Models\AiAnalysis;
use App\Models\Candidate;
use App\Models\CandidateHistory;
use App\Services\AiService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser as PdfParser;

class CandidateController extends Controller
{
    /**
     * Max resume file size in kilobytes (10 MB).
     */
    private const MAX_RESUME_KB = 10240;

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Candidate::query()
            ->with(['recruiter:id,name', 'vacancy:id,title', 'latestAnalysis']);

        // Recruiters see only their own; admins see all (can filter by recruiter)
        if (! $user->isAdmin()) {
            $query->where('recruiter_id', $user->id);
        } elseif ($request->filled('recruiter_id')) {
            $query->where('recruiter_id', $request->integer('recruiter_id'));
        }

        if ($request->filled('search')) {
            $s = $request->string('search');
            $query->where(function ($q) use ($s) {
                $q->where('full_name', 'ilike', "%$s%")
                    ->orWhere('phone', 'ilike', "%$s%")
                    ->orWhere('position', 'ilike', "%$s%");
            });
        }

        foreach (['stage', 'status', 'city', 'department', 'source', 'vacancy_id'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }

        $sort = $request->input('sort', 'created_at');
        $dir = $request->input('dir', 'desc');
        $query->orderBy(in_array($sort, ['full_name', 'position', 'stage', 'status', 'city', 'created_at']) ? $sort : 'created_at', $dir === 'asc' ? 'asc' : 'desc');

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function show(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        return response()->json(
            $candidate->load([
                'recruiter:id,name',
                'vacancy:id,title',
                'notes.user:id,name',
                'history.user:id,name',
                'analyses',
            ])
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'organization' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'department' => ['nullable', 'string'],
            'position' => ['required', 'string'],
            'source' => ['nullable', 'string'],
            'stage' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'comment' => ['nullable', 'string'],
            'resume_text' => ['nullable', 'string'],
            'resume_url' => ['nullable', 'string'],
            'vacancy_id' => ['nullable', 'exists:vacancies,id'],
        ]);

        $data['recruiter_id'] = $request->user()->id;
        $candidate = Candidate::create($data);

        return response()->json($candidate, 201);
    }

    public function update(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'organization' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'department' => ['nullable', 'string'],
            'position' => ['sometimes', 'string'],
            'source' => ['nullable', 'string'],
            'stage' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'rejection_reason' => ['nullable', 'string'],
            'comment' => ['nullable', 'string'],
            'resume_text' => ['nullable', 'string'],
            'resume_url' => ['nullable', 'string'],
            'vacancy_id' => ['nullable', 'exists:vacancies,id'],
            'recruiter_id' => ['nullable', 'exists:users,id'],
        ]);

        // Track history for key fields
        foreach (['stage', 'status', 'position', 'city', 'department', 'recruiter_id'] as $field) {
            if (array_key_exists($field, $data) && $candidate->$field != $data[$field]) {
                CandidateHistory::create([
                    'candidate_id' => $candidate->id,
                    'user_id' => $request->user()->id,
                    'field' => $field,
                    'from_value' => (string) $candidate->$field,
                    'to_value' => (string) $data[$field],
                ]);
            }
        }

        // Auto-sync status with stage (funnel)
        if (isset($data['stage'])) {
            $map = [
                'hired' => 'hired',
                'rejected' => 'rejected',
                'phone' => 'interview', 'tech' => 'interview', 'final' => 'interview',
            ];
            $data['status'] = $data['status'] ?? ($map[$data['stage']] ?? 'active');
        }

        $candidate->update($data);

        return response()->json($candidate->fresh(['history.user:id,name']));
    }

    public function destroy(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        $candidate->delete();

        return response()->json(['message' => 'Удалено']);
    }

    /**
     * Bulk import candidates: PDF resumes (text), HH/other URLs, or manual rows.
     * Accepts an array of items. Each item creates a candidate.
     */
    public function bulkImport(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.full_name' => ['required', 'string'],
            'items.*.position' => ['required', 'string'],
            'items.*.phone' => ['nullable', 'string'],
            'items.*.city' => ['nullable', 'string'],
            'items.*.source' => ['nullable', 'string'],
            'items.*.resume_text' => ['nullable', 'string'],
            'items.*.resume_url' => ['nullable', 'string'],
            'items.*.vacancy_id' => ['nullable', 'integer'],
        ]);

        $created = [];
        foreach ($data['items'] as $item) {
            $item['recruiter_id'] = $request->user()->id;
            $item['organization'] = $item['organization'] ?? 'Alina Group';
            $created[] = Candidate::create($item);
        }

        return response()->json([
            'message' => 'Импортировано: '.count($created),
            'count' => count($created),
            'candidates' => $created,
        ], 201);
    }

    /**
     * Export candidates to CSV: either a specific list of ids, or the current
     * filter set (same filters as index()). Respects owner scoping.
     */
    public function bulkExport(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'ids' => ['nullable', 'array'],
            'ids.*' => ['integer'],
        ]);

        $query = Candidate::query()->with(['recruiter:id,name']);

        if (! $user->isAdmin()) {
            $query->where('recruiter_id', $user->id);
        } elseif ($request->filled('recruiter_id')) {
            $query->where('recruiter_id', $request->integer('recruiter_id'));
        }

        if (! empty($data['ids'])) {
            $query->whereIn('id', $data['ids']);
        } else {
            if ($request->filled('search')) {
                $s = $request->string('search');
                $query->where(function ($q) use ($s) {
                    $q->where('full_name', 'ilike', "%$s%")
                        ->orWhere('phone', 'ilike', "%$s%")
                        ->orWhere('position', 'ilike', "%$s%");
                });
            }
            foreach (['stage', 'status', 'city', 'department', 'source', 'vacancy_id'] as $f) {
                if ($request->filled($f)) {
                    $query->where($f, $request->input($f));
                }
            }
        }

        $candidates = $query->orderBy('created_at', 'desc')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="candidates_export.csv"',
        ];

        return response()->streamDownload(function () use ($candidates) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
            fputcsv($out, ['ФИО', 'Телефон', 'Email', 'Город', 'Должность', 'Источник', 'Этап', 'Статус', 'Рекрутер']);
            foreach ($candidates as $c) {
                fputcsv($out, [
                    $c->full_name, $c->phone, $c->email, $c->city, $c->position,
                    $c->source, $c->stage, $c->status, $c->recruiter?->name,
                ]);
            }
            fclose($out);
        }, 'candidates_export.csv', $headers);
    }

    /**
     * Bulk-reassign the recruiter of multiple candidates. Admin only.
     */
    public function bulkAssignRecruiter(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:candidates,id'],
            'recruiter_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $candidates = Candidate::whereIn('id', $data['ids'])->get();

        foreach ($candidates as $c) {
            if ($c->recruiter_id != $data['recruiter_id']) {
                CandidateHistory::create([
                    'candidate_id' => $c->id,
                    'user_id' => $request->user()->id,
                    'field' => 'recruiter_id',
                    'from_value' => (string) $c->recruiter_id,
                    'to_value' => (string) $data['recruiter_id'],
                ]);
                $c->update(['recruiter_id' => $data['recruiter_id']]);
            }
        }

        return response()->json([
            'message' => 'Рекрутер назначен для: '.$candidates->count(),
            'count' => $candidates->count(),
        ]);
    }

    /**
     * Bulk-update stage/status of multiple candidates. Recruiters can only
     * update their own candidates; ids they don't own are silently skipped.
     */
    public function bulkStatusUpdate(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:candidates,id'],
            'stage' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        if (! isset($data['stage']) && ! isset($data['status'])) {
            throw ValidationException::withMessages(['stage' => 'Укажите stage или status']);
        }

        $query = Candidate::whereIn('id', $data['ids']);
        if (! $user->isAdmin()) {
            $query->where('recruiter_id', $user->id);
        }
        $candidates = $query->get();

        $map = [
            'hired' => 'hired',
            'rejected' => 'rejected',
            'phone' => 'interview', 'tech' => 'interview', 'final' => 'interview',
        ];

        foreach ($candidates as $c) {
            $update = [];
            if (isset($data['stage'])) {
                $update['stage'] = $data['stage'];
                $update['status'] = $data['status'] ?? ($map[$data['stage']] ?? 'active');
            } elseif (isset($data['status'])) {
                $update['status'] = $data['status'];
            }

            foreach (['stage', 'status'] as $field) {
                if (isset($update[$field]) && $c->$field != $update[$field]) {
                    CandidateHistory::create([
                        'candidate_id' => $c->id,
                        'user_id' => $user->id,
                        'field' => $field,
                        'from_value' => (string) $c->$field,
                        'to_value' => (string) $update[$field],
                    ]);
                }
            }

            $c->update($update);
        }

        $skipped = count($data['ids']) - $candidates->count();

        return response()->json([
            'message' => 'Обновлено: '.$candidates->count().($skipped > 0 ? ", пропущено (не ваши): $skipped" : ''),
            'count' => $candidates->count(),
            'skipped' => $skipped,
        ]);
    }

    /**
     * Run AI analysis. Costs "1 token" conceptually. Re-runnable any time.
     */
    public function analyze(Request $request, Candidate $candidate, AiService $ai)
    {
        $result = $ai->analyzeCandidate($candidate);

        $analysis = AiAnalysis::create([
            'candidate_id' => $candidate->id,
            'score' => $result['score'],
            'strengths' => $result['strengths'],
            'risks' => $result['risks'],
            'questions' => $result['questions'],
            'summary' => $result['summary'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json($analysis, 201);
    }

    /**
     * Analyze first N candidates in bulk (e.g. first 50/100).
     */
    public function analyzeBatch(Request $request, AiService $ai)
    {
        $request->validate(['limit' => ['required', 'integer', 'min:1', 'max:500']]);

        $user = $request->user();
        $query = Candidate::query()->doesntHave('analyses');
        if (! $user->isAdmin()) {
            $query->where('recruiter_id', $user->id);
        }

        $candidates = $query->orderBy('created_at')->limit($request->integer('limit'))->get();

        foreach ($candidates as $candidate) {
            $result = $ai->analyzeCandidate($candidate);
            AiAnalysis::create([
                'candidate_id' => $candidate->id,
                'score' => $result['score'],
                'strengths' => $result['strengths'],
                'risks' => $result['risks'],
                'questions' => $result['questions'],
                'summary' => $result['summary'],
                'created_by' => $user->id,
            ]);
        }

        return response()->json([
            'message' => 'Проанализировано: '.$candidates->count(),
            'count' => $candidates->count(),
        ]);
    }

    /**
     * Upload a candidate's resume as a PDF file: stores it in private storage
     * (fills resume_path) and extracts its text (fills resume_text).
     */
    public function uploadResume(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        $request->validate([
            'resume' => ['required', 'file', 'mimes:pdf', 'max:'.self::MAX_RESUME_KB],
        ]);

        $file = $request->file('resume');
        $path = $file->store('resumes', 'local');

        $text = $this->extractPdfText($file->getRealPath());

        $candidate->update([
            'resume_path' => $path,
            'resume_text' => $text !== '' ? $text : $candidate->resume_text,
        ]);

        return response()->json($candidate->fresh());
    }

    /**
     * Generic PDF-to-text extraction from a base64-encoded payload.
     * Used by resume/bulk-import upload widgets that don't have a candidate yet.
     */
    public function parsePdf(Request $request)
    {
        $request->validate([
            'pdf_base64' => ['required', 'string'],
        ]);

        $binary = base64_decode($request->input('pdf_base64'), true);

        if ($binary === false || $binary === '') {
            throw ValidationException::withMessages(['pdf_base64' => 'Некорректные base64-данные файла']);
        }

        if (strlen($binary) > self::MAX_RESUME_KB * 1024) {
            throw ValidationException::withMessages(['pdf_base64' => 'Файл слишком большой (максимум 10MB)']);
        }

        if (! str_starts_with($binary, '%PDF')) {
            throw ValidationException::withMessages(['pdf_base64' => 'Файл не является PDF']);
        }

        $tmpPath = tempnam(sys_get_temp_dir(), 'resume_');
        file_put_contents($tmpPath, $binary);

        try {
            $text = $this->extractPdfText($tmpPath);
        } finally {
            @unlink($tmpPath);
        }

        return response()->json(['text' => $text]);
    }

    private function extractPdfText(string $path): string
    {
        try {
            $parser = new PdfParser;
            $pdf = $parser->parseFile($path);

            return trim($pdf->getText());
        } catch (\Throwable $e) {
            report($e);

            return '';
        }
    }
}
