/**
 * Provider Types and Configuration
 * Defines the enhanced multi-provider AI system architecture
 */

// Supported AI provider types
export type ProviderType = 
  | 'gemini' 
  | 'openai_compatible'
  | 'anthropic'
  | 'deepseek'
  | 'qwen'
  | 'gigachat'
  | 'alice'
  | 'openrouter'
  | 'aitunnel'
  | 'local';

// Provider-specific capability flags
export interface ProviderCapabilities {
  supportsImages: boolean;
  supportsJSON: boolean;
  supportsSystemPrompt: boolean;
  supportsVision: boolean;
  maxTokens: number;
  contextWindow: number;
}

export interface OpenRouterModelInfo {
  modelId: string;
  canonicalSlug?: string;
  isFreeTier: boolean;
  supportsResponseFormat: boolean;
  supportsStructuredOutputs: boolean;
  supportsReasoning: boolean;
  supportsIncludeReasoning: boolean;
  isReasoningModel: boolean;
  maxCompletionTokens?: number;
  contextLength?: number;
  preferredStructuredFormat: 'json' | 'xml';
  recommendedMaxTokens: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  updatedAt: string;
}

// Performance metrics for provider selection
export interface ProviderMetrics {
  lastResponseTime?: number;
  averageResponseTime?: number;
  successCount: number;
  failureCount: number;
  lastUsed?: Date;
  lastHealthCheck?: Date;
  isHealthy: boolean;
}

// Enhanced AI Profile configuration
export interface EnhancedAIProfile {
  // Identity
  id: string;
  name: string;
  providerType: ProviderType;
  
  // Connection Details
  apiKey?: string;
  baseUrl: string;
  modelName: string;
  
  // Provider-specific settings
  apiVersion?: string;  // For Azure, Anthropic, etc.
  organizationId?: string;  // For OpenAI
  region?: string;  // For cloud providers
  customHeaders?: Record<string, string>;
  openRouterModelInfo?: OpenRouterModelInfo;
  
  // Performance & Tracking
  metrics: ProviderMetrics;
  costPerMillionTokens?: number;
  isActive: boolean;
  priority: number;  // 1-10, higher = priority selection
  
  // Capabilities
  capabilities: ProviderCapabilities;
  
  // Prompt optimization
  preferredPromptFormat?: 'openai' | 'anthropic' | 'gemini' | 'generic';
  systemPromptTemplate?: string;
}

// Request context for intelligent provider selection
export interface RequestContext {
  type: 'diagnosis' | 'treatment' | 'quick_check' | 'complex_analysis';
  requiresImage?: boolean;
  requiresJSON?: boolean;
  estimatedTokens?: number;
  priority?: 'cost' | 'speed' | 'quality' | 'reliability';
  preferredProfileId?: string;
  timestamp: Date;
}

// Response wrapper for provider calls
export interface AIResponse {
  content?: string;
  provider: string;
  responseTime: number;
  tokensUsed?: number;
  estimatedCost?: number;
  isSuccessful: boolean;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// Provider health check result
export interface HealthCheckResult {
  provider: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

// Settings configuration for all providers
export interface EnhancedAISettings {
  profiles: EnhancedAIProfile[];
  activeProfileId: string;
  enableFallback: boolean;
  fallbackProfileIds: string[];
  selectionStrategy: 'FastestFirst' | 'CheapestFirst' | 'MostReliable' | 'RoundRobin';
  autoHealthCheck: boolean;
  healthCheckInterval: number;  // minutes
}


