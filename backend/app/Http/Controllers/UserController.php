<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('department:id,name');
        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        return response()->json($query->get(['id', 'name', 'email', 'role', 'position', 'phone', 'department_id']));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,recruiter,manager'],
            'position' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
        ]);
        $data['password'] = Hash::make($data['password']);

        return response()->json(User::create($data), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['sometimes', 'in:admin,recruiter,manager'],
            'position' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
        ]);
        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $user->update($data);

        return response()->json($user->fresh());
    }

    public function profile(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$request->user()->id],
            'phone' => ['nullable', 'string'],
            'position' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:6'],
        ]);
        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $request->user()->update($data);

        return response()->json($request->user()->fresh());
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'Удалено']);
    }

    public function departments()
    {
        return response()->json(Department::orderBy('name')->get());
    }
}
