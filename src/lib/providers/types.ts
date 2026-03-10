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
  timestamp: Date;
}

// Response wrapper for provider calls
export interface AIResponse {
  content: string;
  provider: string;
  responseTime: number;
  tokensUsed?: number;
  estimatedCost?: number;
  isSuccessful: boolean;
  error?: string;
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
  selectionStrategy: 'FastestFirst' | 'CheapestFirst' | 'MostReliable' | 'RoundRobin';
  autoHealthCheck: boolean;
  healthCheckInterval: number;  // minutes
}

// Legacy profile for backward compatibility
export interface AIProfile {
  id: string;
  name: string;
  provider: 'gemini' | 'openai_compatible';
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

// Legacy settings for backward compatibility
export interface AISettings {
  profiles: AIProfile[];
  activeProfileId: string;
  enableFallback: boolean;
}
