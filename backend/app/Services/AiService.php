<?php

namespace App\Services;

use App\Models\Candidate;
use Illuminate\Support\Facades\Http;

class AiService
{
    /**
     * Analyze a candidate resume and return structured assessment.
     * Falls back to a deterministic heuristic when no API key is configured,
     * so the feature is always demonstrable on-prem.
     */
    public function analyzeCandidate(Candidate $candidate): array
    {
        $apiKey = config('ai.api_key');

        if (config('ai.enabled') && $apiKey) {
            try {
                return $this->callProvider($candidate, $apiKey);
            } catch (\Throwable $e) {
                $this->reportProviderFailure($e, $apiKey);
                // fall through to heuristic
            }
        }

        return $this->heuristic($candidate);
    }

    private function callProvider(Candidate $candidate, string $apiKey): array
    {
        $prompt = $this->buildPrompt($candidate);

        $response = Http::withToken($apiKey)
            ->timeout(45)
            ->post(rtrim(config('ai.base_url'), '/').'/chat/completions', [
                'model' => config('ai.model'),
                'temperature' => 0.3,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Ты HR-аналитик Alina Group. Анализируй резюме кандидата и верни строго JSON с полями: score (0-100), strengths (массив строк), risks (массив строк), questions (массив строк), summary (строка на русском).',
                    ],
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

        $response->throw();

        $content = data_get($response->json(), 'choices.0.message.content', '{}');
        $data = json_decode($content, true) ?: [];

        return [
            'score' => (int) ($data['score'] ?? 50),
            'strengths' => array_values((array) ($data['strengths'] ?? [])),
            'risks' => array_values((array) ($data['risks'] ?? [])),
            'questions' => array_values((array) ($data['questions'] ?? [])),
            'summary' => (string) ($data['summary'] ?? ''),
        ];
    }

    private function buildPrompt(Candidate $candidate): string
    {
        return "Должность: {$candidate->position}\n"
            ."Город: {$candidate->city}\n"
            ."Источник: {$candidate->source}\n"
            ."Резюме:\n".self::sanitizeResumeText($candidate->resume_text);
    }

    /**
     * Strip personal data (emails, phone numbers, leading ФИО) from resume text
     * before it is sent to an external AI provider.
     */
    public static function sanitizeResumeText(?string $text): string
    {
        if (! $text || trim($text) === '') {
            return '(текст резюме не предоставлен)';
        }

        $sanitized = $text;

        // Email addresses
        $sanitized = preg_replace(
            '/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/u',
            '[email]',
            $sanitized
        );

        // Phone numbers: +7 (xxx) xxx-xx-xx, 8xxxxxxxxxx, xxx-xxx-xxxx, with spaces/dashes/parentheses
        $sanitized = preg_replace(
            '/(?<!\d)(\+?\d[\d\-\s\(\)]{7,}\d)(?!\d)/u',
            '[phone]',
            $sanitized
        );

        // Explicit ФИО pattern at the very start of the resume (e.g. "Иванов Иван Иванович")
        $sanitized = preg_replace(
            '/^\s*[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?\s*(\r?\n|$)/u',
            "[имя]\n",
            $sanitized,
            1
        );

        return $sanitized;
    }

    /**
     * Log an AI provider failure without ever exposing the API key.
     */
    private function reportProviderFailure(\Throwable $e, string $apiKey): void
    {
        $message = $e->getMessage();

        if ($apiKey !== '') {
            $message = str_replace($apiKey, '[redacted]', $message);
        }

        report(new \RuntimeException('AI provider call failed: '.$message));
    }

    /**
     * Offline heuristic so AI analysis works without external API.
     */
    private function heuristic(Candidate $candidate): array
    {
        $text = mb_strtolower($candidate->resume_text ?? '');
        $len = mb_strlen($text);

        $score = 40;
        $strengths = [];
        $risks = [];

        $keywords = ['опыт', 'образование', '1с', 'power bi', 'руковод', 'продаж', 'инженер', 'английский'];
        foreach ($keywords as $kw) {
            if (str_contains($text, $kw)) {
                $score += 6;
                $strengths[] = 'Упоминается: '.$kw;
            }
        }

        if ($len < 120) {
            $risks[] = 'Слишком короткое резюме — мало данных для оценки';
            $score -= 10;
        }
        if (! str_contains($text, 'опыт')) {
            $risks[] = 'Не указан опыт работы';
        }

        $score = max(0, min(100, $score));

        if (empty($strengths)) {
            $strengths[] = 'Базовое соответствие позиции «'.$candidate->position.'»';
        }
        if (empty($risks)) {
            $risks[] = 'Требуется уточнение зарплатных ожиданий';
        }

        return [
            'score' => $score,
            'strengths' => array_slice($strengths, 0, 5),
            'risks' => array_slice($risks, 0, 5),
            'questions' => [
                'Расскажите о вашем опыте по специальности «'.$candidate->position.'»?',
                'Какая зарплата для вас приемлема?',
                'Готовы ли вы к графику работы в Alina Group?',
            ],
            'summary' => 'Эвристическая оценка (AI-ключ не настроен). Балл соответствия: '.$score.'/100.',
        ];
    }
}
