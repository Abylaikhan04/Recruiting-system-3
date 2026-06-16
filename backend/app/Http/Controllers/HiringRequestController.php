<?php

namespace App\Http\Controllers;

use App\Models\HiringRequest;
use App\Models\Vacancy;
use Illuminate\Http\Request;

class HiringRequestController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = HiringRequest::query()
            ->with(['department:id,name', 'requester:id,name', 'recruiter:id,name']);

        // Managers see their own requests; recruiters/admins see all
        if ($user->role === 'manager') {
            $query->where('requested_by', $user->id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'city' => ['nullable', 'string'],
            'position' => ['required', 'string'],
            'headcount' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'salary_range' => ['nullable', 'string'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ]);
        $data['requested_by'] = $request->user()->id;
        $data['status'] = 'pending';

        return response()->json(HiringRequest::create($data), 201);
    }

    public function update(Request $request, HiringRequest $hiringRequest)
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,in_progress,closed'],
            'assigned_recruiter_id' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'headcount' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'salary_range' => ['nullable', 'string'],
        ]);

        $hiringRequest->update($data);

        // When approved -> auto-create an open vacancy
        if (($data['status'] ?? null) === 'approved') {
            Vacancy::firstOrCreate(
                ['hiring_request_id' => $hiringRequest->id],
                [
                    'title' => $hiringRequest->title,
                    'department_id' => $hiringRequest->department_id,
                    'city' => $hiringRequest->city,
                    'position' => $hiringRequest->position,
                    'salary_range' => $hiringRequest->salary_range,
                    'description' => $hiringRequest->description,
                    'requirements' => $hiringRequest->requirements,
                    'status' => 'open',
                    'recruiter_id' => $hiringRequest->assigned_recruiter_id,
                ]
            );
        }

        return response()->json($hiringRequest->fresh(['department:id,name', 'requester:id,name', 'recruiter:id,name']));
    }

    public function destroy(HiringRequest $hiringRequest)
    {
        $hiringRequest->delete();

        return response()->json(['message' => 'Удалено']);
    }
}
