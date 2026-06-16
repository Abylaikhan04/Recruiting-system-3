<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();
            // Voronka fields (Alina Group)
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('organization')->default('Alina Group');
            $table->string('city')->nullable();
            $table->string('department')->nullable();
            $table->string('position');
            $table->string('source')->nullable(); // hh.kz, OLX, referral, manual...
            // funnel stage
            $table->string('stage')->default('new'); // new|screening|phone|tech|final|offer|hired|rejected
            $table->string('status')->default('active'); // active|interview|hired|rejected
            $table->string('rejection_reason')->nullable();
            $table->text('comment')->nullable();
            $table->text('resume_text')->nullable();
            $table->string('resume_path')->nullable();
            $table->string('resume_url')->nullable();
            $table->foreignId('vacancy_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recruiter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('candidate_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default('note'); // note | whatsapp
            $table->string('direction')->nullable(); // in | out (for whatsapp)
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('candidate_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('field');
            $table->string('from_value')->nullable();
            $table->string('to_value')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('score')->nullable(); // 0-100
            $table->json('strengths')->nullable();
            $table->json('risks')->nullable();
            $table->json('questions')->nullable();
            $table->text('summary')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->dateTime('starts_at');
            $table->unsignedInteger('duration_min')->default(30);
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('candidate_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meetings');
        Schema::dropIfExists('ai_analyses');
        Schema::dropIfExists('candidate_history');
        Schema::dropIfExists('candidate_notes');
        Schema::dropIfExists('candidates');
    }
};
