/**
 * OpenAI-Compatible Provider Adapter
 * Works with OpenAI, Azure OpenAI, DeepSeek, and other OpenAI-compatible APIs
 */

import { EnhancedAIProfile, AIResponse, HealthCheckResult } from '../types';
import { BaseProviderAdapter, GenerationOptions } from '../adapter';
import { normalizeApiKey } from '@/lib/utils/apiKeyUtils';

interface OpenAIContentPart {
  type?: string;
  text?: string;
  content?: string;
}

interface OpenAIChoice {
  message?: {
    content?: string | OpenAIContentPart[];
    reasoning?: string;
  };
  text?: string;
  finish_reason?: string;
  stop_reason?: string;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  output_text?: string;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  error?: { code?: string; message?: string };
}

export class OpenAIAdapter extends BaseProviderAdapter {
  private baseUrl: string;
  private apiKey: string;
  private organizationId?: string;
  private static readonly MAX_CONTINUATION_ATTEMPTS = 2;
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
  private static readonly EXTENDED_REQUEST_TIMEOUT_MS = 180_000;
  private static readonly MAX_TOKENS_FREE = 900;
  private static readonly MAX_TOKENS_STRUCTURED = 3200;
  private static readonly MAX_TOKENS_CONTINUATION = 1800;
  private static readonly MIN_RESPONSE_LENGTH_FOR_CONTINUE = 120;
  private static readonly OVERLAP_SEARCH_LIMIT = 200;
  private static readonly OVERLAP_MIN_SIZE = 20;
  private static readonly RETRY_JITTER_MS = 450;
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly STRUCTURED_TEMPERATURE = 0.15;
  private static readonly FREE_MODEL_TEMPERATURE = 0.2;

  /**
   * Some OpenRouter free/preview models are unstable with strict OpenAI JSON mode
   * or optional tuning parameters. We progressively simplify the payload.
   */
  private static readonly STRUCTURED_OUTPUT_HINT =
    /STRICT OUTPUT RULES|Return exactly one valid JSON object|Provide the output in the following JSON format|Provide output in JSON format/i;

  /**
   * OpenRouter free endpoints are often burst-limited. We use slightly
   * slower backoff with jitter and smaller payloads to improve success rate.
   */
  private static readonly OPENROUTER_FREE_RETRY_DELAYS_MS = [1800, 4200, 8200];

  constructor(profile: EnhancedAIProfile) {
    super(profile);
    // Trim trailing slashes from baseUrl to prevent duplication
    this.baseUrl = (profile.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = normalizeApiKey(profile.apiKey || '');
    this.organizationId = profile.organizationId;
  }

  private isOpenRouterProfile(): boolean {
    return this.profile.providerType === 'openrouter' || this.baseUrl.includes('openrouter.ai');
  }

  private getRequestTimeoutMs(): number {
    const modelName = this.profile.modelName.toLowerCase();
    if (this.profile.providerType === 'aitunnel' && modelName.includes('gpt-5.5-pro')) {
      return OpenAIAdapter.EXTENDED_REQUEST_TIMEOUT_MS;
    }

    return OpenAIAdapter.DEFAULT_REQUEST_TIMEOUT_MS;
  }

  private getOpenRouterModelInfo() {
    return this.isOpenRouterProfile() ? this.profile.openRouterModelInfo : undefined;
  }

  private isLegacyFragileOpenRouterModel(): boolean {
    const model = this.profile.modelName.toLowerCase();
    return (
      model.includes(':free') ||
      model.includes('preview') ||
      model.includes('tencent/') ||
      model.includes('minimax/') ||
      model.includes('glm-') ||
      model.includes('qwen3-next')
    );
  }

  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: GenerationOptions = {}
  ): Promise<AIResponse> {
    // Validate configuration before attempting API call
    if (!this.apiKey || this.apiKey.trim() === '') {
      return {
        isSuccessful: false,
        error: `${this.profile.name}: API key is missing or empty. Please configure the provider settings.`,
        content: '',
        provider: this.profile.name,
        responseTime: 0,
      };
    }

    if (!this.baseUrl || this.baseUrl.trim() === '') {
      return {
        isSuccessful: false,
        error: `${this.profile.name}: Base URL is missing. Please configure the provider settings.`,
        content: '',
        provider: this.profile.name,
        responseTime: 0,
      };
    }

    const startTime = Date.now();
    try {
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      const requestStrategy = this.getStructuredOutputStrategy(prompt);
      const payloadVariants = this.buildPayloadVariants(messages, options, requestStrategy);
      let response: OpenAIResponse | undefined;
      let lastError: unknown;

      for (const variant of payloadVariants) {
        try {
          response = await this.executeVariantWithRetries(variant);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          const canFallbackToSimplerPayload =
            variant.canFallback &&
            this.isCompatibleWithSimplerPayload(message);

          if (!canFallbackToSimplerPayload) {
            throw error;
          }
        }
      }

      if (!response) {
        throw (lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown request failure')));
      }

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response content from API');
      }

      let responseText = this.extractResponseText(response);
      if (!responseText) {
        throw new Error('No textual response content from API');
      }

      let continuationAttempts = 0;
      while (
        continuationAttempts < OpenAIAdapter.MAX_CONTINUATION_ATTEMPTS &&
        this.shouldAutoContinueResponse(response, responseText)
      ) {
        continuationAttempts += 1;
        const continuationResult = await this.continueTruncatedResponse(
          messages,
          responseText,
          options,
          requestStrategy,
        );
        responseText = continuationResult.text;
        response = {
          ...response,
          choices: [
            {
              ...(response.choices?.[0] || {}),
              finish_reason: continuationResult.finishReason ?? 'stop',
            },
          ],
        };
      }
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.profile.metrics.successCount++;
      this.profile.metrics.lastUsed = new Date();
      this.profile.metrics.lastResponseTime = responseTime;
      if (!this.profile.metrics.averageResponseTime) {
        this.profile.metrics.averageResponseTime = responseTime;
      } else {
        this.profile.metrics.averageResponseTime = 
          (this.profile.metrics.averageResponseTime + responseTime) / 2;
      }

      const tokensUsed = (response.usage?.total_tokens) || 
        (this.estimateTokens(prompt) + this.estimateTokens(responseText));
      const estimatedCost = await this.estimateCost(prompt);

      return {
        content: responseText,
        provider: this.profile.name,
        responseTime,
        tokensUsed,
        estimatedCost,
        isSuccessful: true,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.profile.metrics.failureCount++;
      this.profile.metrics.isHealthy = false;

      return {
        content: '',
        provider: this.profile.name,
        responseTime,
        isSuccessful: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async testConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.makeRequest('/models', {}, 'GET');

      const responseTime = Date.now() - startTime;
      this.profile.metrics.isHealthy = true;
      this.profile.metrics.lastHealthCheck = new Date();

      return {
        provider: this.profile.name,
        isHealthy: true,
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.profile.metrics.isHealthy = false;
      this.profile.metrics.lastHealthCheck = new Date();

      return {
        provider: this.profile.name,
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Connection test failed',
        timestamp: new Date(),
      };
    }
  }

  async estimateCost(prompt: string): Promise<number> {
    // OpenAI pricing estimates (varies by model)
    // Using GPT-4 pricing as reference
    const inputTokens = this.estimateTokens(prompt);
    const estimatedOutputTokens = Math.ceil(inputTokens * 1.5);

    // GPT-4: $0.03 per 1K input tokens, $0.06 per 1K output tokens
    // Adjust based on actual model pricing
    const inputCost = (inputTokens / 1000) * 0.03;
    const outputCost = (estimatedOutputTokens / 1000) * 0.06;

    return (inputCost + outputCost) / 1000; // Convert to reasonable scale
  }

  async getCapabilities() {
    return this.profile.capabilities;
  }

  async validateConfiguration(): Promise<boolean> {
    if (!this.apiKey || !this.baseUrl || !this.profile.modelName) {
      return false;
    }

    const result = await this.testConnection();
    return result.isHealthy;
  }

  private async makeRequest(
    endpoint: string,
    payload: Record<string, unknown> = {},
    method: string = 'POST'
  ): Promise<OpenAIResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    if (this.isOpenRouterProfile()) {
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      headers['HTTP-Referer'] = appOrigin;
      headers['X-Title'] = 'OncoAssistant';
    }

    if (this.profile.customHeaders) {
      Object.assign(headers, this.profile.customHeaders);
    }

    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const requestTimeoutMs = this.getRequestTimeoutMs();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (method !== 'GET') {
      options.body = JSON.stringify(payload);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText;
        const mappedError = this.mapApiError(response.status, errorMsg, errorData);
        throw new Error(mappedError);
      }

      return response.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request to ${this.profile.name} timed out after ${requestTimeoutMs / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getStructuredOutputStrategy(prompt: string): 'none' | 'native_json' | 'prompt_only' {
    const requiresStructuredJson = OpenAIAdapter.STRUCTURED_OUTPUT_HINT.test(prompt);
    if (!requiresStructuredJson) {
      return 'none';
    }

    const modelInfo = this.getOpenRouterModelInfo();
    if (modelInfo) {
      if (modelInfo.preferredStructuredFormat !== 'json') {
        return 'prompt_only';
      }

      return modelInfo.supportsResponseFormat ? 'native_json' : 'prompt_only';
    }

    if (this.isOpenRouterProfile() && this.isLegacyFragileOpenRouterModel()) {
      return 'prompt_only';
    }

    return this.profile.capabilities.supportsJSON ? 'native_json' : 'prompt_only';
  }

  private buildPayloadVariants(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: GenerationOptions,
    strategy: 'none' | 'native_json' | 'prompt_only',
  ): Array<{
    payload: Record<string, unknown>;
    canFallback: boolean;
    retries: number;
    retryDelay: number;
  }> {
    const safeMaxTokens = this.getSafeMaxTokens(options, strategy);
    const isOpenRouterFree = this.isOpenRouterFreeModel();
    const basePayload = {
      model: this.profile.modelName,
      messages,
      temperature: options.temperature ?? (strategy === 'none' ? (isOpenRouterFree ? OpenAIAdapter.FREE_MODEL_TEMPERATURE : OpenAIAdapter.DEFAULT_TEMPERATURE) : OpenAIAdapter.STRUCTURED_TEMPERATURE),
      max_tokens: safeMaxTokens,
    };

    const fullPayload = {
      ...basePayload,
      top_p: options.topP ?? 0.95,
      frequency_penalty: options.frequency_penalty ?? 0,
      presence_penalty: options.presence_penalty ?? 0,
      ...(strategy === 'native_json' ? { response_format: { type: 'json_object' as const } } : {}),
    };

    const compatPayload = {
      ...basePayload,
      ...(strategy === 'native_json' ? {} : { top_p: options.topP ?? (isOpenRouterFree ? 0.8 : 0.9) }),
    };

    const minimalPayload = { ...basePayload };

    if (strategy === 'none') {
      return [
        {
          payload: fullPayload,
          canFallback: true,
          retries: options.retryCount ?? (isOpenRouterFree ? 4 : 3),
          retryDelay: options.retryDelay ?? (isOpenRouterFree ? 1500 : 1000),
        },
        {
          payload: minimalPayload,
          canFallback: false,
          retries: isOpenRouterFree ? 2 : 1,
          retryDelay: isOpenRouterFree ? 1800 : 500,
        },
      ];
    }

    return [
      {
        payload: fullPayload,
        canFallback: true,
        retries: options.retryCount ?? (isOpenRouterFree ? 4 : 2),
        retryDelay: options.retryDelay ?? (isOpenRouterFree ? 1500 : 750),
      },
      {
        payload: compatPayload,
        canFallback: true,
        retries: isOpenRouterFree ? 3 : 2,
        retryDelay: isOpenRouterFree ? 1800 : 600,
      },
      {
        payload: minimalPayload,
        canFallback: false,
        retries: isOpenRouterFree ? 2 : 1,
        retryDelay: isOpenRouterFree ? 2200 : 500,
      },
    ];
  }

  private getSafeMaxTokens(
    options: GenerationOptions,
    strategy: 'none' | 'native_json' | 'prompt_only',
  ): number {
    const requested = options.maxTokens ?? this.profile.capabilities.maxTokens;
    const modelInfo = this.getOpenRouterModelInfo();

    if (modelInfo?.recommendedMaxTokens) {
      return Math.min(requested, modelInfo.recommendedMaxTokens);
    }

    if (strategy === 'none') {
      if (this.isOpenRouterFreeModel()) {
        return Math.min(requested, 900);
      }
      return requested;
    }

    if (this.isOpenRouterProfile() && this.isLegacyFragileOpenRouterModel()) {
      return Math.min(requested, 900);
    }

    return Math.min(requested, 3200);
  }

  private getFinishReason(response: OpenAIResponse): string {
    return String(
      response?.choices?.[0]?.finish_reason ||
      response?.choices?.[0]?.stop_reason ||
      '',
    ).toLowerCase();
  }

  /**
   * Paid/stable models often stop due to token limits while still producing valid content.
   * We resume generation only when the provider explicitly signals a length stop.
   */
  private shouldAutoContinueResponse(response: OpenAIResponse, responseText: string): boolean {
    if (this.isOpenRouterFreeModel()) {
      return false;
    }

    const finishReason = this.getFinishReason(response);
    if (!finishReason || !/(^length$|max_tokens|token limit)/i.test(finishReason)) {
      return false;
    }

    return responseText.trim().length > OpenAIAdapter.MIN_RESPONSE_LENGTH_FOR_CONTINUE;
  }

  private mergeContinuation(baseText: string, continuationText: string): string {
    const base = baseText.trimEnd();
    const continuation = continuationText.trimStart();
    const overlapLimit = Math.min(base.length, continuation.length, OpenAIAdapter.OVERLAP_SEARCH_LIMIT);

    for (let size = overlapLimit; size >= OpenAIAdapter.OVERLAP_MIN_SIZE; size -= 1) {
      if (base.slice(-size) === continuation.slice(0, size)) {
        return `${base}${continuation.slice(size)}`;
      }
    }

    return `${base}${continuation}`;
  }

  /**
   * Continues a response when the provider stopped at the token limit.
   * The assistant message anchors the already generated prefix so the model returns only the remainder.
   */
  private async continueTruncatedResponse(
    originalMessages: Array<{ role: 'system' | 'user'; content: string }>,
    partialText: string,
    options: GenerationOptions,
    strategy: 'none' | 'native_json' | 'prompt_only',
  ): Promise<{ text: string; finishReason: string | undefined }> {
    const continuationInstruction =
      strategy === 'none'
        ? 'Continue exactly from where you stopped. Return only the remaining text without repeating previous sentences.'
        : 'Continue exactly from where you stopped. Return only the missing tail of the same structured response without repeating any previously generated text.';

    const continuationMessages = [
      ...originalMessages,
      { role: 'assistant' as const, content: partialText },
      { role: 'user' as const, content: continuationInstruction },
    ];

    const continuationOptions: GenerationOptions = {
      ...options,
      maxTokens: Math.min(options.maxTokens ?? this.profile.capabilities.maxTokens, 1800),
      retryCount: Math.max(options.retryCount ?? 2, 2),
    };
    const variants = this.buildPayloadVariants(continuationMessages, continuationOptions, strategy);

    let continuationResponse: unknown;
    let lastError: unknown;

    for (const variant of variants) {
      try {
        continuationResponse = await this.executeVariantWithRetries(variant);
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (!(variant.canFallback && this.isCompatibleWithSimplerPayload(message))) {
          throw error;
        }
      }
    }

    if (!continuationResponse) {
      throw (lastError instanceof Error
        ? lastError
        : new Error(String(lastError || 'Failed to continue truncated response')));
    }

    const continuationText = this.extractResponseText(continuationResponse);
    const finishReason = this.getFinishReason(continuationResponse) || undefined;

    if (!continuationText) {
      return { text: partialText, finishReason };
    }

    return { text: this.mergeContinuation(partialText, continuationText), finishReason };
  }

  private isCompatibleWithSimplerPayload(message: string): boolean {
    return /response_format|json_object|json mode|unsupported|invalid_request_error|provider returned error|bad request|api error 400|top_p|frequency_penalty|presence_penalty|max_tokens/i.test(
      message,
    );
  }

  private isOpenRouterFreeModel(): boolean {
    const modelInfo = this.getOpenRouterModelInfo();
    if (modelInfo) {
      return modelInfo.isFreeTier;
    }

    return this.isOpenRouterProfile() && this.profile.modelName.toLowerCase().includes(':free');
  }

  private isTransientOpenRouterFreeError(message: string): boolean {
    return (
      this.isOpenRouterFreeModel() &&
      /api error 429|rate limit|too many requests|provider returned error|overloaded|temporarily unavailable/i.test(
        message,
      )
    );
  }

  private getRetryDelayMs(attempt: number, fallbackDelay: number): number {
    const baseDelay =
      this.isOpenRouterFreeModel() && attempt < OpenAIAdapter.OPENROUTER_FREE_RETRY_DELAYS_MS.length
        ? OpenAIAdapter.OPENROUTER_FREE_RETRY_DELAYS_MS[attempt]
        : fallbackDelay * Math.pow(2, attempt);

    const jitter = Math.floor(Math.random() * OpenAIAdapter.RETRY_JITTER_MS);
    return baseDelay + jitter;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTransientError(message: string): boolean {
    return /api error (429|502|503|504)|rate limit|too many requests|overloaded|temporarily unavailable|timed out/i.test(message);
  }

  private async executeVariantWithRetries(variant: {
    payload: Record<string, unknown>;
    canFallback: boolean;
    retries: number;
    retryDelay: number;
  }): Promise<OpenAIResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt < variant.retries; attempt++) {
      try {
        return await this.makeRequest('/chat/completions', variant.payload);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isTransient = this.isOpenRouterFreeModel()
          ? this.isTransientOpenRouterFreeError(message)
          : this.isTransientError(message);
        const canRetrySameVariant = attempt < variant.retries - 1 && isTransient;

        if (canRetrySameVariant) {
          const delay = this.getRetryDelayMs(attempt, variant.retryDelay);
          await this.wait(delay);
          continue;
        }

        throw error;
      }
    }

    throw (lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown request failure')));
  }

  private mapApiError(status: number, errorMsg: string, errorData: OpenAIResponse | null): string {
    const raw = typeof errorMsg === 'string' ? errorMsg : String(errorMsg || '');
    const isOpenRouter = this.isOpenRouterProfile();

    if (this.isOpenRouterFreeModel() && status === 429) {
      return `API Error 429: OpenRouter free model is temporarily rate-limited or overloaded. Retry in a few seconds, or let fallback switch to another free model.`;
    }

    if (this.isOpenRouterFreeModel() && status >= 500) {
      return `API Error ${status}: OpenRouter free model is temporarily unavailable. Please retry in a few seconds.`;
    }

    if (status === 401 && /missing authentication header/i.test(raw)) {
      return `API Error 401: Missing Authentication header`;
    }

    const providerCode = errorData?.error?.code;
    if (this.isOpenRouterFreeModel() && typeof providerCode === 'string' && /rate|limit|overload/i.test(providerCode)) {
      return `API Error ${status}: OpenRouter free model is temporarily rate-limited or overloaded.`;
    }

    if (isOpenRouter && status === 429) {
      return `API Error 429: OpenRouter provider is temporarily rate-limited or overloaded.`;
    }

    return `API Error ${status}: ${raw}`;
  }

  /**
   * Extracts text from OpenAI-compatible responses because some providers
   * return `message.content` as an array or put text into fallback fields.
   */
  private extractResponseText(response: OpenAIResponse): string {
    const choice = response?.choices?.[0];
    const message = choice?.message;
    const content = message?.content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const text = content
        .map((part: OpenAIContentPart | string) => {
          if (typeof part === 'string') return part;
          if (typeof part?.text === 'string') return part.text;
          if (typeof part?.content === 'string') return part.content;
          return '';
        })
        .join('\n')
        .trim();

      if (text) {
        return text;
      }
    }

    if (typeof message?.reasoning === 'string' && message.reasoning.trim()) {
      return message.reasoning.trim();
    }

    if (typeof choice?.text === 'string' && choice.text.trim()) {
      return choice.text.trim();
    }

    if (typeof response?.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    return '';
  }
}
