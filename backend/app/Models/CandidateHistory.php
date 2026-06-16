<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateHistory extends Model
{
    protected $table = 'candidate_history';

    protected $fillable = ['candidate_id', 'user_id', 'field', 'from_value', 'to_value'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
