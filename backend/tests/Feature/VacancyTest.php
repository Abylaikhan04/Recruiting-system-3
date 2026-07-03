<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vacancy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VacancyTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_vacancies(): void
    {
        $this->getJson('/api/vacancies')->assertStatus(401);
    }

    public function test_authenticated_user_can_list_vacancies(): void
    {
        $user = User::factory()->create();
        Vacancy::factory()->count(3)->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/vacancies')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_recruiter_can_create_a_vacancy(): void
    {
        $recruiter = User::factory()->create();
        Sanctum::actingAs($recruiter);

        $response = $this->postJson('/api/vacancies', [
            'title' => 'Backend Developer',
            'city' => 'Astana',
            'status' => 'open',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('title', 'Backend Developer')
            ->assertJsonPath('recruiter_id', $recruiter->id);

        $this->assertDatabaseHas('vacancies', [
            'title' => 'Backend Developer',
            'recruiter_id' => $recruiter->id,
        ]);
    }

    public function test_creating_vacancy_requires_title(): void
    {
        $recruiter = User::factory()->create();
        Sanctum::actingAs($recruiter);

        $this->postJson('/api/vacancies', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_owner_can_update_own_vacancy(): void
    {
        $owner = User::factory()->create();
        $vacancy = Vacancy::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($owner);

        $this->putJson("/api/vacancies/{$vacancy->id}", ['title' => 'Updated Title'])
            ->assertStatus(200)
            ->assertJsonPath('title', 'Updated Title');
    }

    public function test_recruiter_cannot_update_another_recruiters_vacancy(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $vacancy = Vacancy::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($intruder);

        $this->putJson("/api/vacancies/{$vacancy->id}", ['title' => 'Hacked'])
            ->assertStatus(403);

        $this->assertDatabaseMissing('vacancies', ['id' => $vacancy->id, 'title' => 'Hacked']);
    }

    public function test_admin_can_update_any_vacancy(): void
    {
        $admin = User::factory()->admin()->create();
        $owner = User::factory()->create();
        $vacancy = Vacancy::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/vacancies/{$vacancy->id}", ['title' => 'Updated By Admin'])
            ->assertStatus(200)
            ->assertJsonPath('title', 'Updated By Admin');
    }

    public function test_recruiter_cannot_delete_another_recruiters_vacancy(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $vacancy = Vacancy::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($intruder);

        $this->deleteJson("/api/vacancies/{$vacancy->id}")->assertStatus(403);
        $this->assertDatabaseHas('vacancies', ['id' => $vacancy->id]);
    }

    public function test_owner_can_delete_own_vacancy(): void
    {
        $owner = User::factory()->create();
        $vacancy = Vacancy::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($owner);

        $this->deleteJson("/api/vacancies/{$vacancy->id}")->assertStatus(200);
        $this->assertSoftDeleted('vacancies', ['id' => $vacancy->id]);
    }
}
