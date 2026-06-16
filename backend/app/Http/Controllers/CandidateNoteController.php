<?php

namespace App\Http\Controllers;

use App\Models\CandidateNote;
use Illuminate\Http\Request;

class CandidateNoteController extends Controller
{
    public function store(Request $request, int $candidate)
    {
        $data = $request->validate([
            'type' => ['nullable', 'in:note,whatsapp'],
            'direction' => ['nullable', 'in:in,out'],
            'body' => ['required', 'string'],
        ]);

        $note = CandidateNote::create([
            'candidate_id' => $candidate,
            'user_id' => $request->user()->id,
            'type' => $data['type'] ?? 'note',
            'direction' => $data['direction'] ?? null,
            'body' => $data['body'],
        ]);

        return response()->json($note->load('user:id,name'), 201);
    }
}
