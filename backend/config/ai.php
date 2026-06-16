<?php

return [
    'enabled' => (bool) env('AI_ENABLED', false),
    'base_url' => env('AI_BASE_URL', 'https://api.groq.com/openai/v1'),
    'api_key' => env('AI_API_KEY', ''),
    'model' => env('AI_MODEL', 'llama-3.3-70b-versatile'),
];
