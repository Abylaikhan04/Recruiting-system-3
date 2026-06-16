<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Candidate extends Model
{
    protected $fillable = [
        'full_name', 'phone', 'email', 'organization', 'city', 'department',
        'position', 'source', 'stage', 'status', 'rejection_reason', 'comment',
        'resume_text', 'resume_path', 'resume_url', 'vacancy_id', 'recruiter_id',
    ];

    public function vacancy(): BelongsTo
    {
        return $this->belongsTo(Vacancy::class);
    }

    public function recruiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recruiter_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(CandidateNote::class)->latest();
    }

    public function history(): HasMany
    {
        return $this->hasMany(CandidateHistory::class)->latest();
    }

    public function latestAnalysis(): HasOne
    {
        return $this->hasOne(AiAnalysis::class)->latestOfMany();
    }

    public function analyses(): HasMany
    {
        return $this->hasMany(AiAnalysis::class)->latest();
    }
}
