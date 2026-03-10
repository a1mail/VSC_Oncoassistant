/**
 * Google Gemini Provider Adapter
 */

import { GoogleGenAI } from "@google/genai";
import { EnhancedAIProfile, AIResponse, HealthCheckResult } from '../types';
import { BaseProviderAdapter, GenerationOptions } from '../adapter';

export class GeminiAdapter extends BaseProviderAdapter {
  private client: GoogleGenAI | null = null;

  constructor(profile: EnhancedAIProfile) {
    super(profile);
    this.initializeClient();
  }

  private initializeClient() {
    if (!this.profile.apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.client = new GoogleGenAI({
      apiKey: this.profile.apiKey,
    });
  }

  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: GenerationOptions = {}
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    const startTime = Date.now();
    try {
      const result = await this.retryWithBackoff(
        () => this.client!.models.generateContent({
          model: this.profile.modelName,
          contents: [{ parts: [{ text: prompt }] }],
        } as any),
        options.retryCount ?? 3,
        options.retryDelay ?? 1000
      );

      const responseText = (result as any).text?.() || (result as any).candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      await this.client.models.generateContent({
        model: this.profile.modelName,
        contents: [{ parts: [{ text: 'Test connection - respond with "OK"' }] }],
      } as any);

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
