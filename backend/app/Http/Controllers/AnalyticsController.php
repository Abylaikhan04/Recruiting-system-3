<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Apply the optional date_from/date_to filters (on candidates.created_at)
     * to the given query builder/closure.
     */
    private function applyDateRange($query, Request $request, string $column = 'created_at')
    {
        if ($request->filled('date_from')) {
            $query->whereDate($column, '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate($column, '<=', $request->date('date_to'));
        }

        return $query;
    }

    private function buildReport(Request $request): array
    {
        $stages = ['new', 'screening', 'phone', 'tech', 'final', 'offer', 'hired', 'rejected'];

        $funnel = [];
        foreach ($stages as $stage) {
            $q = Candidate::where('stage', $stage);
            $this->applyDateRange($q, $request);
            $funnel[$stage] = $q->count();
        }

        $bySourceQuery = Candidate::select('source', DB::raw('count(*) as total'))
            ->whereNotNull('source');
        $this->applyDateRange($bySourceQuery, $request);
        $bySource = $bySourceQuery->groupBy('source')->pluck('total', 'source');

        $byCityQuery = Candidate::select('city', DB::raw('count(*) as total'))
            ->whereNotNull('city');
        $this->applyDateRange($byCityQuery, $request);
        $byCity = $byCityQuery->groupBy('city')->pluck('total', 'city');

        $recruiters = User::where('role', 'recruiter')
            ->withCount([
                'candidates' => fn ($q) => $this->applyDateRange($q, $request),
                'candidates as hired_count' => fn ($q) => $this->applyDateRange($q->where('stage', 'hired'), $request),
            ])
            ->get(['id', 'name'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'candidates' => $u->candidates_count,
                'hired' => $u->hired_count,
                'conversion' => $u->candidates_count > 0
                    ? round($u->hired_count / $u->candidates_count * 100, 1)
                    : 0,
            ]);

        $totalQuery = Candidate::query();
        $this->applyDateRange($totalQuery, $request);
        $total = $totalQuery->count();

        $hiredQuery = Candidate::where('stage', 'hired');
        $this->applyDateRange($hiredQuery, $request);
        $hired = $hiredQuery->count();

        return [
            'funnel' => $funnel,
            'by_source' => $bySource,
            'by_city' => $byCity,
            'recruiters' => $recruiters,
            'conversion' => $total > 0 ? round($hired / $total * 100, 1) : 0,
            'total_candidates' => $total,
            'total_hired' => $hired,
        ];
    }

    public function index(Request $request)
    {
        return response()->json($this->buildReport($request));
    }

    /**
     * Export the currently viewed report to CSV. `report` selects which
     * table is exported: funnel | source | city | recruiters (default funnel).
     * Respects the same date_from/date_to filters as index().
     */
    public function export(Request $request)
    {
        $request->validate([
            'report' => ['nullable', 'in:funnel,source,city,recruiters'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $report = $request->input('report', 'funnel');
        $data = $this->buildReport($request);

        $stageLabels = [
            'new' => 'Новый', 'screening' => 'Скрининг', 'phone' => 'Телефонное интервью',
            'tech' => 'Тех. интервью', 'final' => 'Финал', 'offer' => 'Оффер',
            'hired' => 'Нанят', 'rejected' => 'Отказ',
        ];

        $filename = "analytics_{$report}.csv";
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        return response()->streamDownload(function () use ($report, $data, $stageLabels) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel

            switch ($report) {
                case 'source':
                    fputcsv($out, ['Источник', 'Кандидатов']);
                    foreach ($data['by_source'] as $source => $count) {
                        fputcsv($out, [$source, $count]);
                    }
                    break;

                case 'city':
                    fputcsv($out, ['Город', 'Кандидатов']);
                    foreach ($data['by_city'] as $city => $count) {
                        fputcsv($out, [$city, $count]);
                    }
                    break;

                case 'recruiters':
                    fputcsv($out, ['Рекрутер', 'Кандидатов', 'Нанято', 'Конверсия, %']);
                    foreach ($data['recruiters'] as $r) {
                        fputcsv($out, [$r['name'], $r['candidates'], $r['hired'], $r['conversion']]);
                    }
                    break;

                case 'funnel':
                default:
                    fputcsv($out, ['Этап', 'Кандидатов']);
                    foreach ($data['funnel'] as $stage => $count) {
                        fputcsv($out, [$stageLabels[$stage] ?? $stage, $count]);
                    }
                    break;
            }

            fclose($out);
        }, $filename, $headers);
    }
}
