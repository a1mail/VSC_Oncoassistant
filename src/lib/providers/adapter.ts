/**
 * Provider Adapter Interface
 * Defines the contract that all provider implementations must follow
 */

import { EnhancedAIProfile, AIResponse, HealthCheckResult, ProviderCapabilities } from './types';
import { removeEmptyFields } from '@/lib/utils/jsonUtils';
import { cleanJsonResponse } from '@/lib/utils/jsonUtils';

export interface AIProviderAdapter {
  /**
   * Generate content from the AI provider
   * @param prompt The prompt to send to the AI
   * @param systemPrompt Optional system prompt
   * @param options Additional generation options
   */
  generateContent(
    prompt: string,
    systemPrompt?: string,
    options?: GenerationOptions
  ): Promise<AIResponse>;

  /**
   * Test the connection to the provider
   * @returns HealthCheckResult with connectivity status
   */
  testConnection(): Promise<HealthCheckResult>;

  /**
   * Estimate the cost of a request
   * @param prompt The prompt to estimate
   * @returns Estimated cost in USD
   */
  estimateCost(prompt: string): Promise<number>;

  /**
   * Get provider capabilities
   */
  getCapabilities(): Promise<ProviderCapabilities>;

  /**
   * Validate the configuration
   * @returns true if valid, false otherwise
   */
  validateConfiguration(): Promise<boolean>;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseProviderAdapter implements AIProviderAdapter {
  protected profile: EnhancedAIProfile;

  constructor(profile: EnhancedAIProfile) {
    this.profile = profile;
  }

  abstract generateContent(
    prompt: string,
    systemPrompt?: string,
    options?: GenerationOptions
  ): Promise<AIResponse>;

  abstract testConnection(): Promise<HealthCheckResult>;

  abstract estimateCost(prompt: string): Promise<number>;

  abstract getCapabilities(): Promise<ProviderCapabilities>;

  abstract validateConfiguration(): Promise<boolean>;

  /**
   * Helper to estimate tokens using rough approximation (1 token ≈ 4 characters)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Helper to measure performance
   */
  protected async measurePerformance<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  /**
   * Helper for exponential backoff retry logic
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  protected cleanJsonResponse(text: string): string {
    return cleanJsonResponse(text);
  }

  protected removeEmptyFields(obj: unknown): unknown {
    return removeEmptyFields(obj);
  }
}
