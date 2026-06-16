<?php

namespace App\Http\Controllers;

use App\Models\AiAnalysis;
use App\Models\Candidate;
use App\Models\CandidateHistory;
use App\Services\AiService;
use Illuminate\Http\Request;

class CandidateController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Candidate::query()
            ->with(['recruiter:id,name', 'vacancy:id,title', 'latestAnalysis:id,candidate_id,score']);

        // Recruiters see only their own; admins see all (can filter by recruiter)
        if (! $user->isAdmin()) {
            $query->where('recruiter_id', $user->id);
        } elseif ($request->filled('recruiter_id')) {
            $query->where('recruiter_id', $request->integer('recruiter_id'));
        }

        if ($request->filled('search')) {
            $s = $request->string('search');
            $query->where(function ($q) use ($s) {
                $q->where('full_name', 'like', "%$s%")
                    ->orWhere('phone', 'like', "%$s%")
                    ->orWhere('position', 'like', "%$s%");
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

    public function show(Candidate $candidate)
    {
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

    public function destroy(Candidate $candidate)
    {
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
}
