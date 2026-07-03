<?php

namespace Tests\Unit;

use App\Services\AiService;
use PHPUnit\Framework\TestCase;

class AiServiceSanitizeTest extends TestCase
{
    public function test_it_masks_email_addresses(): void
    {
        $result = AiService::sanitizeResumeText('Опыт работы 5 лет. Контакт: ivan.petrov@example.com для связи.');

        $this->assertStringNotContainsString('ivan.petrov@example.com', $result);
        $this->assertStringContainsString('[email]', $result);
    }

    public function test_it_masks_phone_numbers_in_various_formats(): void
    {
        $samples = [
            '+7 (701) 123-45-67',
            '8 701 123 45 67',
            '+77011234567',
            '87011234567',
        ];

        foreach ($samples as $phone) {
            $result = AiService::sanitizeResumeText("Опыт работы. Телефон: {$phone}. Образование высшее.");

            $this->assertStringNotContainsString($phone, $result, "Phone {$phone} was not masked");
            $this->assertStringContainsString('[phone]', $result);
        }
    }

    public function test_it_masks_leading_full_name(): void
    {
        $result = AiService::sanitizeResumeText("Иванов Иван Иванович\nОпыт работы 5 лет. Образование высшее.");

        $this->assertStringNotContainsString('Иванов Иван Иванович', $result);
        $this->assertStringContainsString('[имя]', $result);
    }

    public function test_it_keeps_professional_terms(): void
    {
        $result = AiService::sanitizeResumeText('Опыт работы 5 лет. Образование высшее. Уверенный пользователь 1С и Power BI.');

        $this->assertStringContainsString('Опыт работы', $result);
        $this->assertStringContainsString('Образование', $result);
        $this->assertStringContainsString('1С', $result);
        $this->assertStringContainsString('Power BI', $result);
    }

    public function test_it_handles_empty_text(): void
    {
        $this->assertSame('(текст резюме не предоставлен)', AiService::sanitizeResumeText(null));
        $this->assertSame('(текст резюме не предоставлен)', AiService::sanitizeResumeText(''));
    }
}
