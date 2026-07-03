<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\CandidateNote;
use Illuminate\Http\Request;

class CandidateNoteController extends Controller
{
    public function index(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        return response()->json(
            $candidate->notes()->with('user:id,name')->orderBy('created_at')->get()
        );
    }

    public function store(Request $request, Candidate $candidate)
    {
        abort_unless($request->user()->isAdmin() || $candidate->recruiter_id === $request->user()->id, 403);

        $data = $request->validate([
            'type' => ['nullable', 'in:note,whatsapp'],
            'direction' => ['nullable', 'in:in,out'],
            'body' => ['required', 'string'],
        ]);

        $note = CandidateNote::create([
            'candidate_id' => $candidate->id,
            'user_id' => $request->user()->id,
            'type' => $data['type'] ?? 'note',
            'direction' => $data['direction'] ?? null,
            'body' => $data['body'],
        ]);

        return response()->json($note->load('user:id,name'), 201);
    }
}
