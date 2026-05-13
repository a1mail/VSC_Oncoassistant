import { OpenRouterModelInfo } from './types';

type OpenRouterApiModel = {
  id: string;
  canonical_slug?: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
  supported_parameters?: string[];
  top_provider?: {
    max_completion_tokens?: number;
    context_length?: number;
  };
};

type OpenRouterModelsResponse = {
  data?: OpenRouterApiModel[];
};

const CACHE_KEY = 'openrouter_model_registry_cache_v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

type OpenRouterCacheRecord = {
  fetchedAt: string;
  models: Record<string, OpenRouterModelInfo>;
};

function getEmptyCacheRecord(): OpenRouterCacheRecord {
  return {
    fetchedAt: new Date(0).toISOString(),
    models: {},
  };
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readCacheRecord(): OpenRouterCacheRecord {
  if (!isBrowserRuntime()) {
    return getEmptyCacheRecord();
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return getEmptyCacheRecord();
    }

    const parsed = JSON.parse(raw) as OpenRouterCacheRecord;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.fetchedAt !== 'string' || !parsed.models) {
      return getEmptyCacheRecord();
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to read OpenRouter model cache:', error);
    return getEmptyCacheRecord();
  }
}

function writeCacheRecord(record: OpenRouterCacheRecord): void {
  if (!isBrowserRuntime()) {
    return;
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Failed to write OpenRouter model cache:', error);
  }
}

function isCacheFresh(record: OpenRouterCacheRecord): boolean {
  const fetchedAt = Date.parse(record.fetchedAt);
  if (!Number.isFinite(fetchedAt)) {
    return false;
  }

  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function toNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanFlag(value: boolean): boolean {
  return value;
}

function buildModelInfo(model: OpenRouterApiModel): OpenRouterModelInfo {
  const supportedParameters = new Set(model.supported_parameters || []);
  const promptPrice = toNumber(model.pricing?.prompt);
  const completionPrice = toNumber(model.pricing?.completion);
  const description = (model.description || '').toLowerCase();
  const modelId = model.id.toLowerCase();
  const isFreeTier =
    modelId.includes(':free') ||
    (promptPrice !== null && completionPrice !== null && promptPrice === 0 && completionPrice === 0);
  const supportsResponseFormat = supportedParameters.has('response_format');
  const supportsStructuredOutputs = supportedParameters.has('structured_outputs');
  const supportsReasoning = supportedParameters.has('reasoning');
  const supportsIncludeReasoning = supportedParameters.has('include_reasoning');
  const isReasoningModel =
    supportsReasoning ||
    supportsIncludeReasoning ||
    /reasoning|think|thinking|chain-of-thought/.test(description);
  const maxCompletionTokens = model.top_provider?.max_completion_tokens;
  const contextLength = model.top_provider?.context_length || model.context_length;
  const canUseStableJson = (supportsResponseFormat || supportsStructuredOutputs) && !isFreeTier && !isReasoningModel;

  return {
    modelId: model.id,
    canonicalSlug: model.canonical_slug,
    isFreeTier: toBooleanFlag(isFreeTier),
    supportsResponseFormat: toBooleanFlag(supportsResponseFormat),
    supportsStructuredOutputs: toBooleanFlag(supportsStructuredOutputs),
    supportsReasoning: toBooleanFlag(supportsReasoning),
    supportsIncludeReasoning: toBooleanFlag(supportsIncludeReasoning),
    isReasoningModel: toBooleanFlag(isReasoningModel),
    maxCompletionTokens,
    contextLength,
    preferredStructuredFormat: canUseStableJson ? 'json' : 'xml',
    recommendedMaxTokens: Math.max(
      512,
      Math.min(
        maxCompletionTokens || 2200,
        isFreeTier ? 900 : isReasoningModel ? 1400 : 2200,
      ),
    ),
    pricing: {
      prompt: model.pricing?.prompt,
      completion: model.pricing?.completion,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function fetchAndCacheOpenRouterModels(): Promise<OpenRouterCacheRecord> {
  const response = await fetch(OPENROUTER_MODELS_URL, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`OpenRouter model registry request failed: ${response.status}`);
  }

  const payload = (await response.json()) as OpenRouterModelsResponse;
  const models = Array.isArray(payload.data) ? payload.data : [];
  const mappedModels = models.reduce<Record<string, OpenRouterModelInfo>>((acc, model) => {
    acc[model.id] = buildModelInfo(model);
    return acc;
  }, {});

  const cacheRecord: OpenRouterCacheRecord = {
    fetchedAt: new Date().toISOString(),
    models: mappedModels,
  };

  writeCacheRecord(cacheRecord);
  return cacheRecord;
}

/**
 * Uses the OpenRouter public model registry to classify model behavior and
 * cache capabilities locally, so routing decisions do not depend on brittle name heuristics.
 */
export async function getOpenRouterModelInfo(
  modelId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<OpenRouterModelInfo | null> {
  const normalizedModelId = modelId.trim();
  if (!normalizedModelId) {
    return null;
  }

  const cacheRecord = readCacheRecord();
  const cachedModel = cacheRecord.models[normalizedModelId];
  const shouldUseCache = !options.forceRefresh && cachedModel && isCacheFresh(cacheRecord);
  if (shouldUseCache) {
    return cachedModel;
  }

  try {
    const refreshed = await fetchAndCacheOpenRouterModels();
    return refreshed.models[normalizedModelId] || null;
  } catch (error) {
    console.warn('Failed to refresh OpenRouter model metadata:', error);
    return cachedModel || null;
  }
}
