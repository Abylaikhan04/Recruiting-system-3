<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HiringRequest extends Model
{
    protected $fillable = [
        'title', 'department_id', 'city', 'position', 'headcount', 'description',
        'requirements', 'salary_range', 'priority', 'status', 'requested_by',
        'assigned_recruiter_id',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function recruiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_recruiter_id');
    }
}
