/**
 * Enhanced AI Service
 * Multi-provider AI service with intelligent selection and fallback
 */

import { EnhancedAIProfile, EnhancedAISettings, RequestContext, AIResponse, HealthCheckResult } from './types';
import { AIProviderAdapter } from './adapter';
import { ProviderFactory } from './factory';
import { ProviderSelector } from './selector';

const DEFAULT_GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '').trim();

// Default enhanced settings
const DEFAULT_ENHANCED_PROFILE: EnhancedAIProfile = {
  id: 'default-gemini',
  name: 'Google Gemini (По умолчанию)',
  providerType: 'gemini',
  apiKey: DEFAULT_GEMINI_API_KEY,
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  modelName: 'gemini-2.0-flash',
  metrics: {
    successCount: 0,
    failureCount: 0,
    isHealthy: true,
  },
  capabilities: {
    supportsImages: true,
    supportsJSON: false,
    supportsSystemPrompt: true,
    supportsVision: true,
    maxTokens: 8192,
    contextWindow: 1000000,
  },
  isActive: true,
  priority: 8,
  preferredPromptFormat: 'gemini',
};

const DEFAULT_ENHANCED_SETTINGS: EnhancedAISettings = {
  profiles: [DEFAULT_ENHANCED_PROFILE],
  activeProfileId: 'default-gemini',
  enableFallback: true,
  fallbackProfileIds: [],
  selectionStrategy: 'FastestFirst',
  autoHealthCheck: true,
  healthCheckInterval: 30,
};

function supportsRequestedJson(profile: EnhancedAIProfile, context: RequestContext): boolean {
  if (!context.requiresJSON) {
    return true;
  }

  if (profile.providerType === 'openrouter' && profile.openRouterModelInfo) {
    return profile.openRouterModelInfo.preferredStructuredFormat === 'json';
  }

  return profile.capabilities.supportsJSON;
}

export class EnhancedAIService {
  private static instance: EnhancedAIService;
  private settings: EnhancedAISettings;
  private adapters: Map<string, any> = new Map();
  private adapterSignatures: Map<string, string> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.settings = this.loadSettings();
    this.startHealthChecks();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnhancedAIService {
    if (!EnhancedAIService.instance) {
      EnhancedAIService.instance = new EnhancedAIService();
    }
    return EnhancedAIService.instance;
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): EnhancedAISettings {
    try {
      const stored = localStorage.getItem('ai_settings_enhanced');
      if (stored) {
        return this.normalizeSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load enhanced settings:', error);
    }

    // Fallback to default
    return this.normalizeSettings({ ...DEFAULT_ENHANCED_SETTINGS });
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings: EnhancedAISettings): void {
    this.settings = this.normalizeSettings(settings);
    localStorage.setItem('ai_settings_enhanced', JSON.stringify(this.settings));
    this.clearStaleAdapters();
  }

  reloadSettings(): EnhancedAISettings {
    this.settings = this.loadSettings();
    this.clearStaleAdapters();
    return this.settings;
  }

  private normalizeSettings(settings: Partial<EnhancedAISettings>): EnhancedAISettings {
    const profiles = Array.isArray(settings.profiles) ? settings.profiles : DEFAULT_ENHANCED_SETTINGS.profiles;
    const firstProfileId = profiles[0]?.id || DEFAULT_ENHANCED_SETTINGS.activeProfileId;
    const activeProfileId =
      typeof settings.activeProfileId === 'string' && profiles.some((profile) => profile.id === settings.activeProfileId)
        ? settings.activeProfileId
        : firstProfileId;
    const fallbackProfileIds = Array.isArray(settings.fallbackProfileIds)
      ? settings.fallbackProfileIds
          .filter((profileId, index, all) => typeof profileId === 'string' && all.indexOf(profileId) === index)
          .filter((profileId) => profileId !== activeProfileId && profiles.some((profile) => profile.id === profileId))
      : [];

    return {
      profiles,
      activeProfileId,
      enableFallback: settings.enableFallback !== false,
      fallbackProfileIds,
      selectionStrategy: settings.selectionStrategy || DEFAULT_ENHANCED_SETTINGS.selectionStrategy,
      autoHealthCheck: settings.autoHealthCheck ?? DEFAULT_ENHANCED_SETTINGS.autoHealthCheck,
      healthCheckInterval: settings.healthCheckInterval ?? DEFAULT_ENHANCED_SETTINGS.healthCheckInterval,
    };
  }

  private clearStaleAdapters(): void {
    const validIds = new Set(this.settings.profiles.map((profile) => profile.id));
    for (const profileId of this.adapters.keys()) {
      if (!validIds.has(profileId)) {
        this.adapters.delete(profileId);
      }
    }
    for (const profileId of this.adapterSignatures.keys()) {
      if (!validIds.has(profileId)) {
        this.adapterSignatures.delete(profileId);
      }
    }
  }

  /**
   * Get current settings
   */
  getSettings(): EnhancedAISettings {
    return this.settings;
  }

  /**
   * Get all profiles
   */
  getProfiles(): EnhancedAIProfile[] {
    return this.settings.profiles;
  }

  /**
   * Get active profile
   */
  getActiveProfile(): EnhancedAIProfile | null {
    return this.settings.profiles.find(p => p.id === this.settings.activeProfileId) || null;
  }

  private notifyProviderAttempt(
    context: RequestContext,
    profile: EnhancedAIProfile,
    stage: 'primary' | 'fallback',
  ): void {
    if (!context.onProviderAttempt) {
      return;
    }

    try {
      context.onProviderAttempt({
        profileId: profile.id,
        profileName: profile.name,
        providerType: profile.providerType,
        modelName: profile.modelName,
        stage,
      });
    } catch (error) {
      console.warn('Provider attempt callback failed:', error);
    }
  }

  private formatProviderLabel(profile: EnhancedAIProfile): string {
    return `${profile.name} (${profile.modelName})`;
  }

  private askFallbackBehavior(
    primaryProfile: EnhancedAIProfile,
    fallbackChain: EnhancedAIProfile[],
    primaryError: string,
  ): { mode: 'none' | 'auto' | 'manual'; profile?: EnhancedAIProfile } {
    if (typeof window === 'undefined' || fallbackChain.length === 0) {
      return { mode: 'none' };
    }

    const compactError = (primaryError || 'Неизвестная ошибка').slice(0, 300);
    const fallbackOptions = fallbackChain
      .map((profile, index) => `${index + 1}. ${profile.name} (${profile.modelName})`)
      .join('\n');

    const chooseManually = window.confirm(
      `Не удалось связаться с моделью "${primaryProfile.name}" (${primaryProfile.modelName}).\n\n` +
        `Ошибка: ${compactError}\n\n` +
        `Нажмите OK, чтобы выбрать резервный профиль вручную для этого запроса.\n` +
        `Нажмите Отмена для других вариантов.`,
    );

    if (chooseManually) {
      const manualChoice = window.prompt(
        `Введите номер резервного профиля:\n\n${fallbackOptions}`,
        '1',
      );
      if (!manualChoice) {
        return { mode: 'none' };
      }

      const parsedIndex = Number.parseInt(manualChoice, 10);
      if (!Number.isFinite(parsedIndex) || parsedIndex < 1 || parsedIndex > fallbackChain.length) {
        window.alert('Неверный номер профиля. Запрос остановлен без автопереключения.');
        return { mode: 'none' };
      }

      return { mode: 'manual', profile: fallbackChain[parsedIndex - 1] };
    }

    const allowAuto = window.confirm(
      `Разрешить автоматически перебрать резервные профили для этого запроса?\n\n${fallbackOptions}`,
    );

    return allowAuto ? { mode: 'auto' } : { mode: 'none' };
  }

  /**
   * Set active profile
   */
  setActiveProfile(profileId: string): void {
    if (this.settings.profiles.some(p => p.id === profileId)) {
      this.settings.activeProfileId = profileId;
      this.settings.fallbackProfileIds = this.settings.fallbackProfileIds.filter((id) => id !== profileId);
      this.saveSettings(this.settings);
    }
  }

  /**
   * Add or update a profile
   */
  addOrUpdateProfile(profile: EnhancedAIProfile): void {
    const index = this.settings.profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) {
      this.settings.profiles[index] = profile;
    } else {
      this.settings.profiles.push(profile);
    }
    this.saveSettings(this.settings);
  }

  /**
   * Remove a profile
   */
  removeProfile(profileId: string): void {
    this.settings.profiles = this.settings.profiles.filter(p => p.id !== profileId);
    if (this.settings.activeProfileId === profileId) {
      this.settings.activeProfileId = this.settings.profiles[0]?.id || '';
    }
    this.settings.fallbackProfileIds = this.settings.fallbackProfileIds.filter((id) => id !== profileId);
    this.saveSettings(this.settings);
    this.adapters.delete(profileId);
    this.adapterSignatures.delete(profileId);
  }

  /**
   * Generate content using the active or selected provider
   */
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    profileIdOrContext?: string | RequestContext
  ): Promise<AIResponse> {
    let primaryError = '';
    const context: RequestContext = typeof profileIdOrContext === 'string'
      ? {
          type: 'diagnosis',
          priority: 'quality',
          timestamp: new Date(),
        }
      : (profileIdOrContext || {
          type: 'diagnosis',
          priority: 'quality',
          timestamp: new Date(),
        });

    // Reload latest settings before selecting provider
    this.reloadSettings();

    const viableProfiles = this.settings.profiles.filter(p => {
      if (p.providerType === 'local') {
        return !!p.baseUrl?.trim();
      }
      return !!(p.apiKey?.trim() && p.baseUrl?.trim());
    });

    const jsonCapableProfiles = context.requiresJSON
      ? viableProfiles.filter(p => supportsRequestedJson(p, context))
      : viableProfiles;
    const candidateProfiles = jsonCapableProfiles.length > 0 ? jsonCapableProfiles : viableProfiles;

    const activeProfileId = context.preferredProfileId || this.settings.activeProfileId;
    const explicitlyPreferredProfile =
      typeof profileIdOrContext === 'string'
        ? viableProfiles.find((profile) => profile.id === profileIdOrContext) || null
        : viableProfiles.find((profile) => profile.id === activeProfileId) || null;
    const pickFallbackProfile = (): EnhancedAIProfile | null => {
      if (candidateProfiles.length === 0) {
        return null;
      }

      return (
        candidateProfiles.find((profile) => profile.id === activeProfileId) ||
        candidateProfiles.find((profile) => profile.isActive) ||
        candidateProfiles.find((profile) => profile.metrics.isHealthy) ||
        candidateProfiles[0] ||
        null
      );
    };

    // Select provider - only from profiles with required config
    let selectedProfile: EnhancedAIProfile | null = null;
    
    if (typeof profileIdOrContext === 'string') {
      selectedProfile = explicitlyPreferredProfile;
    } else {
      if (viableProfiles.length === 0) {
        console.error('❌ No viable profiles found. All profiles are missing required configuration.');
        console.error('Saved profiles:', this.settings.profiles.map(p => ({
          name: p.name,
          type: p.providerType,
          hasApiKey: !!p.apiKey,
          hasBaseUrl: !!p.baseUrl,
        })));
        
        return {
          content: '',
          provider: 'Unknown',
          responseTime: 0,
          isSuccessful: false,
          error: 'No viable AI providers configured. Please go to Settings and add at least one provider with valid API credentials.',
        };
      }

      const preferredProfile = explicitlyPreferredProfile;
      if (preferredProfile) {
        selectedProfile = preferredProfile;
      } else {
        selectedProfile = ProviderSelector.selectProvider(
          candidateProfiles,
          context,
          context.requiresJSON ? 'MostReliable' : this.settings.selectionStrategy
        );
      }
    }

    if (!selectedProfile) {
      selectedProfile = pickFallbackProfile();
      if (selectedProfile) {
        console.warn(
          `⚠️ Provider selector returned no match; falling back to "${selectedProfile.name}" from viable configured profiles.`,
        );
      }
    }

    if (!selectedProfile) {
      return {
        content: '',
        provider: 'Unknown',
        responseTime: 0,
        isSuccessful: false,
        error: 'No available providers',
      };
    }

    // Get or create adapter (direct call)
    const adapter = this.getAdapter(selectedProfile);
    if (!adapter) {
      const errorMsg = `Failed to create adapter for provider "${selectedProfile.name}". Please check your settings and API configuration.`;
      console.error(errorMsg);
      return {
        content: '',
        provider: this.formatProviderLabel(selectedProfile),
        responseTime: 0,
        isSuccessful: false,
        error: errorMsg,
      };
    }

    try {
      this.notifyProviderAttempt(context, selectedProfile, 'primary');
      const response = await adapter.generateContent(prompt, systemPrompt);
      if (response.isSuccessful) {
        return {
          ...response,
          provider: this.formatProviderLabel(selectedProfile),
        };
      }
      primaryError = response.error || 'Unknown error';
    } catch (error) {
      primaryError = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error with primary provider "${selectedProfile.name}":`, error);
      console.error(`   Raw error: ${primaryError}`);
    }

    // Fallback if enabled and primary failed
    if (typeof profileIdOrContext !== 'string') {
      const explicitFallbackChain = this.settings.fallbackProfileIds
        .filter((profileId) => profileId !== selectedProfile.id)
        .map((profileId) => candidateProfiles.find((profile) => profile.id === profileId) || null)
        .filter((profile): profile is EnhancedAIProfile => !!profile);
      const interactiveFallbackCandidates = candidateProfiles.filter((profile) => profile.id !== selectedProfile.id);

      let fallbackChain: EnhancedAIProfile[] = [];
      if (this.settings.enableFallback) {
        fallbackChain = explicitFallbackChain;
      } else if (context.allowInteractiveFallbackPrompt !== false && interactiveFallbackCandidates.length > 0) {
        const decision = this.askFallbackBehavior(selectedProfile, interactiveFallbackCandidates, primaryError);
        if (decision.mode === 'auto') {
          fallbackChain = interactiveFallbackCandidates;
        } else if (decision.mode === 'manual' && decision.profile) {
          fallbackChain = [decision.profile];
        }
      }

      for (const fallbackProfile of fallbackChain) {
        try {
          console.log(`🔄 Trying fallback provider: ${fallbackProfile.name}`);
          this.notifyProviderAttempt(context, fallbackProfile, 'fallback');
          const fallbackAdapter = this.getAdapter(fallbackProfile);
          if (fallbackAdapter) {
            const response = await fallbackAdapter.generateContent(prompt, systemPrompt);
            if (response.isSuccessful) {
              console.log(`✓ Fallback provider "${fallbackProfile.name}" succeeded`);
              return {
                ...response,
                provider: this.formatProviderLabel(fallbackProfile),
              };
            }
            console.error(`❌ Fallback provider "${fallbackProfile.name}" failed: ${response.error}`);
          }
        } catch (error) {
          console.error(`❌ Error with fallback provider ${fallbackProfile.name}:`, error);
        }
      }
    }

    const isRateLimitedOrOverloaded = /api error 429|rate-limited|rate limited|overloaded|temporarily unavailable/i.test(
      primaryError,
    );
    const isMissingAuth = /api error 401|missing authentication header|api key is missing or empty/i.test(primaryError);

    const troubleshootingHint = isRateLimitedOrOverloaded
      ? 'The selected provider is temporarily rate-limited or overloaded. Wait a few seconds and retry, or let fallback use another configured profile.'
      : isMissingAuth
        ? 'Please check that this profile has a valid API key, base URL, and provider type.'
        : 'Check your API key, base URL, and provider type match your actual API service.';

    const errorMsg = `All providers failed. Primary provider "${selectedProfile.name}" error: ${primaryError}. ${troubleshootingHint}`;
    console.error(`\n🛑 ${errorMsg}\n`);
    
    return {
      content: '',
      provider: this.formatProviderLabel(selectedProfile),
      responseTime: 0,
      isSuccessful: false,
      error: errorMsg,
    };
  }

  /**
   * Test a specific provider connection
   */
  async testProvider(profileId: string): Promise<HealthCheckResult> {
    const profile = this.settings.profiles.find(p => p.id === profileId);
    if (!profile) {
      return {
        provider: 'Unknown',
        isHealthy: false,
        responseTime: 0,
        error: 'Profile not found',
        timestamp: new Date(),
      };
    }

    const adapter = this.getAdapter(profile);
    if (!adapter) {
      return {
        provider: profile.name,
        isHealthy: false,
        responseTime: 0,
        error: 'Failed to create adapter',
        timestamp: new Date(),
      };
    }

    const result = await adapter.testConnection();
    profile.metrics.isHealthy = result.isHealthy;
    profile.metrics.lastHealthCheck = result.timestamp;
    this.saveSettings(this.settings);

    return result;
  }

  /**
   * Diagnose provider configuration issues
   */
  async diagnosProvider(profileId: string): Promise<{
    provider: string;
    isConfigValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const profile = this.settings.profiles.find(p => p.id === profileId);
    if (!profile) {
      return {
        provider: 'Unknown',
        isConfigValid: false,
        issues: ['Profile not found'],
        suggestions: ['Create a new provider profile in Settings'],
      };
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!profile.apiKey || profile.apiKey.trim() === '') {
      issues.push('API Key is missing or empty');
      suggestions.push('Enter your API key in the Settings dialog');
    }

    if (!profile.baseUrl || profile.baseUrl.trim() === '') {
      issues.push('Base URL is missing or empty');
      suggestions.push(`Enter the correct base URL for ${profile.providerType} (e.g., https://api.openai.com/v1)`);
    }

    if (!profile.modelName || profile.modelName.trim() === '') {
      issues.push('Model name is missing or empty');
      suggestions.push(`Specify a valid model name for ${profile.providerType}`);
    }

    // Try to create adapter
    if (issues.length === 0) {
      const adapter = this.getAdapter(profile);
      if (!adapter) {
        issues.push('Failed to create API adapter');
        suggestions.push('Check that the provider type matches your API service');
      }
    }

    // Check if API key format looks correct
    if (profile.apiKey && profile.apiKey.length < 10) {
      issues.push('API Key appears too short - verify it was copied completely');
      suggestions.push('Copy your entire API key again from your API provider console');
    }

    // Provider-specific checks
    if (profile.providerType === 'openai_compatible' && profile.baseUrl) {
      if (!profile.baseUrl.includes('http')) {
        issues.push('Base URL should start with http:// or https://');
        suggestions.push('Ensure the URL is complete and valid');
      }
    }

    // Test connection if configuration looks valid
    if (issues.length === 0) {
      try {
        const testResult = await this.testProvider(profileId);
        if (!testResult.isHealthy) {
          issues.push(`Connection test failed: ${testResult.error}`);
          suggestions.push(
            'Your API key may be invalid, expired, or not have the required permissions',
            'Contact your API provider to verify your credentials',
            'Check that the base URL matches your API service'
          );
        }
      } catch (error) {
        issues.push(`Failed to test connection: ${error instanceof Error ? error.message : String(error)}`);
        suggestions.push('Check your internet connection and API service status');
      }
    }

    return {
      provider: profile.name,
      isConfigValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Test all providers
   */
  async testAllProviders(): Promise<HealthCheckResult[]> {
    return Promise.all(
      this.settings.profiles.map(profile => this.testProvider(profile.id))
    );
  }

  /**
   * Estimate cost for a prompt
   */
  async estimateCost(prompt: string, profileId?: string): Promise<number> {
    const profile = profileId
      ? this.settings.profiles.find(p => p.id === profileId)
      : this.getActiveProfile();

    if (!profile) {
      return 0;
    }

    const adapter = this.getAdapter(profile);
    if (!adapter) {
      return 0;
    }

    return adapter.estimateCost(prompt);
  }

  /**
   * Get or create adapter for a profile
   */
  private getAdapter(profile: EnhancedAIProfile): AIProviderAdapter | null {
    const signature = this.getProfileSignature(profile);
    const cachedSignature = this.adapterSignatures.get(profile.id);

    // Recreate cached adapter when connection settings changed.
    if (this.adapters.has(profile.id) && cachedSignature !== signature) {
      this.adapters.delete(profile.id);
      this.adapterSignatures.delete(profile.id);
    }

    if (!this.adapters.has(profile.id)) {
      try {
        // Validate profile before creating adapter
        if (!profile.modelName || !profile.modelName.trim()) {
          throw new Error(`Provider "${profile.name}" has no model name configured`);
        }

        if (profile.providerType !== 'local' && !profile.apiKey) {
          throw new Error(`Provider "${profile.name}" has no API key configured`);
        }

        if (!profile.baseUrl && profile.providerType !== 'local') {
          throw new Error(`Provider "${profile.name}" has no base URL configured`);
        }

        console.log(`Creating adapter for ${profile.name} (${profile.providerType})...`);
        const adapter = ProviderFactory.createAdapter(profile);
        console.log(`✓ Adapter created successfully for ${profile.name}`);
        this.adapters.set(profile.id, adapter);
        this.adapterSignatures.set(profile.id, signature);
      } catch (error) {
        console.error(`❌ Failed to create adapter for ${profile.name}:`, error);
        return null;
      }
    }
    return this.adapters.get(profile.id) || null;
  }

  private getProfileSignature(profile: EnhancedAIProfile): string {
    return JSON.stringify({
      providerType: profile.providerType,
      apiKey: (profile.apiKey || '').trim(),
      baseUrl: (profile.baseUrl || '').trim(),
      modelName: (profile.modelName || '').trim(),
      organizationId: profile.organizationId || '',
      customHeaders: profile.customHeaders || {},
      capabilities: {
        supportsJSON: profile.capabilities.supportsJSON,
        maxTokens: profile.capabilities.maxTokens,
        contextWindow: profile.capabilities.contextWindow,
      },
      openRouterModelInfo: profile.openRouterModelInfo
        ? {
            preferredStructuredFormat: profile.openRouterModelInfo.preferredStructuredFormat,
            supportsResponseFormat: profile.openRouterModelInfo.supportsResponseFormat,
            isFreeTier: profile.openRouterModelInfo.isFreeTier,
            isReasoningModel: profile.openRouterModelInfo.isReasoningModel,
            recommendedMaxTokens: profile.openRouterModelInfo.recommendedMaxTokens,
            updatedAt: profile.openRouterModelInfo.updatedAt,
          }
        : null,
    });
  }

  /**
   * Start automatic health checks
   */
  private startHealthChecks(): void {
    if (!this.settings.autoHealthCheck || this.healthCheckTimer) {
      return;
    }

    const intervalMs = this.settings.healthCheckInterval * 60 * 1000;
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.testAllProviders();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Update selection strategy
   */
  setSelectionStrategy(strategy: 'FastestFirst' | 'CheapestFirst' | 'MostReliable' | 'RoundRobin'): void {
    this.settings.selectionStrategy = strategy;
    this.saveSettings(this.settings);
  }

  /**
   * Update fallback setting
   */
  setFallbackEnabled(enabled: boolean): void {
    this.settings.enableFallback = enabled;
    this.saveSettings(this.settings);
  }

  setFallbackProfiles(profileIds: string[]): void {
    this.settings.fallbackProfileIds = profileIds;
    this.saveSettings(this.settings);
  }
}

// Export singleton instance
export const enhancedAIService = EnhancedAIService.getInstance();
