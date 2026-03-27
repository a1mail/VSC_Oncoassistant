/**
 * OpenAI-Compatible Provider Adapter
 * Works with OpenAI, Azure OpenAI, DeepSeek, and other OpenAI-compatible APIs
 */

import { EnhancedAIProfile, AIResponse, HealthCheckResult } from '../types';
import { BaseProviderAdapter, GenerationOptions } from '../adapter';

export class OpenAIAdapter extends BaseProviderAdapter {
  private baseUrl: string;
  private apiKey: string;
  private organizationId?: string;

  constructor(profile: EnhancedAIProfile) {
    super(profile);
    // Trim trailing slashes from baseUrl to prevent duplication
    this.baseUrl = (profile.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = profile.apiKey || '';
    this.organizationId = profile.organizationId;
    
    console.log(`\n🔧 OpenAI Adapter Initialized:`);
    console.log(`   Provider: ${profile.name}`);
    console.log(`   Original base URL: ${profile.baseUrl}`);
    console.log(`   Normalized base URL: ${this.baseUrl}`);
    console.log(`   Model: ${profile.modelName}`);
    console.log(`   API Key: ${this.apiKey ? '***' + this.apiKey.slice(-4) : 'MISSING'}\n`);
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

      const payload = {
        model: this.profile.modelName,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.profile.capabilities.maxTokens,
        top_p: options.topP ?? 0.95,
        frequency_penalty: options.frequency_penalty ?? 0,
        presence_penalty: options.presence_penalty ?? 0,
      };

      const response = await this.retryWithBackoff(
        () => this.makeRequest('/chat/completions', payload),
        options.retryCount ?? 3,
        options.retryDelay ?? 1000
      );

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response content from API');
      }

      const responseText = response.choices[0].message.content;
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
    payload: any = {},
    method: string = 'POST'
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    if (this.profile.customHeaders) {
      Object.assign(headers, this.profile.customHeaders);
    }

    const url = `${this.baseUrl}${endpoint}`;
    console.log(`\n🔗 OpenAI Adapter API Request:`);
    console.log(`   Method: ${method}`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Full URL: ${url}`);
    console.log(`   Headers: ${JSON.stringify(Object.keys(headers))}`);
    
    const options: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET') {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error(`❌ API Error ${response.status}: ${errorMsg}`);
      console.error(`   Requested URL: ${url}`);
      console.error(`   Response body:`, errorData);
      throw new Error(
        `API Error ${response.status}: ${errorMsg}`
      );
    }

    return response.json();
  }
}
