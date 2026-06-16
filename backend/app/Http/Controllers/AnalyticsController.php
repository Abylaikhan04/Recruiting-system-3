<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $stages = ['new', 'screening', 'phone', 'tech', 'final', 'offer', 'hired', 'rejected'];

        $funnel = [];
        foreach ($stages as $stage) {
            $funnel[$stage] = Candidate::where('stage', $stage)->count();
        }

        $bySource = Candidate::select('source', DB::raw('count(*) as total'))
            ->whereNotNull('source')
            ->groupBy('source')
            ->pluck('total', 'source');

        $byCity = Candidate::select('city', DB::raw('count(*) as total'))
            ->whereNotNull('city')
            ->groupBy('city')
            ->pluck('total', 'city');

        $recruiters = User::where('role', 'recruiter')
            ->withCount([
                'candidates',
                'candidates as hired_count' => fn ($q) => $q->where('stage', 'hired'),
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

        $total = Candidate::count();
        $hired = Candidate::where('stage', 'hired')->count();

        return response()->json([
            'funnel' => $funnel,
            'by_source' => $bySource,
            'by_city' => $byCity,
            'recruiters' => $recruiters,
            'conversion' => $total > 0 ? round($hired / $total * 100, 1) : 0,
            'total_candidates' => $total,
            'total_hired' => $hired,
        ]);
    }
}
