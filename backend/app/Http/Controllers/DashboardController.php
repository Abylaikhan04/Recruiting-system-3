<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\HiringRequest;
use App\Models\Meeting;
use App\Models\Vacancy;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $candidateQuery = Candidate::query();
        if (! $isAdmin) {
            $candidateQuery->where('recruiter_id', $user->id);
        }

        $today = now()->startOfDay();
        $endToday = now()->endOfDay();

        $meetingQuery = Meeting::query()->with('candidate');
        if (! $isAdmin) {
            $meetingQuery->where('user_id', $user->id);
        }

        $interviewsToday = (clone $candidateQuery)
            ->whereIn('stage', ['phone', 'tech', 'final'])
            ->whereBetween('updated_at', [$today, $endToday])
            ->count();

        $hiredThisMonth = (clone $candidateQuery)
            ->where('stage', 'hired')
            ->whereBetween('updated_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        return response()->json([
            'metrics' => [
                'open_vacancies' => Vacancy::where('status', 'open')->count(),
                'candidates' => (clone $candidateQuery)->count(),
                'interviews_today' => $interviewsToday,
                'hired_this_month' => $hiredThisMonth,
                'pending_requests' => HiringRequest::where('status', 'pending')->count(),
            ],
            'upcoming_meetings' => (clone $meetingQuery)
                ->where('starts_at', '>=', now())
                ->orderBy('starts_at')
                ->limit(8)
                ->get(),
            'recent_candidates' => (clone $candidateQuery)
                ->latest('updated_at')
                ->limit(8)
                ->get(['id', 'full_name', 'position', 'stage', 'status', 'city', 'updated_at']),
        ]);
    }
}
