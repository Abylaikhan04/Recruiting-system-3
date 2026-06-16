<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateNoteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HiringRequestController;
use App\Http\Controllers\MeetingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VacancyController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/analytics', [AnalyticsController::class, 'index']);
    Route::get('/departments', [UserController::class, 'departments']);

    // Candidates
    Route::get('/candidates', [CandidateController::class, 'index']);
    Route::post('/candidates', [CandidateController::class, 'store']);
    Route::post('/candidates/bulk-import', [CandidateController::class, 'bulkImport']);
    Route::post('/candidates/analyze-batch', [CandidateController::class, 'analyzeBatch']);
    Route::get('/candidates/{candidate}', [CandidateController::class, 'show']);
    Route::put('/candidates/{candidate}', [CandidateController::class, 'update']);
    Route::delete('/candidates/{candidate}', [CandidateController::class, 'destroy']);
    Route::post('/candidates/{candidate}/analyze', [CandidateController::class, 'analyze']);
    Route::post('/candidates/{candidate}/notes', [CandidateNoteController::class, 'store']);

    // Vacancies
    Route::get('/vacancies', [VacancyController::class, 'index']);
    Route::post('/vacancies', [VacancyController::class, 'store']);
    Route::put('/vacancies/{vacancy}', [VacancyController::class, 'update']);
    Route::delete('/vacancies/{vacancy}', [VacancyController::class, 'destroy']);

    // Hiring requests
    Route::get('/hiring-requests', [HiringRequestController::class, 'index']);
    Route::post('/hiring-requests', [HiringRequestController::class, 'store']);
    Route::put('/hiring-requests/{hiringRequest}', [HiringRequestController::class, 'update']);
    Route::delete('/hiring-requests/{hiringRequest}', [HiringRequestController::class, 'destroy']);

    // Meetings
    Route::get('/meetings', [MeetingController::class, 'index']);
    Route::post('/meetings', [MeetingController::class, 'store']);
    Route::put('/meetings/{meeting}', [MeetingController::class, 'update']);
    Route::delete('/meetings/{meeting}', [MeetingController::class, 'destroy']);

    // Users / settings (admin only for management)
    Route::put('/profile', [UserController::class, 'profile']);
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });

    // Recruiters list (used in filters) - available to all authed
    Route::get('/recruiters', function (\Illuminate\Http\Request $request) {
        return \App\Models\User::where('role', 'recruiter')->get(['id', 'name']);
    });
});
