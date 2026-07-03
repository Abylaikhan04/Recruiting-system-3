<?php

namespace Database\Factories;

use App\Models\Candidate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Candidate>
 */
class CandidateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'full_name' => fake()->name(),
            'phone' => fake()->phoneNumber(),
            'email' => fake()->safeEmail(),
            'organization' => 'Alina Group',
            'city' => fake()->city(),
            'department' => null,
            'position' => fake()->jobTitle(),
            'source' => fake()->randomElement(['hh.kz', 'OLX', 'referral', 'manual']),
            'stage' => 'new',
            'status' => 'active',
            'comment' => null,
            'resume_text' => null,
            'vacancy_id' => null,
            'recruiter_id' => null,
        ];
    }
}
