<?php

namespace Database\Factories;

use App\Models\Vacancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vacancy>
 */
class VacancyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->jobTitle(),
            'department_id' => null,
            'city' => fake()->city(),
            'position' => fake()->jobTitle(),
            'salary_range' => '300000-500000',
            'description' => fake()->paragraph(),
            'requirements' => fake()->paragraph(),
            'status' => 'open',
            'hiring_request_id' => null,
            'recruiter_id' => null,
        ];
    }
}
