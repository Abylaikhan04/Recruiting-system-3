<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hiring requests: a manager (e.g. head of IT) requests a new employee
        Schema::create('hiring_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('city')->nullable();
            $table->string('position');
            $table->unsignedInteger('headcount')->default(1);
            $table->text('description')->nullable();
            $table->text('requirements')->nullable();
            $table->string('salary_range')->nullable();
            $table->string('priority')->default('normal'); // low | normal | high | urgent
            // pending | approved | rejected | in_progress | closed
            $table->string('status')->default('pending');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_recruiter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('vacancies', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('city')->nullable();
            $table->string('position')->nullable();
            $table->string('salary_range')->nullable();
            $table->text('description')->nullable();
            $table->text('requirements')->nullable();
            $table->string('status')->default('open'); // open | paused | closed
            $table->foreignId('hiring_request_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recruiter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vacancies');
        Schema::dropIfExists('hiring_requests');
    }
};
