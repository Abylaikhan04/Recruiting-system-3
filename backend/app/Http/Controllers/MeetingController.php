<?php

namespace App\Http\Controllers;

use App\Models\Meeting;
use Illuminate\Http\Request;

class MeetingController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Meeting::query()->with('candidate:id,full_name');
        if (! $user->isAdmin()) {
            $query->where('user_id', $user->id);
        }
        if ($request->boolean('upcoming')) {
            $query->where('starts_at', '>=', now());
        }

        return response()->json($query->orderBy('starts_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
            'starts_at' => ['required', 'date'],
            'duration_min' => ['nullable', 'integer', 'min:5'],
            'location' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'candidate_id' => ['nullable', 'exists:candidates,id'],
        ]);
        $data['user_id'] = $request->user()->id;

        return response()->json(Meeting::create($data), 201);
    }

    public function update(Request $request, Meeting $meeting)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string'],
            'starts_at' => ['sometimes', 'date'],
            'duration_min' => ['nullable', 'integer', 'min:5'],
            'location' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'candidate_id' => ['nullable', 'exists:candidates,id'],
        ]);
        $meeting->update($data);

        return response()->json($meeting->fresh());
    }

    public function destroy(Meeting $meeting)
    {
        $meeting->delete();

        return response()->json(['message' => 'Удалено']);
    }
}
