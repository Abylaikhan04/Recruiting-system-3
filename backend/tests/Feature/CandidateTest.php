<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidateTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_candidates(): void
    {
        $this->getJson('/api/candidates')->assertStatus(401);
    }

    public function test_recruiter_can_create_a_candidate(): void
    {
        $recruiter = User::factory()->create();
        Sanctum::actingAs($recruiter);

        $response = $this->postJson('/api/candidates', [
            'full_name' => 'Иван Иванов',
            'position' => 'PHP Developer',
            'city' => 'Almaty',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('full_name', 'Иван Иванов')
            ->assertJsonPath('recruiter_id', $recruiter->id);

        $this->assertDatabaseHas('candidates', [
            'full_name' => 'Иван Иванов',
            'recruiter_id' => $recruiter->id,
        ]);
    }

    public function test_creating_candidate_requires_full_name_and_position(): void
    {
        $recruiter = User::factory()->create();
        Sanctum::actingAs($recruiter);

        $this->postJson('/api/candidates', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['full_name', 'position']);
    }

    public function test_recruiter_sees_only_own_candidates_in_index(): void
    {
        $recruiterA = User::factory()->create();
        $recruiterB = User::factory()->create();

        Candidate::factory()->create(['recruiter_id' => $recruiterA->id, 'full_name' => 'Own Candidate']);
        Candidate::factory()->create(['recruiter_id' => $recruiterB->id, 'full_name' => 'Other Candidate']);

        Sanctum::actingAs($recruiterA);

        $response = $this->getJson('/api/candidates')->assertStatus(200);

        $names = collect($response->json('data'))->pluck('full_name')->all();
        $this->assertContains('Own Candidate', $names);
        $this->assertNotContains('Other Candidate', $names);
    }

    public function test_admin_sees_all_candidates_in_index(): void
    {
        $admin = User::factory()->admin()->create();
        $recruiterA = User::factory()->create();
        $recruiterB = User::factory()->create();

        Candidate::factory()->create(['recruiter_id' => $recruiterA->id, 'full_name' => 'Candidate A']);
        Candidate::factory()->create(['recruiter_id' => $recruiterB->id, 'full_name' => 'Candidate B']);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/candidates')->assertStatus(200);

        $names = collect($response->json('data'))->pluck('full_name')->all();
        $this->assertContains('Candidate A', $names);
        $this->assertContains('Candidate B', $names);
    }

    public function test_recruiter_cannot_view_another_recruiters_candidate(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($intruder);

        $this->getJson("/api/candidates/{$candidate->id}")->assertStatus(403);
    }

    public function test_owner_can_view_own_candidate(): void
    {
        $owner = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($owner);

        $this->getJson("/api/candidates/{$candidate->id}")
            ->assertStatus(200)
            ->assertJsonPath('id', $candidate->id);
    }

    public function test_recruiter_cannot_update_another_recruiters_candidate(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($intruder);

        $this->putJson("/api/candidates/{$candidate->id}", ['full_name' => 'Hacked'])
            ->assertStatus(403);

        $this->assertDatabaseMissing('candidates', ['id' => $candidate->id, 'full_name' => 'Hacked']);
    }

    public function test_owner_can_update_own_candidate(): void
    {
        $owner = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id, 'stage' => 'new']);

        Sanctum::actingAs($owner);

        $this->putJson("/api/candidates/{$candidate->id}", ['stage' => 'hired'])
            ->assertStatus(200)
            ->assertJsonPath('stage', 'hired');
    }

    public function test_admin_can_update_any_candidate(): void
    {
        $admin = User::factory()->admin()->create();
        $owner = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/candidates/{$candidate->id}", ['full_name' => 'Updated By Admin'])
            ->assertStatus(200)
            ->assertJsonPath('full_name', 'Updated By Admin');
    }

    public function test_recruiter_cannot_delete_another_recruiters_candidate(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($intruder);

        $this->deleteJson("/api/candidates/{$candidate->id}")->assertStatus(403);
        $this->assertDatabaseHas('candidates', ['id' => $candidate->id]);
    }

    public function test_owner_can_delete_own_candidate(): void
    {
        $owner = User::factory()->create();
        $candidate = Candidate::factory()->create(['recruiter_id' => $owner->id]);

        Sanctum::actingAs($owner);

        $this->deleteJson("/api/candidates/{$candidate->id}")->assertStatus(200);
        $this->assertSoftDeleted('candidates', ['id' => $candidate->id]);
    }
}
