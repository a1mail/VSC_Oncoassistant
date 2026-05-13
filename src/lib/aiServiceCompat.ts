/**
 * AI Service Compatibility Layer
 * Bridges the old AIService API with the new Enhanced AI Service
 * Maintains backward compatibility while supporting new features
 * Integrates with profileService for saved API profiles
 */

import { GoogleGenAI } from "@google/genai";
import { enhancedAIService, EnhancedAIProfile, ProviderFactory } from '@/lib/providers';
import { profileService, SavedProviderProfile } from '@/lib/providers/profileService';

// Legacy Types (re-exported for backward compatibility)
export type AIProvider = 'gemini' | 'openai_compatible';

export interface AIProfile {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

export interface AISettings {
  profiles: AIProfile[];
  activeProfileId: string;
  enableFallback: boolean;
}

const DEFAULT_GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '').trim();

function normalizeApiKey(value?: string): string {
  if (!value) return '';

  let normalized = value
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  normalized = normalized.replace(/^["'`]+|["'`]+$/g, '').trim();
  normalized = normalized.replace(/^authorization\s*:\s*/i, '').trim();

  const bearerMatch = normalized.match(/^bearer\s+(.+)$/i);
  if (bearerMatch) {
    normalized = bearerMatch[1].trim();
  }

  normalized = normalized.replace(/\s+/g, '');
  return normalized;
}

function isViableProfile(profile: EnhancedAIProfile): boolean {
  if (profile.providerType === 'local') {
    return !!profile.baseUrl?.trim();
  }
  return !!profile.apiKey?.trim() && !!profile.baseUrl?.trim();
}

function buildEnvFallbackProfile(): EnhancedAIProfile | null {
  if (!DEFAULT_GEMINI_API_KEY) {
    return null;
  }

  const template = ProviderFactory.getProviderTemplate('gemini');

  return {
    id: 'env-gemini',
    name: 'Google Gemini (ENV)',
    providerType: 'gemini',
    apiKey: DEFAULT_GEMINI_API_KEY,
    baseUrl: (template.baseUrl as string) || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelName: (template.modelName as string) || 'gemini-2.0-flash',
    metrics: {
      successCount: 0,
      failureCount: 0,
      isHealthy: true,
    },
    capabilities: template.capabilities || {
      supportsImages: true,
      supportsJSON: false,
      supportsSystemPrompt: true,
      supportsVision: true,
      maxTokens: 8192,
      contextWindow: 1000000,
    },
    isActive: true,
    priority: 8,
  };
}

// Helper to remove empty fields recursively to save tokens
function removeEmptyFields(obj: any): any {
  if (Array.isArray(obj)) {
    const cleaned = obj.map(removeEmptyFields).filter(v => v !== null && v !== undefined && v !== '' && v !== false && (typeof v !== 'object' || Object.keys(v).length > 0));
    return cleaned.length > 0 ? cleaned : undefined;
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const value = removeEmptyFields(obj[key]);
      if (value !== undefined && value !== null && value !== '' && value !== false && (typeof value !== 'object' || Object.keys(value).length > 0)) {
        newObj[key] = value;
      }
    });
    return Object.keys(newObj).length > 0 ? newObj : undefined;
  }
  return obj;
}

function cleanJson(text: string): string {
  let cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

function normalizeJsonText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n/g, '\n')
    .trim();
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function extractBalancedJson(text: string): string | null {
  const source = stripCodeFences(normalizeJsonText(text));
  const start = [...source].findIndex((char) => char === '{' || char === '[');
  if (start === -1) {
    return null;
  }

  const opening = source[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === opening) {
      depth++;
    } else if (char === closing) {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

function repairJsonString(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u001F]+/g, (match) => {
      if (match === '\n' || match === '\t' || match === '\r') {
        return match;
      }
      return '';
    })
    .trim();
}

function repairJsonStringLiterals(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  const isLikelyStringTerminator = (source: string, index: number): boolean => {
    for (let i = index + 1; i < source.length; i++) {
      const next = source[i];
      if (/\s/.test(next)) {
        continue;
      }
      return next === ',' || next === '}' || next === ']';
    }
    return true;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      continue;
    }

    if (char === '"') {
      if (isLikelyStringTerminator(text, i)) {
        inString = false;
        result += char;
      } else {
        result += '\\"';
      }
      continue;
    }

    if (char === '\n') {
      result += '\\n';
      continue;
    }

    if (char === '\r') {
      result += '\\r';
      continue;
    }

    if (char === '\t') {
      result += '\\t';
      continue;
    }

    result += char;
  }

  return result;
}

function parseAiJsonResponse(text: string): any {
  const normalized = normalizeJsonText(text);
  const candidates = [
    normalized,
    stripCodeFences(normalized),
    cleanJson(normalized),
    extractBalancedJson(normalized),
    repairJsonString(cleanJson(normalized)),
    repairJsonString(extractBalancedJson(normalized) || ''),
    repairJsonStringLiterals(repairJsonString(cleanJson(normalized))),
    repairJsonStringLiterals(repairJsonString(extractBalancedJson(normalized) || '')),
  ].filter((candidate): candidate is string => !!candidate && candidate.trim().length > 0);

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const preview = normalized.slice(0, 200).replace(/\s+/g, ' ');
  throw new Error(lastError?.message || `Failed to parse AI JSON response: ${preview}`);
}

type StructuredResponseSchema = 'diagnosis' | 'treatment';
type StructuredResponseFormat = 'json' | 'xml';
type RetrySourceSection = 'diagnosis' | 'treatment';

type AiDebugMetadata = {
  rawResponse: string;
  rawResponseFormat: StructuredResponseFormat;
  rawProvider: string;
  rawResponseTime: number;
  wasRepaired?: boolean;
};

type AiExecutionError = Error & Partial<AiDebugMetadata>;

function attachAiDebugMetadata<T extends Record<string, unknown>>(
  value: T,
  metadata: AiDebugMetadata,
): T & AiDebugMetadata {
  return {
    ...value,
    ...metadata,
  };
}

function createAiExecutionError(message: string, metadata: AiDebugMetadata): AiExecutionError {
  const error = new Error(message) as AiExecutionError;
  error.rawResponse = metadata.rawResponse;
  error.rawResponseFormat = metadata.rawResponseFormat;
  error.rawProvider = metadata.rawProvider;
  error.rawResponseTime = metadata.rawResponseTime;
  error.wasRepaired = metadata.wasRepaired;
  return error;
}

function inferStructuredSchema(prompt: string): StructuredResponseSchema {
  if (/treatment_strategy|primary_treatment|prescriptions|cr_source/i.test(prompt)) {
    return 'treatment';
  }
  return 'diagnosis';
}

function appendRawResponseRetryContext(
  prompt: string,
  section: RetrySourceSection,
  rawResponse: string,
  options: { provider?: string; previousError?: string } = {},
): string {
  const trimmedRawResponse = rawResponse.trim();
  if (!trimmedRawResponse) {
    return prompt;
  }

  const truncatedRawResponse =
    trimmedRawResponse.length > 12000 ? `${trimmedRawResponse.slice(0, 12000)}\n...[truncated]` : trimmedRawResponse;
  const providerLine = options.provider ? `Previous model: ${options.provider}` : 'Previous model: unknown';
  const errorLine = options.previousError ? `Previous error: ${options.previousError}` : 'Previous error: parsing/formatting failure';

  return `${prompt}

ADDITIONAL CONTEXT FROM A PREVIOUS MODEL ATTEMPT:
- This is a retry for ${section}.
- ${providerLine}
- ${errorLine}
- The previous response may be incomplete, verbose, or incorrectly formatted.
- Use it only as supplemental medical context.
- Verify and correct its content before relying on it.
- Do not preserve conversational filler or chain-of-thought.
- Return only the final answer in the required output format for this request.

PREVIOUS RAW RESPONSE:
${truncatedRawResponse}`;
}

function getOpenRouterPreferredFormat(
  profile: EnhancedAIProfile | null,
  schema: StructuredResponseSchema,
): StructuredResponseFormat | null {
  if (!profile || profile.providerType !== 'openrouter') {
    return null;
  }

  const modelInfo = profile.openRouterModelInfo;
  if (!modelInfo) {
    return null;
  }

  if (schema === 'treatment') {
    const canUseJsonReliably =
      modelInfo.preferredStructuredFormat === 'json' &&
      modelInfo.supportsResponseFormat &&
      !modelInfo.isReasoningModel &&
      !modelInfo.isFreeTier;

    return canUseJsonReliably ? 'json' : 'xml';
  }

  return modelInfo.preferredStructuredFormat;
}

function shouldUseXmlResponseFormat(profile: EnhancedAIProfile | null, schema: StructuredResponseSchema): boolean {
  if (!profile || profile.providerType !== 'openrouter') {
    return false;
  }

  const preferredFormat = getOpenRouterPreferredFormat(profile, schema);
  if (preferredFormat) {
    return preferredFormat === 'xml';
  }

  if (schema === 'treatment') {
    return true;
  }

  return profile.modelName.toLowerCase().includes(':free');
}

function buildStrictXmlPrompt(prompt: string, schema: StructuredResponseSchema): string {
  if (prompt.includes('STRICT XML OUTPUT RULES')) {
    return prompt;
  }

  const schemaInstructions =
    schema === 'diagnosis'
      ? `<response>
  <working_diagnosis>Полный рабочий диагноз</working_diagnosis>
  <icd10>Код МКБ-10</icd10>
  <tnm>Стадия TNM или пустая строка</tnm>
  <reasoning>Обоснование диагноза</reasoning>
  <confidence>High|Medium|Low</confidence>
  <missing_data>
    <item>Недостающий тест 1</item>
    <item>Недостающий тест 2</item>
  </missing_data>
  <is_final>false</is_final>
</response>`
      : `<response>
  <treatment_strategy>Стратегия лечения</treatment_strategy>
  <primary_treatment>Основной подход к лечению</primary_treatment>
  <regimen>Схема или пустая строка</regimen>
  <prescriptions>
    <item>Препарат или назначение 1</item>
    <item>Препарат или назначение 2</item>
  </prescriptions>
  <recommendations>
    <item>Рекомендация 1</item>
    <item>Рекомендация 2</item>
  </recommendations>
  <warnings>
    <item>Противопоказание или взаимодействие 1</item>
  </warnings>
  <cr_source>Источник клинических рекомендаций</cr_source>
</response>`;

  return `${prompt}

STRICT XML OUTPUT RULES:
- Return exactly one XML block.
- The first non-space characters must be <response> and the last must be </response>.
- Do not write any preface, explanation, markdown, or code fences.
- All text values must stay in Russian unless the field is a code like ICD-10 or TNM.
- If a list has no items, return an empty container tag.
- Escape XML special characters when needed.

Use this exact XML structure:
${schemaInstructions}`;
}

function stripXmlCodeFences(text: string): string {
  return normalizeJsonText(text)
    .replace(/```xml\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function unwrapCdata(value: string): string {
  const trimmed = value.trim();
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  return cdataMatch ? cdataMatch[1].trim() : trimmed;
}

function normalizeXmlResponseText(text: string): string {
  let normalized = stripXmlCodeFences(text).replace(/<\?xml[\s\S]*?\?>/gi, '').trim();

  if (/&lt;(response|working_diagnosis|treatment_strategy)\b/i.test(normalized)) {
    normalized = decodeXmlEntities(normalized);
  }

  const firstRelevantTag = normalized.search(/<(response|working_diagnosis|treatment_strategy)\b/i);
  if (firstRelevantTag > 0) {
    normalized = normalized.slice(firstRelevantTag).trim();
  }

  return normalized;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractRawXmlTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (match) {
    return match[1].trim();
  }

  const selfClosingMatch = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?\\s*/>`, 'i'));
  if (selfClosingMatch) {
    return '';
  }

  return '';
}

function extractXmlTag(text: string, tag: string): string {
  const rawValue = extractRawXmlTag(text, tag);
  if (!rawValue) {
    return '';
  }

  return unwrapCdata(decodeXmlEntities(rawValue));
}

function extractXmlList(text: string, tag: string): string[] {
  const rawContainer = extractRawXmlTag(text, tag);
  if (!rawContainer) {
    return [];
  }

  const container = unwrapCdata(decodeXmlEntities(rawContainer));
  if (!container) {
    return [];
  }

  const itemMatches = [...container.matchAll(/<(item|entry|value)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  if (itemMatches.length > 0) {
    return itemMatches
      .map((match) => unwrapCdata(decodeXmlEntities(match[2].trim())))
      .filter(Boolean);
  }

  return container
    .split(/\r?\n|;/)
    .map((item) => item.replace(/<[^>]+>/g, ' ').replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function extractXmlTagByAliases(text: string, tags: string[]): string {
  for (const tag of tags) {
    const value = extractXmlTag(text, tag);
    if (value) {
      return value;
    }
  }

  return '';
}

function extractXmlListByAliases(text: string, tags: string[]): string[] {
  for (const tag of tags) {
    const values = extractXmlList(text, tag);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function parseBooleanValue(value: string): boolean {
  return /^(true|1|yes|да)$/i.test(value.trim());
}

function parseAiXmlResponse(text: string, schema: StructuredResponseSchema): any {
  const normalized = normalizeXmlResponseText(text);
  const xmlBody = extractRawXmlTag(normalized, 'response') || normalized;

  if (schema === 'diagnosis') {
    const workingDiagnosis = extractXmlTag(xmlBody, 'working_diagnosis');
    const icd10 = extractXmlTag(xmlBody, 'icd10');
    if (!workingDiagnosis && !icd10) {
      try {
        const jsonFallback = parseAiJsonResponse(normalized);
        if (jsonFallback && (jsonFallback.working_diagnosis || jsonFallback.icd10)) {
          return jsonFallback;
        }
      } catch {
        // Ignore JSON fallback errors and preserve the original XML parse failure below.
      }

      throw new Error('Failed to parse AI XML response');
    }

    return {
      working_diagnosis: workingDiagnosis,
      icd10,
      tnm: extractXmlTag(xmlBody, 'tnm'),
      reasoning: extractXmlTag(xmlBody, 'reasoning'),
      confidence: extractXmlTag(xmlBody, 'confidence') || 'Medium',
      missing_data: extractXmlList(xmlBody, 'missing_data'),
      is_final: parseBooleanValue(extractXmlTag(xmlBody, 'is_final')),
    };
  }

  const treatmentStrategy = extractXmlTagByAliases(xmlBody, [
    'treatment_strategy',
    'treatment_plan',
    'plan',
    'strategy',
    'management_plan',
  ]);
  const primaryTreatment = extractXmlTagByAliases(xmlBody, [
    'primary_treatment',
    'main_treatment',
    'primary_therapy',
    'therapy',
    'treatment',
  ]);
  if (!treatmentStrategy && !primaryTreatment) {
    try {
      const jsonFallback = parseAiJsonResponse(normalized);
      if (jsonFallback && (jsonFallback.treatment_strategy || jsonFallback.primary_treatment)) {
        return jsonFallback;
      }
    } catch {
      // Ignore JSON fallback errors and preserve the original XML parse failure below.
    }

    throw new Error('Failed to parse AI XML response');
  }

  return {
    treatment_strategy: treatmentStrategy,
    primary_treatment: primaryTreatment,
    regimen: extractXmlTagByAliases(xmlBody, ['regimen', 'protocol', 'scheme', 'treatment_regimen']),
    prescriptions: extractXmlListByAliases(xmlBody, ['prescriptions', 'medications', 'drugs', 'orders']),
    recommendations: extractXmlListByAliases(xmlBody, ['recommendations', 'follow_up', 'followup', 'next_steps']),
    warnings: extractXmlListByAliases(xmlBody, ['warnings', 'contraindications', 'interactions', 'risks']),
    cr_source: extractXmlTagByAliases(xmlBody, ['cr_source', 'source', 'guideline_source', 'reference']),
  };
}

function buildStrictJsonPrompt(prompt: string): string {
  if (prompt.includes('STRICT OUTPUT RULES')) {
    return prompt;
  }

  return `${prompt}

STRICT OUTPUT RULES:
- Return exactly one valid JSON object.
- The very first character of your response must be {.
- The very last character of your response must be }.
- Do not write any preface, confirmation, explanation, or markdown.
- Do not write phrases like "Got it", "Here is the JSON", or any text outside the JSON object.
- Do not wrap JSON in code fences.
- Use double quotes for all keys and all string values.
- Escape quotes inside string values.
- Do not use trailing commas.
- Ensure the JSON is parseable by standard JSON.parse.`;
}

async function repairInvalidJsonResponse(originalPrompt: string, invalidContent: string): Promise<any> {
  const repairPrompt = `You previously answered a task with invalid JSON.

Return ONLY one valid JSON object.
The first character must be { and the last character must be }.
Do not include markdown.
Do not include any explanation.
Preserve the original meaning and all medically relevant details.
If the previous answer started with commentary like "Got it", remove that commentary.
If quotes inside values break JSON, escape them correctly.
If line breaks inside strings break JSON, escape them correctly.

ORIGINAL TASK:
${originalPrompt.slice(0, 8000)}

INVALID OUTPUT TO REPAIR:
${invalidContent.slice(0, 12000)}`;

  const repairResponse = await enhancedAIService.generateContent(repairPrompt, undefined, {
    type: 'complex_analysis',
    requiresJSON: true,
    priority: 'reliability',
    timestamp: new Date(),
  });
  if (!repairResponse.isSuccessful) {
    throw new Error(repairResponse.error || 'AI JSON repair failed');
  }

  const repairedContent = repairResponse.content || '';
  if (!repairedContent.trim()) {
    throw new Error('AI JSON repair returned empty content');
  }

  return parseAiJsonResponse(repairedContent);
}

async function repairInvalidXmlResponse(
  originalPrompt: string,
  invalidContent: string,
  schema: StructuredResponseSchema,
): Promise<any> {
  const repairPrompt = `${buildStrictXmlPrompt(
    'You previously answered a task with invalid XML. Repair the answer and preserve its medical meaning.',
    schema,
  )}

ORIGINAL TASK:
${originalPrompt.slice(0, 8000)}

INVALID OUTPUT TO REPAIR:
${invalidContent.slice(0, 12000)}`;

  const repairResponse = await enhancedAIService.generateContent(repairPrompt, undefined, {
    type: 'complex_analysis',
    requiresJSON: false,
    priority: 'reliability',
    timestamp: new Date(),
  });
  if (!repairResponse.isSuccessful) {
    throw new Error(repairResponse.error || 'AI XML repair failed');
  }

  const repairedContent = repairResponse.content || '';
  if (!repairedContent.trim()) {
    throw new Error('AI XML repair returned empty content');
  }

  return parseAiXmlResponse(repairedContent, schema);
}

const ABBREVIATIONS: Record<string, string> = {
  ECOG: 'шкала общего состояния Eastern Cooperative Oncology Group',
  TNM: 'классификация опухоли по размеру, лимфоузлам и метастазам',
  МКБ: 'Международная классификация болезней',
  'МКБ-10': 'Международная классификация болезней, 10 пересмотр',
  КР: 'клинические рекомендации',
  ИГХ: 'иммуногистохимическое исследование',
  ER: 'эстрогеновые рецепторы',
  PR: 'прогестероновые рецепторы',
  HER2: 'рецептор эпидермального фактора роста человека 2 типа',
  Ki67: 'индекс пролиферативной активности опухоли',
  'ПЭТ-КТ': 'позитронно-эмиссионная томография, совмещенная с компьютерной томографией',
  КТ: 'компьютерная томография',
  МРТ: 'магнитно-резонансная томография',
  УЗИ: 'ультразвуковое исследование',
  СОЭ: 'скорость оседания эритроцитов',
  Hb: 'гемоглобин',
  WBC: 'лейкоциты',
  PLT: 'тромбоциты',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function annotateAbbreviationsInText(text: string): string {
  return Object.entries(ABBREVIATIONS).reduce((acc, [abbr, full]) => {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${escapeRegExp(abbr)})(?!\\s*\\()(?=$|[^\\p{L}\\p{N}_])`,
      'u'
    );
    return acc.replace(pattern, `$1${abbr} (${full})`);
  }, text);
}

function annotateAbbreviations(value: any): any {
  if (typeof value === 'string') {
    return annotateAbbreviationsInText(value);
  }
  if (Array.isArray(value)) {
    return value.map(annotateAbbreviations);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, any>>((result, [key, nested]) => {
      result[key] = annotateAbbreviations(nested);
      return result;
    }, {});
  }
  return value;
}

/**
 * Convert SavedProviderProfile to EnhancedAIProfile
 */
function savedToEnhancedProfile(saved: SavedProviderProfile): EnhancedAIProfile {
  const template = ProviderFactory.getProviderTemplate(saved.type);
  
  // Ensure all required fields are set with proper defaults
  const baseUrl = (saved.baseUrl || '').trim() || 
    (typeof template.baseUrl === 'string' ? template.baseUrl : '') || 
    '';
  
  const modelName = (saved.modelName || '').trim() || 
    (typeof template.modelName === 'string' ? template.modelName : '') || 
    'gpt-4';
  
  const apiKey = normalizeApiKey(saved.apiKey || '');
  const openRouterModelInfo = saved.openRouterModelInfo;
  const templateCapabilities = template.capabilities || {
    supportsImages: false,
    supportsJSON: false,
    supportsSystemPrompt: true,
    supportsVision: false,
    maxTokens: 4000,
    contextWindow: 128000,
  };

  const enhanced: EnhancedAIProfile = {
    id: saved.id,
    name: saved.name,
    providerType: saved.type,
    apiKey: apiKey, // Keep as is - even empty for some providers
    baseUrl: baseUrl,
    modelName: modelName,
    openRouterModelInfo,
    metrics: {
      successCount: 0,
      failureCount: 0,
      isHealthy: true,
    },
    capabilities: {
      ...templateCapabilities,
      supportsJSON:
        saved.type === 'openrouter' && openRouterModelInfo
          ? openRouterModelInfo.preferredStructuredFormat === 'json'
          : templateCapabilities.supportsJSON,
      maxTokens: openRouterModelInfo?.recommendedMaxTokens || templateCapabilities.maxTokens,
      contextWindow: openRouterModelInfo?.contextLength || templateCapabilities.contextWindow,
    },
    isActive: saved.isActive,
    priority: template.priority || 5,
  };

  // Validate required fields
  if (!enhanced.modelName) {
    throw new Error(`Profile "${saved.name}" is missing model name`);
  }

  // Validate provider-specific requirements
  if (saved.type === 'local') {
    // Local models don't require API key
    if (!baseUrl) {
      throw new Error(`Profile "${saved.name}" (Local) requires a base URL (e.g., http://localhost:11434)`);
    }
  } else {
    // All other providers require API key
    if (!apiKey) {
      throw new Error(`Profile "${saved.name}" (${saved.type}) requires an API key`);
    }
    if (!baseUrl) {
      throw new Error(`Profile "${saved.name}" (${saved.type}) requires a base URL`);
    }
  }

  return enhanced;
}

async function refreshActiveOpenRouterProfileMetadata(): Promise<void> {
  const activeProfile = profileService.getActiveProfile();
  if (!activeProfile || activeProfile.type !== 'openrouter') {
    return;
  }

  await profileService.refreshOpenRouterMetadata(activeProfile.id);
}

/**
 * Sync saved profiles from profileService to enhancedAIService
 */
function syncProfilesFromService(): void {
  const savedProfiles = profileService.getAllProfiles();
  
  console.log(`\n📋 Syncing profiles from profileService...`);
  console.log(`Found ${savedProfiles.length} saved profiles`);
  
  // Only sync if there are saved profiles
  if (savedProfiles.length === 0) {
    console.warn('⚠️ No saved profiles found - will use default');
    const currentSettings = enhancedAIService.getSettings();
    if (!currentSettings.profiles.some(isViableProfile)) {
      const envFallback = buildEnvFallbackProfile();
      if (envFallback) {
        enhancedAIService.saveSettings({
          ...currentSettings,
          profiles: [envFallback],
          activeProfileId: envFallback.id,
          fallbackProfileIds: [],
        });
      }
    }
    return;
  }

  const convertedProfiles: EnhancedAIProfile[] = [];
  const errors: string[] = [];

  // Convert all profiles, collecting any errors
  savedProfiles.forEach(saved => {
    try {
      // Get the full profile with API key
      const fullProfile = profileService.getProfile(saved.id);
      if (!fullProfile) {
        errors.push(`Profile "${saved.name}" not found in storage`);
        return;
      }

      console.log(`  Converting: ${fullProfile.name} (${fullProfile.type})`);
      const enhanced = savedToEnhancedProfile(fullProfile);
      convertedProfiles.push(enhanced);
      console.log(`    ✓ Converted successfully`);
    } catch (error: any) {
      const errorMsg = error.message || `Unknown error converting profile ${saved.name}`;
      console.error(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  });

  if (convertedProfiles.length === 0) {
    console.error('❌ No profiles could be converted:', errors);
    const currentSettings = enhancedAIService.getSettings();
    if (!currentSettings.profiles.some(isViableProfile)) {
      const envFallback = buildEnvFallbackProfile();
      if (envFallback) {
        enhancedAIService.saveSettings({
          ...currentSettings,
          profiles: [envFallback],
          activeProfileId: envFallback.id,
          fallbackProfileIds: [],
        });
      }
    }
    return;
  }

  if (errors.length > 0) {
    console.warn(`⚠️ Some profiles had errors:`, errors);
  }

  const sharedCredentialByProviderUrl = new Map<string, string>();
  convertedProfiles.forEach((profile) => {
    const normalizedKey = normalizeApiKey(profile.apiKey || '');
    if (!normalizedKey) return;

    const cacheKey = `${profile.providerType}::${(profile.baseUrl || '').trim().toLowerCase()}`;
    sharedCredentialByProviderUrl.set(cacheKey, normalizedKey);
  });

  const normalizedProfiles = convertedProfiles.map((profile) => {
    const ownKey = normalizeApiKey(profile.apiKey || '');
    if (ownKey) {
      return { ...profile, apiKey: ownKey };
    }

    const cacheKey = `${profile.providerType}::${(profile.baseUrl || '').trim().toLowerCase()}`;
    const sharedKey = sharedCredentialByProviderUrl.get(cacheKey);
    if (!sharedKey) {
      return profile;
    }

    console.warn(`🔁 Restored shared API key for profile "${profile.name}" from matching provider/base URL`);
    return {
      ...profile,
      apiKey: sharedKey,
    };
  });

  // Find active profile - must be one of the converted ones
  const activeProfile = profileService.getActiveProfile();
  let activeId = activeProfile?.id;
  console.log(`\n✓ Successfully converted ${normalizedProfiles.length} profiles`);
  
  // Make sure active ID is in converted profiles
  if (!activeId || !normalizedProfiles.some(p => p.id === activeId)) {
    activeId = normalizedProfiles[0].id;
    console.log(`📌 Setting active profile to: ${normalizedProfiles[0].name}`);
  } else {
    console.log(`📌 Using active profile: ${activeProfile?.name}`);
  }

  const finalProfiles = normalizedProfiles.map((profile) => ({
    ...profile,
    isActive: profile.id === activeId,
  }));

  // Update enhancedAIService ONLY with converted profiles
  // Remove old default profiles that don't have valid config
  const settings = enhancedAIService.getSettings();
  const mergedProfiles = finalProfiles;
  if (!mergedProfiles.some(isViableProfile)) {
    console.warn('⚠️ Converted profiles are not viable; keeping current settings');
    const envFallback = buildEnvFallbackProfile();
    if (envFallback) {
      enhancedAIService.saveSettings({
        ...settings,
        profiles: [envFallback],
        activeProfileId: envFallback.id,
        fallbackProfileIds: [],
      });
    }
    return;
  }
  
  console.log(`\n📝 Updating enhancedAIService with ${mergedProfiles.length} profiles`);
  
  try {
    enhancedAIService.saveSettings({
      ...settings,
      profiles: mergedProfiles,
      activeProfileId: activeId!,
    });
    console.log('✅ Profiles synced and saved to enhancedAIService\n');
  } catch (error) {
    console.error('❌ Failed to save synced profiles:', error);
  }
}

/**
 * Migrate legacy settings to enhanced settings
 */
function migrateToEnhanced(legacySettings: AISettings): void {
  // Load legacy settings and check if migration is needed
  const stored = localStorage.getItem('ai_settings_enhanced');
  if (stored) {
    // Already migrated
    return;
  }

  // Convert legacy profiles to enhanced profiles
  const enhancedProfiles = legacySettings.profiles.map(profile => {
    const template = ProviderFactory.getProviderTemplate(
      profile.provider === 'gemini' ? 'gemini' : 'openai_compatible'
    );

    const enhanced: EnhancedAIProfile = {
      id: profile.id,
      name: profile.name,
      providerType: profile.provider === 'gemini' ? 'gemini' : 'openai_compatible',
      apiKey: profile.apiKey || (profile.provider === 'gemini' ? DEFAULT_GEMINI_API_KEY : undefined),
      baseUrl: profile.baseUrl || template.baseUrl || '',
      modelName: profile.modelName || template.modelName || '',
      metrics: {
        successCount: 0,
        failureCount: 0,
        isHealthy: true,
      },
      capabilities: template.capabilities || {
        supportsImages: false,
        supportsJSON: false,
        supportsSystemPrompt: true,
        supportsVision: false,
        maxTokens: 4000,
        contextWindow: 128000,
      },
      isActive: true,
      priority: profile.provider === 'gemini' ? 8 : 6,
    };
    return enhanced;
  });

  // Save as enhanced settings
  const enhancedSettings = {
    profiles: enhancedProfiles,
    activeProfileId: legacySettings.activeProfileId,
    enableFallback: legacySettings.enableFallback,
    fallbackProfileIds: [],
    selectionStrategy: 'FastestFirst' as const,
    autoHealthCheck: true,
    healthCheckInterval: 30,
  };

  enhancedAIService.saveSettings(enhancedSettings);
}

/**
 * Compatibility wrapper for legacy aiService API
 */
export const aiService = {
  getConfig: (): AISettings => {
    // Try to get legacy settings first
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      return JSON.parse(stored);
    }
    
    const legacy = localStorage.getItem('ai_config');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: AIProfile = {
        id: 'migrated-profile',
        name: 'Пользовательский ИИ',
        provider: parsed.provider || 'gemini',
        apiKey: parsed.apiKey,
        baseUrl: parsed.baseUrl,
        modelName: parsed.modelName || 'gemini-3.1-pro-preview'
      };
      const settings = {
        profiles: [migrated],
        activeProfileId: 'migrated-profile',
        enableFallback: true
      };
      localStorage.setItem('ai_settings', JSON.stringify(settings));
      return settings;
    }

    // Default fallback
    const defaultProfile: AIProfile = {
      id: 'default-gemini',
      name: 'Google Gemini (По умолчанию)',
      provider: 'gemini',
      apiKey: DEFAULT_GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      modelName: 'gemini-2.0-flash'
    };

    return {
      profiles: [defaultProfile],
      activeProfileId: 'default-gemini',
      enableFallback: true
    };
  },

  setConfig: (settings: AISettings) => {
    localStorage.setItem('ai_settings', JSON.stringify(settings));
    // Also migrate to enhanced
    migrateToEnhanced(settings);
  },

  prepareDiagnosisPrompt: (patientData: any, documents: any[] = []) => {
    let customSystemPrompt = '';
    try {
      const storedPrompts = localStorage.getItem('onco_prompts');
      if (storedPrompts) {
        const prompts = JSON.parse(storedPrompts);
        if (prompts.length > 0 && prompts[0].content) {
          customSystemPrompt = prompts[0].content;
        }
      }
    } catch {}

    const systemPrompt = customSystemPrompt || `You are an expert oncologist assistant operating under the jurisdiction of the Russian Federation.
You strictly adhere to the Clinical Recommendations (CR RF) approved by the Ministry of Health.`;

    const safePatientData = { ...patientData };
    if (safePatientData.patient) {
      safePatientData.patient = {
        ...safePatientData.patient,
        full_name: "Patient X",
        phone: "[REDACTED]",
        address: "[REDACTED]",
        birth_date: safePatientData.patient.birth_date ? safePatientData.patient.birth_date.substring(0, 4) : "Unknown"
      };
    }

    const optimizedData = removeEmptyFields(safePatientData);

    let prompt = `
${systemPrompt}

Analyze the following patient data and formulate a Working Diagnosis.

Patient Data:
${JSON.stringify(optimizedData, null, 2)}
    `;

    if (documents && documents.length > 0) {
      prompt += `\n\nAttached Medical Documents:\n`;
      documents.forEach((doc, index) => {
        if (doc.type === 'text') {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n${doc.content}\n`;
        } else {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n[Image Content Attached]\n`;
        }
      });
    }

    prompt += `
INSTRUCTIONS:
1. Formulate the "working_diagnosis" to include the primary oncological diagnosis.
2. Include any comorbidities (concomitant diseases) listed in the anamnesis as part of the full diagnosis structure, following ICD-10 standards.
3. Identify and list any complications of the primary disease if the data suggests them.
4. CRITICAL: ALL TEXT VALUES IN THE JSON RESPONSE MUST BE IN RUSSIAN LANGUAGE (РУССКИЙ ЯЗЫК).
5. IMPORTANT: при первом упоминании медицинского сокращения укажите расшифровку в скобках.

Provide the output in the following JSON format:
{
  "working_diagnosis": "Full text of the diagnosis including primary disease, TNM, complications, and comorbidities",
  "icd10": "Primary Code (e.g. C50.4)",
  "tnm": "TNM staging (if applicable, otherwise null)",
  "reasoning": "Explanation of why this diagnosis was chosen based on the data",
  "confidence": "High/Medium/Low",
  "missing_data": ["List of specific tests required to confirm diagnosis according to CR RF"],
  "is_final": false
}

Do not use Markdown formatting in the response, just raw JSON.
    `;

    return prompt;
  },

  prepareTreatmentPrompt: (diagnosisData: any, patientData: any, documents: any[] = []) => {
    let customSystemPrompt = '';
    try {
      const storedPrompts = localStorage.getItem('onco_prompts');
      if (storedPrompts) {
        const prompts = JSON.parse(storedPrompts);
        if (prompts.length > 0 && prompts[0].content) {
          customSystemPrompt = prompts[0].content;
        }
      }
    } catch {}

    const systemPrompt = customSystemPrompt || `You are an expert oncologist assistant operating under the jurisdiction of the Russian Federation.`;

    const safePatientData = { ...patientData };
    if (safePatientData.patient) {
      safePatientData.patient = {
        ...safePatientData.patient,
        full_name: "Patient X",
        phone: "[REDACTED]",
        address: "[REDACTED]",
        birth_date: safePatientData.patient.birth_date ? safePatientData.patient.birth_date.substring(0, 4) : "Unknown"
      };
    }

    const optimizedPatientData = removeEmptyFields(safePatientData);
    const optimizedDiagnosis = removeEmptyFields(diagnosisData);

    let prompt = `
${systemPrompt}
Based on the confirmed diagnosis and patient data, outline the treatment plan according to CR RF.

Diagnosis: ${JSON.stringify(optimizedDiagnosis)}
Patient Context: ${JSON.stringify(optimizedPatientData)}
    `;

    if (documents && documents.length > 0) {
      prompt += `\n\nAttached Medical Documents:\n`;
      documents.forEach((doc, index) => {
        if (doc.type === 'text') {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n${doc.content}\n`;
        } else {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n[Image Content Attached]\n`;
        }
      });
    }

    prompt += `
INSTRUCTIONS:
1. Propose a treatment strategy (Curative/Palliative/Symptomatic).
2. Define the primary treatment (Surgery, Chemotherapy, Radiation, etc.).
3. Specify the regimen/protocol if applicable.
4. CRITICAL: Check for CONTRAINDICATIONS based on patient comorbidities and condition.
5. CRITICAL: Check for DRUG-DRUG INTERACTIONS.
6. If contraindications found, list them in "warnings" field.
7. Provide DETAILED PRESCRIPTION LIST with all details.
8. CRITICAL: ALL TEXT VALUES IN JSON MUST BE IN RUSSIAN (РУССКИЙ ЯЗЫК).
9. IMPORTANT: при первом упоминании медицинского сокращения укажите расшифровку в скобках.

Provide output in JSON format with treatment_strategy, primary_treatment, regimen, prescriptions, recommendations, warnings, cr_source.
Do not use Markdown, just raw JSON.
    `;

    return prompt;
  },

  getFinalExecutionPrompt: (prompt: string) => {
    syncProfilesFromService();
    const schema = inferStructuredSchema(prompt);
    const activeProfile = enhancedAIService.getActiveProfile();
    const responseFormat: StructuredResponseFormat =
      shouldUseXmlResponseFormat(activeProfile, schema) ? 'xml' : 'json';

    return responseFormat === 'xml'
      ? buildStrictXmlPrompt(prompt, schema)
      : buildStrictJsonPrompt(prompt);
  },

  appendRawResponseRetryContext: (
    prompt: string,
    section: RetrySourceSection,
    rawResponse: string,
    options: { provider?: string; previousError?: string } = {},
  ) => {
    return appendRawResponseRetryContext(prompt, section, rawResponse, options);
  },

  executeRawPrompt: async (prompt: string, documents: any[] = []) => {
    try {
      await refreshActiveOpenRouterProfileMetadata();

      // Sync profiles from profileService before generating content
      syncProfilesFromService();

      const schema = inferStructuredSchema(prompt);
      const activeProfile = enhancedAIService.getActiveProfile();
      const responseFormat: StructuredResponseFormat =
        shouldUseXmlResponseFormat(activeProfile, schema) ? 'xml' : 'json';
      const strictPrompt = aiService.getFinalExecutionPrompt(prompt);

      const response = await enhancedAIService.generateContent(strictPrompt, undefined, {
        type: schema === 'treatment' ? 'treatment' : documents.length > 0 ? 'complex_analysis' : 'diagnosis',
        requiresJSON: responseFormat === 'json',
        priority: 'reliability',
        preferredProfileId: activeProfile?.id,
        timestamp: new Date(),
      });
      
      if (!response.isSuccessful) {
        throw new Error(response.error || 'AI generation failed');
      }

      const content = response.content || '';
      if (!content.trim()) {
        throw new Error('Empty AI response');
      }

      try {
        const parsed =
          responseFormat === 'xml'
            ? parseAiXmlResponse(content, schema)
            : parseAiJsonResponse(content);
        return attachAiDebugMetadata(annotateAbbreviations(parsed), {
          rawResponse: content,
          rawResponseFormat: responseFormat,
          rawProvider: response.provider,
          rawResponseTime: response.responseTime,
          wasRepaired: false,
        });
      } catch (parseError) {
        console.warn(
          `Primary AI response returned invalid ${responseFormat.toUpperCase()}, attempting repair pass...`,
        );
        console.warn(`Invalid ${responseFormat.toUpperCase()} preview:`, content.slice(0, 300));

        const debugMetadata: AiDebugMetadata = {
          rawResponse: content,
          rawResponseFormat: responseFormat,
          rawProvider: response.provider,
          rawResponseTime: response.responseTime,
          wasRepaired: true,
        };

        try {
          const repaired =
            responseFormat === 'xml'
              ? await repairInvalidXmlResponse(strictPrompt, content, schema)
              : await repairInvalidJsonResponse(strictPrompt, content);
          return attachAiDebugMetadata(annotateAbbreviations(repaired), debugMetadata);
        } catch (repairError) {
          const repairMessage =
            repairError instanceof Error && repairError.message
              ? repairError.message
              : `Failed to parse AI ${responseFormat.toUpperCase()} response`;
          throw createAiExecutionError(repairMessage, debugMetadata);
        }
      }
    } catch (error: any) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(error?.message || 'Failed to execute prompt');
    }
  },

  diagnose: async (patientData: any) => {
    const prompt = aiService.prepareDiagnosisPrompt(patientData);
    return await aiService.executeRawPrompt(prompt);
  },

  recommendTreatment: async (diagnosisData: any, patientData: any) => {
    const prompt = aiService.prepareTreatmentPrompt(diagnosisData, patientData);
    return await aiService.executeRawPrompt(prompt);
  },

  /**
   * Diagnose provider configuration issues
   */
  diagnostProvider: async (profileId: string) => {
    syncProfilesFromService();
    return await enhancedAIService.diagnosProvider(profileId);
  },

  /**
   * Test a single provider
   */
  testProvider: async (profileId: string) => {
    syncProfilesFromService();
    return await enhancedAIService.testProvider(profileId);
  },

  syncProviderRuntime: () => {
    syncProfilesFromService();
  },
};

// Initialize migration if needed
if (typeof window !== 'undefined' && localStorage) {
  const legacySettings = aiService.getConfig();
  migrateToEnhanced(legacySettings);
}
