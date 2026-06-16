<?php

namespace Database\Seeders;

use App\Models\Candidate;
use App\Models\Department;
use App\Models\HiringRequest;
use App\Models\Meeting;
use App\Models\User;
use App\Models\Vacancy;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Departments (Alina Group structure)
        $departments = collect([
            'Производство', 'Продажи', 'Маркетинг', 'Финансы и бухгалтерия',
            'IT', 'Логистика и склад', 'HR', 'Закупки',
        ])->map(fn ($name) => Department::firstOrCreate(['name' => $name], ['city' => 'Алматы']));

        $itDept = $departments->firstWhere('name', 'IT');
        $whDept = $departments->firstWhere('name', 'Логистика и склад');

        // Users
        $admin = User::firstOrCreate(['email' => 'admin@alinagroup.kz'], [
            'name' => 'Айгерим Админова',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'position' => 'Руководитель отдела подбора',
            'phone' => '+7 700 000 0001',
        ]);

        $recruiter1 = User::firstOrCreate(['email' => 'recruiter@alinagroup.kz'], [
            'name' => 'Дана Рекрутова',
            'password' => Hash::make('password'),
            'role' => 'recruiter',
            'position' => 'Рекрутер',
            'department_id' => $departments->firstWhere('name', 'HR')->id,
            'phone' => '+7 700 000 0002',
        ]);

        $recruiter2 = User::firstOrCreate(['email' => 'recruiter2@alinagroup.kz'], [
            'name' => 'Ержан Кадыров',
            'password' => Hash::make('password'),
            'role' => 'recruiter',
            'position' => 'Рекрутер',
            'department_id' => $departments->firstWhere('name', 'HR')->id,
            'phone' => '+7 700 000 0003',
        ]);

        $manager = User::firstOrCreate(['email' => 'it-lead@alinagroup.kz'], [
            'name' => 'Тимур Лидеров',
            'password' => Hash::make('password'),
            'role' => 'manager',
            'position' => 'Начальник IT отдела',
            'department_id' => $itDept->id,
            'phone' => '+7 700 000 0004',
        ]);

        $whManager = User::firstOrCreate(['email' => 'warehouse@alinagroup.kz'], [
            'name' => 'Серик Складов',
            'password' => Hash::make('password'),
            'role' => 'manager',
            'position' => 'Руководитель склада',
            'department_id' => $whDept->id,
            'phone' => '+7 700 000 0005',
        ]);

        // Hiring requests
        $req1 = HiringRequest::firstOrCreate(['title' => 'Web-разработчик (Laravel/React)'], [
            'department_id' => $itDept->id,
            'city' => 'Алматы',
            'position' => 'Web-разработчик',
            'headcount' => 1,
            'description' => 'Нужен fullstack разработчик для внутренних HR-систем.',
            'requirements' => 'PHP/Laravel, React, опыт 2+ лет',
            'salary_range' => '600 000 – 800 000 KZT',
            'priority' => 'high',
            'status' => 'approved',
            'requested_by' => $manager->id,
            'assigned_recruiter_id' => $recruiter1->id,
        ]);

        HiringRequest::firstOrCreate(['title' => 'Кладовщик на склад AlinEX'], [
            'department_id' => $whDept->id,
            'city' => 'Алматы',
            'position' => 'Кладовщик',
            'headcount' => 3,
            'description' => 'Приём и учёт продукции на складе.',
            'requirements' => 'Опыт работы со складом, 1С',
            'salary_range' => '300 000 – 380 000 KZT',
            'priority' => 'urgent',
            'status' => 'pending',
            'requested_by' => $whManager->id,
        ]);

        // Vacancies (based on Alina Group open roles)
        $vacData = [
            ['Web-разработчик (Laravel/React)', 'IT', 'Web-разработчик', '600 000 – 800 000 KZT', $req1->id],
            ['Слесарь-механик', 'Производство', 'Слесарь-механик', '380 000 – 450 000 KZT', null],
            ['Бизнес-аналитик (Power BI)', 'Финансы и бухгалтерия', 'Бизнес-аналитик', '500 000 – 700 000 KZT', null],
        ];
        $vacancies = [];
        foreach ($vacData as [$title, $dept, $pos, $salary, $reqId]) {
            $vacancies[] = Vacancy::firstOrCreate(['title' => $title], [
                'department_id' => $departments->firstWhere('name', $dept)->id,
                'city' => 'Алматы',
                'position' => $pos,
                'salary_range' => $salary,
                'status' => 'open',
                'hiring_request_id' => $reqId,
                'recruiter_id' => $recruiter1->id,
            ]);
        }

        // Candidates
        $stages = ['new', 'screening', 'phone', 'tech', 'final', 'offer', 'hired', 'rejected'];
        $sources = ['hh.kz', 'OLX.kz', 'Реферал', 'LinkedIn', 'Qyzmet.kz', 'Вручную'];
        $cities = ['Алматы', 'Астана', 'Шымкент', 'Караганда'];
        $positions = ['Web-разработчик', 'Слесарь-механик', 'Бизнес-аналитик', 'Бухгалтер', 'Кладовщик', 'Маркетолог'];
        $names = [
            'Алмас Нурланов', 'Гульнара Сейтова', 'Бекзат Амиров', 'Динара Касымова',
            'Руслан Жумабеков', 'Айдана Оспанова', 'Нурлан Базарбаев', 'Жанна Турсунова',
            'Адильжан Маратов', 'Сауле Алиева', 'Куаныш Ержанов', 'Мадина Бекова',
        ];

        foreach ($names as $i => $name) {
            Candidate::firstOrCreate(['full_name' => $name], [
                'phone' => '+7 70'.rand(0, 9).' '.rand(100, 999).' '.rand(1000, 9999),
                'email' => 'candidate'.$i.'@example.kz',
                'organization' => 'Alina Group',
                'city' => $cities[$i % count($cities)],
                'department' => $departments->random()->name,
                'position' => $positions[$i % count($positions)],
                'source' => $sources[$i % count($sources)],
                'stage' => $stages[$i % count($stages)],
                'status' => 'active',
                'comment' => 'Кандидат добавлен из источника '.$sources[$i % count($sources)],
                'resume_text' => "Опыт работы: ".rand(1, 8)." лет по специальности {$positions[$i % count($positions)]}. Образование высшее. Навыки: 1С, MS Office. Знание русского и казахского языков.",
                'vacancy_id' => $vacancies[$i % count($vacancies)]->id,
                'recruiter_id' => $i % 2 === 0 ? $recruiter1->id : $recruiter2->id,
            ]);
        }

        // Meetings
        Meeting::firstOrCreate(['title' => 'Техинтервью: Алмас Нурланов'], [
            'starts_at' => now()->addHours(2),
            'duration_min' => 45,
            'location' => 'Zoom',
            'user_id' => $recruiter1->id,
            'candidate_id' => Candidate::where('full_name', 'Алмас Нурланов')->value('id'),
        ]);
        Meeting::firstOrCreate(['title' => 'Финал: Динара Касымова'], [
            'starts_at' => now()->addDay()->setTime(11, 0),
            'duration_min' => 30,
            'location' => 'Офис, Казыбаева 20',
            'user_id' => $recruiter1->id,
        ]);
    }
}
