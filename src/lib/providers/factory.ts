/**
 * Provider Factory
 * Creates provider adapter instances based on configuration
 */

import { EnhancedAIProfile, ProviderType } from './types';
import { AIProviderAdapter } from './adapter';
import { GeminiAdapter } from './adapters/gemini';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';

export class ProviderFactory {
  /**
   * Create an adapter instance for the given provider profile
   */
  static createAdapter(profile: EnhancedAIProfile): AIProviderAdapter {
    switch (profile.providerType) {
      case 'gemini':
        return new GeminiAdapter(profile);
      
      case 'openai_compatible':
      case 'deepseek':
      case 'qwen':
      case 'openrouter':
        // All OpenAI-compatible APIs use the same adapter
        return new OpenAIAdapter(profile);
      
      case 'anthropic':
        return new AnthropicAdapter(profile);
      
      case 'gigachat':
      case 'alice':
      case 'aitunnel':
        // These are specialized providers - for now using OpenAI adapter as fallback
        // TODO: Implement specialized adapters
        console.warn(`Adapter for ${profile.providerType} not yet implemented, using OpenAI adapter`);
        return new OpenAIAdapter(profile);
      
      case 'local':
        // Local models through Ollama/LM Studio
        // TODO: Implement local model adapter
        console.warn('Local model adapter not yet implemented');
        throw new Error('Local model adapter not yet available');
      
      default:
        throw new Error(`Unknown provider type: ${profile.providerType}`);
    }
  }

  /**
   * Get provider configuration template for a given type
   */
  static getProviderTemplate(providerType: ProviderType): Partial<EnhancedAIProfile> {
    const baseMetrics = {
      successCount: 0,
      failureCount: 0,
      isHealthy: true,
    };

    const baseCapabilities = {
      supportsImages: false,
      supportsJSON: false,
      supportsSystemPrompt: true,
      supportsVision: false,
      maxTokens: 4000,
      contextWindow: 128000,
    };

    const templates: Record<ProviderType, Partial<EnhancedAIProfile>> = {
      'gemini': {
        providerType: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        modelName: 'gemini-2.0-flash',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsImages: true,
          supportsVision: true,
          maxTokens: 8192,
          contextWindow: 1000000,
        },
        priority: 8,
        preferredPromptFormat: 'gemini',
      },
      'openai_compatible': {
        providerType: 'openai_compatible',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4-turbo',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsImages: true,
          supportsJSON: true,
          supportsVision: true,
          maxTokens: 4096,
          contextWindow: 128000,
        },
        priority: 9,
        preferredPromptFormat: 'openai',
      },
      'anthropic': {
        providerType: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        modelName: 'claude-3-sonnet-20240229',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsImages: true,
          supportsJSON: true,
          supportsVision: true,
          maxTokens: 4096,
          contextWindow: 200000,
        },
        priority: 9,
        preferredPromptFormat: 'anthropic',
      },
      'deepseek': {
        providerType: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsJSON: true,
          maxTokens: 4096,
          contextWindow: 128000,
        },
        priority: 6,
        preferredPromptFormat: 'openai',
      },
      'qwen': {
        providerType: 'qwen',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        modelName: 'qwen-max',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsJSON: true,
          maxTokens: 4096,
          contextWindow: 200000,
        },
        priority: 6,
        preferredPromptFormat: 'openai',
      },
      'gigachat': {
        providerType: 'gigachat',
        baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
        modelName: 'GigaChat',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsImages: true,
          supportsVision: true,
          maxTokens: 4096,
          contextWindow: 128000,
        },
        priority: 5,
        preferredPromptFormat: 'openai',
      },
      'alice': {
        providerType: 'alice',
        baseUrl: '',  // Yandex Alice API endpoint - TBD
        modelName: 'alice',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          maxTokens: 2048,
          contextWindow: 128000,
        },
        priority: 4,
        preferredPromptFormat: 'generic',
      },
      'openrouter': {
        providerType: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'openai/gpt-4-turbo',
        metrics: baseMetrics,
        capabilities: {
          ...baseCapabilities,
          supportsImages: true,
          supportsJSON: true,
          supportsVision: true,
          maxTokens: 4096,
          contextWindow: 128000,
        },
        priority: 7,
        preferredPromptFormat: 'openai',
      },
      'aitunnel': {
        providerType: 'aitunnel',
        baseUrl: 'https://api.aitunnel.net/v1',
        modelName: 'default',
        metrics: baseMetrics,
        capabilities: baseCapabilities,
        priority: 5,
        preferredPromptFormat: 'openai',
      },
      'local': {
        providerType: 'local',
        baseUrl: 'http://localhost:11434',
        modelName: 'mistral',
        metrics: baseMetrics,
        capabilities: baseCapabilities,
        priority: 3,
        preferredPromptFormat: 'generic',
      },
    };

    return templates[providerType] || {};
  }

  /**
   * List all supported provider types
   */
  static getSupportedProviders(): ProviderType[] {
    return [
      'gemini',
      'openai_compatible',
      'anthropic',
      'deepseek',
      'qwen',
      'gigachat',
      'alice',
      'openrouter',
      'aitunnel',
      'local',
    ];
  }

  /**
   * Get human-readable provider name
   */
  static getProviderLabel(providerType: ProviderType): string {
    const labels: Record<ProviderType, string> = {
      'gemini': 'Google Gemini',
      'openai_compatible': 'OpenAI-Compatible',
      'anthropic': 'Anthropic Claude',
      'deepseek': 'DeepSeek',
      'qwen': 'Alibaba QWEN',
      'gigachat': 'Sberbank GigaChat',
      'alice': 'Yandex Alice',
      'openrouter': 'OpenRouter',
      'aitunnel': 'AITunnel',
      'local': 'Local Model (Ollama/LM Studio)',
    };
    return labels[providerType] || providerType;
  }
}
