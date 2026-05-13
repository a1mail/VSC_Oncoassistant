/**
 * Provider Selection Strategies
 * Implements intelligent selection of AI providers based on various criteria
 */

import { EnhancedAIProfile, RequestContext } from './types';

export type SelectionStrategy = 'FastestFirst' | 'CheapestFirst' | 'MostReliable' | 'RoundRobin';

export class ProviderSelector {
  private static isOpenRouterProfile(profile: EnhancedAIProfile): boolean {
    return profile.providerType === 'openrouter' || profile.baseUrl.toLowerCase().includes('openrouter.ai');
  }

  private static isStructuredJsonFragile(profile: EnhancedAIProfile, context: RequestContext): boolean {
    if (!context.requiresJSON) return false;

    if (!this.isOpenRouterProfile(profile)) {
      return false;
    }

    const modelInfo = profile.openRouterModelInfo;
    if (modelInfo) {
      return (
        modelInfo.preferredStructuredFormat !== 'json' ||
        !modelInfo.supportsResponseFormat ||
        modelInfo.isReasoningModel ||
        modelInfo.isFreeTier
      );
    }

    const model = profile.modelName.toLowerCase();
    return (
      model.includes(':free') ||
        model.includes('preview') ||
        model.includes('tencent/') ||
        model.includes('minimax/') ||
        model.includes('glm-') ||
        model.includes('qwen3-next')
    );
  }

  /**
   * Select the best provider based on the configured strategy
   */
  static selectProvider(
    providers: EnhancedAIProfile[],
    context: RequestContext,
    strategy: SelectionStrategy = 'FastestFirst'
  ): EnhancedAIProfile | null {
    const validProviders = providers.filter(p => p.isActive && p.metrics.isHealthy);
    
    if (validProviders.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'FastestFirst':
        return this.fastestFirst(validProviders, context);
      case 'CheapestFirst':
        return this.cheapestFirst(validProviders, context);
      case 'MostReliable':
        return this.mostReliable(validProviders, context);
      case 'RoundRobin':
        return this.roundRobin(validProviders);
      default:
        return validProviders[0];
    }
  }

  /**
   * FastestFirst: Select provider with lowest average response time
   * Ideal for quick responses, prioritizes performance
   */
  private static fastestFirst(
    providers: EnhancedAIProfile[],
    context: RequestContext
  ): EnhancedAIProfile {
    return providers.reduce((fastest, current) => {
      const fastestTime = fastest.metrics.averageResponseTime || Infinity;
      const currentTime = current.metrics.averageResponseTime || Infinity;
      return currentTime < fastestTime ? current : fastest;
    });
  }

  /**
   * CheapestFirst: Select provider with lowest estimated cost
   * Ideal for cost-sensitive operations
   */
  private static cheapestFirst(
    providers: EnhancedAIProfile[],
    context: RequestContext
  ): EnhancedAIProfile {
    return providers.reduce((cheapest, current) => {
      const cheapestCost = cheapest.costPerMillionTokens || Infinity;
      const currentCost = current.costPerMillionTokens || Infinity;
      return currentCost < cheapestCost ? current : cheapest;
    });
  }

  /**
   * MostReliable: Select provider with highest success rate
   * Ideal for critical operations, prioritizes reliability
   */
  private static mostReliable(
    providers: EnhancedAIProfile[],
    context: RequestContext
  ): EnhancedAIProfile {
    return providers.reduce((most, current) => {
      const mostRate = this.getSuccessRate(most);
      const currentRate = this.getSuccessRate(current);
      return currentRate >= mostRate ? current : most;
    });
  }

  /**
   * RoundRobin: Select providers in rotation
   * Ideal for load balancing and testing
   */
  private static roundRobin(providers: EnhancedAIProfile[]): EnhancedAIProfile {
    // Select based on which has been used least recently
    return providers.reduce((least, current) => {
      const leastTime = least.metrics.lastUsed?.getTime() || 0;
      const currentTime = current.metrics.lastUsed?.getTime() || 0;
      return currentTime < leastTime ? current : least;
    });
  }

  /**
   * Calculate success rate for a provider
   */
  private static getSuccessRate(profile: EnhancedAIProfile): number {
    const total = profile.metrics.successCount + profile.metrics.failureCount;
    if (total === 0) return 1.0; // Assume healthy if no data
    return profile.metrics.successCount / total;
  }

  /**
   * Score providers for comparison
   * Returns a ranking score (0-100) for each provider
   */
  static scoreProviders(
    providers: EnhancedAIProfile[],
    context: RequestContext,
    strategy: SelectionStrategy
  ): Array<{ profile: EnhancedAIProfile; score: number }> {
    return providers.map(profile => ({
      profile,
      score: this.calculateScore(profile, context, strategy),
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate a composite score for a provider
   */
  private static calculateScore(
    profile: EnhancedAIProfile,
    context: RequestContext,
    strategy: SelectionStrategy
  ): number {
    let score = 0;

    // Health status (critical)
    if (!profile.metrics.isHealthy) return -100;
    if (!profile.isActive) return -100;
    score += 30;

    // Success rate (important)
    const successRate = this.getSuccessRate(profile);
    score += successRate * 25;

    // Response time (depends on context)
    const avgTime = profile.metrics.averageResponseTime || 0;
    const timeScore = Math.max(0, 20 - (avgTime / 100)); // Normalize to 0-20
    score += timeScore;

    // Cost efficiency (depends on strategy)
    const costScore = profile.costPerMillionTokens 
      ? Math.max(0, 10 - (profile.costPerMillionTokens / 10))
      : 5;
    score += costScore;

    // Priority/preference
    score += profile.priority;

    // Context-specific adjustments
    if (context.requiresJSON) {
      score += profile.capabilities.supportsJSON ? 12 : -20;
      if (this.isStructuredJsonFragile(profile, context)) {
        score -= 15;
      }

      if (profile.openRouterModelInfo?.supportsResponseFormat) {
        score += 4;
      }
    }

    if (context.type === 'quick_check' && avgTime < 2000) {
      score += 10;  // Bonus for fast responses on quick checks
    }
    if (context.type === 'complex_analysis' && successRate > 0.95) {
      score += 10;  // Bonus for reliable providers on complex tasks
    }
    if (context.priority === 'reliability') {
      score += successRate * 10;
    }

    if (profile.openRouterModelInfo?.isReasoningModel && context.type === 'complex_analysis') {
      score += 4;
    }

    if (profile.openRouterModelInfo?.isFreeTier && context.priority === 'speed') {
      score -= 4;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get fallback providers in order of reliability
   * Useful for implementing fallback chains
   */
  static getFallbackChain(
    providers: EnhancedAIProfile[],
    context: RequestContext
  ): EnhancedAIProfile[] {
    return this.scoreProviders(providers, context, 'MostReliable')
      .map(({ profile }) => profile);
  }
}
