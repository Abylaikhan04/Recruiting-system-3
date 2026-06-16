<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiAnalysis extends Model
{
    protected $fillable = [
        'candidate_id', 'score', 'strengths', 'risks', 'questions', 'summary', 'created_by',
    ];

    protected $casts = [
        'strengths' => 'array',
        'risks' => 'array',
        'questions' => 'array',
    ];
}
