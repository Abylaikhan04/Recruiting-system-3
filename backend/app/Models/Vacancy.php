<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vacancy extends Model
{
    protected $fillable = [
        'title', 'department_id', 'city', 'position', 'salary_range', 'description',
        'requirements', 'status', 'hiring_request_id', 'recruiter_id',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function recruiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recruiter_id');
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }
}
