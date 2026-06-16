<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateNote extends Model
{
    protected $fillable = ['candidate_id', 'user_id', 'type', 'direction', 'body'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
