/**
 * Google Gemini Provider Adapter
 */

import { GoogleGenAI } from "@google/genai";
import { EnhancedAIProfile, AIResponse, HealthCheckResult } from '../types';
import { BaseProviderAdapter, GenerationOptions } from '../adapter';

type GeminiGenerateContentArgs = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GeminiGenerateContentResult = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[];
}

interface GeminiCandidate {
  content?: GeminiCandidateContent;
}

interface GeminiResponseLike {
  text?: () => string;
  candidates?: GeminiCandidate[];
}

export class GeminiAdapter extends BaseProviderAdapter {
  private client: GoogleGenAI | null = null;
  private initError: string | null = null;

  constructor(profile: EnhancedAIProfile) {
    super(profile);
    try {
      this.initializeClient();
    } catch (error) {
      // Не выбрасываем гружу, сохраняем ошибку
      this.initError = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[Gemini] Initialization warning: ${this.initError}`);
    }
  }

  private initializeClient() {
    if (!this.profile.apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.client = new GoogleGenAI({
      apiKey: this.profile.apiKey,
    });
  }

  private buildGenerateContentPayload(prompt: string): GeminiGenerateContentArgs {
    return {
      model: this.profile.modelName,
      contents: [{ parts: [{ text: prompt }] }],
    };
  }

  private extractResponseText(result: GeminiGenerateContentResult): string {
    const response = result as GeminiResponseLike;
    const directText = response.text?.();
    if (typeof directText === 'string' && directText.trim()) {
      return directText;
    }

    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: GenerationOptions = {}
  ): Promise<AIResponse> {
    // Проверка инициализации
    if (this.initError) {
      return {
        isSuccessful: false,
        error: `Gemini provider error: ${this.initError}`,
        provider: this.profile.name,
        responseTime: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    if (!this.client) {
      return {
        isSuccessful: false,
        error: 'Gemini client not initialized',
        provider: this.profile.name,
        responseTime: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    const startTime = Date.now();
    try {
      const result = await this.retryWithBackoff(
        () => this.client!.models.generateContent(this.buildGenerateContentPayload(prompt)),
        options.retryCount ?? 3,
        options.retryDelay ?? 1000
      );

      const responseText = this.extractResponseText(result);
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

      const tokensUsed = this.estimateTokens(prompt) + this.estimateTokens(responseText);
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
    if (!this.client) {
      return {
        provider: this.profile.name,
        isHealthy: false,
        responseTime: 0,
        error: 'Client not initialized',
        timestamp: new Date(),
      };
    }

    const startTime = Date.now();
    try {
      // Simple test prompt
      await this.client.models.generateContent(
        this.buildGenerateContentPayload('Test connection - respond with "OK"')
      );

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
    // Gemini pricing (approximate as of 2024)
    // Free tier: 60 requests/minute
    // Paid: $0.075 per 1M input tokens, $0.30 per 1M output tokens
    const inputTokens = this.estimateTokens(prompt);
    const estimatedOutputTokens = Math.ceil(inputTokens * 1.5); // Rough estimate
    
    const inputCost = (inputTokens / 1_000_000) * 0.075;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 0.30;
    
    return inputCost + outputCost;
  }

  async getCapabilities() {
    return this.profile.capabilities;
  }

  async validateConfiguration(): Promise<boolean> {
    if (!this.profile.apiKey) {
      return false;
    }
    
    const result = await this.testConnection();
    return result.isHealthy;
  }
}
