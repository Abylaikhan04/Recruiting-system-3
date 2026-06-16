/**
 * AI candidate analysis service.
 * Isolated from routing — testable and replaceable independently.
 */

function heuristic(c) {
  const score = c.resume_text
    ? 60 + Math.floor(Math.random() * 25)
    : 35 + Math.floor(Math.random() * 20)
  return {
    score,
    summary: `Кандидат ${c.full_name} на позицию ${c.position}. Рекомендуется провести скрининг.`,
    strengths: ['Опыт в соответствующей сфере', 'Профессиональные навыки', 'Мотивация к развитию'],
    risks: ['Требуется проверка навыков', 'Уточните ожидания по зарплате'],
    questions: [
      'Расскажите о вашем предыдущем опыте?',
      'Почему вас интересует эта позиция?',
      'Каковы ваши зарплатные ожидания?',
    ],
  }
}

async function aiAnalyze(candidate, vacancy) {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey || process.env.AI_ENABLED === 'false') return heuristic(candidate)

  try {
    const baseUrl = (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '')
    const prompt = `Ты — HR-аналитик. Оцени кандидата на позицию.
Кандидат: ${candidate.full_name}
Позиция: ${candidate.position || 'не указана'}
${candidate.resume_text && !candidate.resume_text.startsWith('%PDF') ? 'Резюме:\n' + candidate.resume_text.slice(0, 1200) : ''}
${vacancy ? 'Вакансия: ' + vacancy.title + (vacancy.requirements ? '\nТребования: ' + String(vacancy.requirements).slice(0, 400) : '') : ''}

Ответь СТРОГО в JSON без markdown, пример:
{"score":75,"summary":"Краткое резюме 1-2 предложения","strengths":["пункт1","пункт2","пункт3"],"risks":["пункт1","пункт2"],"questions":["вопрос1","вопрос2","вопрос3"]}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 600,
      }),
    })
    clearTimeout(timeout)

    const json = await resp.json()
    if (!resp.ok) {
      console.error('Groq API error:', json?.error?.message || resp.status)
      return heuristic(candidate)
    }

    const content = json.choices?.[0]?.message?.content || ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return heuristic(candidate)

    const result = JSON.parse(match[0])
    if (typeof result.score !== 'number') return heuristic(candidate)
    return result
  } catch (err) {
    console.error('aiAnalyze error:', err.message)
    return heuristic(candidate)
  }
}

module.exports = { aiAnalyze }
