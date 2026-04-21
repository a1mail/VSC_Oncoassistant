# План исправления AI функциональности в OncoAssistWeb.html

## Выявленные проблемы

### 1. Дублирование функций
- В файле есть две функции `generateDiagnosis()`:
  - Полная версия (строки 1963-2301) с поддержкой Gemini, OpenAI, Anthropic
  - Упрощенная версия (строки 3168-3171) с сообщением о необходимости API
- Упрощенная версия перезаписывает полную, делая AI функциональность нерабочей

### 2. Проблемы с Gemini API
- **Некорректный URL**: `const url = \`${provider.baseUrl}${modelName}:generateContent?key=${apiKey}\``
  - Проблема: `provider.baseUrl` уже содержит `/models/`, добавлять `modelName` напрямую некорректно
  - Правильный формат: `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
- **Некорректная структура запроса**: `system_instruction` имеет неправильную структуру
  - Текущая: `system_instruction: { parts: { text: '...' } }`
  - Правильная: `system_instruction: { text: '...' }` или `system_instruction: '...'`

### 3. Отсутствие поддержки других провайдеров
- В функции `callAI` обрабатываются только `gemini`, `openai`, `anthropic`
- В `PROVIDER_URLS` определены также: `deepseek`, `qwen`, `gigachat`, `openrouter`, `custom`
- Эти провайдеры не имеют реализации

### 4. Проблемы с базовыми URL
- Некоторые URL могут быть устаревшими или некорректными
- Для `custom` провайдера URL пустой, что может вызывать ошибки

## План исправлений

### Шаг 1: Удалить дублирующую функцию
Удалить строки 3168-3171 (упрощенную версию `generateDiagnosis()`)

### Шаг 2: Исправить Gemini API
```javascript
async callGeminiAPI(prompt, apiKey, provider) {
    try {
        const modelName = provider.model || 'gemini-2.0-flash';
        // Исправить URL: убрать дублирование /models/
        const baseUrl = provider.baseUrl.replace(/\/$/, ''); // Убрать trailing slash если есть
        const url = `${baseUrl}/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                system_instruction: {
                    text: 'Ты - опытный онколог и специалист по диагностике...'
                },
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.9,
                    maxOutputTokens: 2048
                }
            })
        });
        // ... остальной код
    }
}
```

### Шаг 3: Добавить поддержку других провайдеров
Расширить функцию `callAI` для поддержки всех провайдеров:
- `deepseek`: аналогично OpenAI API
- `qwen`: требует специального формата
- `gigachat`: требует специального формата  
- `openrouter`: аналогично OpenAI API
- `custom`: требует настройки пользователем

### Шаг 4: Обновить PROVIDER_URLS
Проверить и обновить URL для актуальности:
- `gemini`: `https://generativelanguage.googleapis.com/v1beta/models/`
- `openai`: `https://api.openai.com/v1` (OK)
- `anthropic`: `https://api.anthropic.com/v1` (OK)
- `deepseek`: `https://api.deepseek.com/v1` (OK)
- `qwen`: `https://dashscope.aliyuncs.com/api/v1` (OK)
- `gigachat`: `https://gigachat.devices.sberbank.ru/api/v1` (проверить доступность)
- `openrouter`: `https://openrouter.ai/api/v1` (OK)
- `custom`: `''` (оставить пустым для пользовательского ввода)

### Шаг 5: Создать универсальную функцию для OpenAI-совместимых API
Большинство провайдеров (openai, deepseek, openrouter) используют OpenAI-совместимый API.
Создать общую функцию `callOpenAICompatibleAPI`.

### Шаг 6: Добавить обработку ошибок
- Улучшить обработку ошибок сети
- Добавить таймауты
- Добавить логирование для отладки

## Приоритеты
1. Удалить дублирование (самая критичная проблема)
2. Исправить Gemini API
3. Добавить поддержку OpenAI-совместимых провайдеров
4. Добавить поддержку остальных провайдеров

## Тестирование
После исправлений необходимо протестировать:
1. Добавление провайдера в настройках
2. Выбор активного провайдера
3. Генерацию диагноза с разными провайдерами
4. Обработку ошибок (неверный API ключ, сетевые проблемы)