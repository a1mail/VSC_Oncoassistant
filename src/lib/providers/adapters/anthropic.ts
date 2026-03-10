/**
 * Anthropic Claude Provider Adapter
 */

import { EnhancedAIProfile, AIResponse, HealthCheckResult } from '../types';
import { BaseProviderAdapter, GenerationOptions } from '../adapter';

export class AnthropicAdapter extends BaseProviderAdapter {
  private baseUrl: string = 'https://api.anthropic.com/v1';
  private apiKey: string;
  private apiVersion: string = '2023-06-01';

  constructor(profile: EnhancedAIProfile) {
    super(profile);
    this.apiKey = profile.apiKey || '';
    this.baseUrl = profile.baseUrl || this.baseUrl;
    this.apiVersion = profile.apiVersion || this.apiVersion;
  }

  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: GenerationOptions = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();
    try {
      const payload = {
        model: this.profile.modelName,
        max_tokens: options.maxTokens ?? this.profile.capabilities.maxTokens,
        system: systemPrompt || this.profile.systemPromptTemplate,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.95,
      };

      const response = await this.retryWithBackoff(
        () => this.makeRequest('/messages', payload),
        options.retryCount ?? 3,
        options.retryDelay ?? 1000
      );

      if (!response.content || response.content.length === 0) {
        throw new Error('No response content from API');
      }

      const responseText = response.content[0].text;
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

      const tokensUsed = (response.usage?.input_tokens || 0) + 
        (response.usage?.output_tokens || 0) ||
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
      // Test with a simple message
      await this.makeRequest('/messages', {
        model: this.profile.modelName,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Test',
          },
        ],
      });

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
    // Anthropic Claude pricing (approximate)
    // Claude 3 Opus: $15 per 1M input tokens, $75 per 1M output tokens
    // Claude 3 Sonnet: $3 per 1M input tokens, $15 per 1M output tokens
    const inputTokens = this.estimateTokens(prompt);
    const estimatedOutputTokens = Math.ceil(inputTokens * 1.5);

    // Using Sonnet pricing as reference
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 15;

    return inputCost + outputCost;
  }

  async getCapabilities() {
    return this.profile.capabilities;
  }

  async validateConfiguration(): Promise<boolean> {
    if (!this.apiKey || !this.profile.modelName) {
      return false;
    }

    const result = await this.testConnection();
    return result.isHealthy;
  }

  private async makeRequest(endpoint: string, payload: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.apiVersion,
    };

    if (this.profile.customHeaders) {
      Object.assign(headers, this.profile.customHeaders);
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API Error ${response.status}: ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    return response.json();
  }
}
