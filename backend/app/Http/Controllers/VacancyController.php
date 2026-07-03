<?php

namespace App\Http\Controllers;

use App\Models\Vacancy;
use Illuminate\Http\Request;

class VacancyController extends Controller
{
    public function index(Request $request)
    {
        $query = Vacancy::query()->with(['department:id,name', 'recruiter:id,name'])
            ->withCount('candidates');

        foreach (['status', 'city', 'department_id'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }
        if ($request->filled('search')) {
            $query->where('title', 'ilike', '%'.$request->string('search').'%');
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'city' => ['nullable', 'string'],
            'position' => ['nullable', 'string'],
            'salary_range' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'status' => ['nullable', 'in:open,paused,closed'],
            'hiring_request_id' => ['nullable', 'exists:hiring_requests,id'],
        ]);
        $data['recruiter_id'] = $request->user()->id;

        return response()->json(Vacancy::create($data), 201);
    }

    public function update(Request $request, Vacancy $vacancy)
    {
        abort_unless($request->user()->isAdmin() || $vacancy->recruiter_id === $request->user()->id, 403);

        $data = $request->validate([
            'title' => ['sometimes', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'city' => ['nullable', 'string'],
            'position' => ['nullable', 'string'],
            'salary_range' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'status' => ['nullable', 'in:open,paused,closed'],
            'recruiter_id' => ['nullable', 'exists:users,id'],
        ]);
        $vacancy->update($data);

        return response()->json($vacancy->fresh());
    }

    public function destroy(Request $request, Vacancy $vacancy)
    {
        abort_unless($request->user()->isAdmin() || $vacancy->recruiter_id === $request->user()->id, 403);

        $vacancy->delete();

        return response()->json(['message' => 'Удалено']);
    }
}
