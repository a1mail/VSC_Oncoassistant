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
  selectionStrategy: 'FastestFirst',
  autoHealthCheck: true,
  healthCheckInterval: 30,
};

export class EnhancedAIService {
  private static instance: EnhancedAIService;
  private settings: EnhancedAISettings;
  private adapters: Map<string, any> = new Map();
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
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load enhanced settings:', error);
    }

    // Fallback to default
    return { ...DEFAULT_ENHANCED_SETTINGS };
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings: EnhancedAISettings): void {
    this.settings = settings;
    localStorage.setItem('ai_settings_enhanced', JSON.stringify(settings));
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

  /**
   * Set active profile
   */
  setActiveProfile(profileId: string): void {
    if (this.settings.profiles.some(p => p.id === profileId)) {
      this.settings.activeProfileId = profileId;
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
    this.saveSettings(this.settings);
    this.adapters.delete(profileId);
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
    this.settings = this.loadSettings();

    // Select provider - only from profiles with required config
    let selectedProfile: EnhancedAIProfile | null = null;
    
    if (typeof profileIdOrContext === 'string') {
      selectedProfile = this.settings.profiles.find(p => p.id === profileIdOrContext) || null;
    } else {
      // Filter to only viable profiles (those with API key and base URL)
      const viableProfiles = this.settings.profiles.filter(p => {
        if (p.providerType === 'local') {
          return !!p.baseUrl?.trim();
        }
        return (p.apiKey?.trim() && p.baseUrl?.trim());
      });

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

      const activeViable = viableProfiles.find(p => p.id === this.settings.activeProfileId);
      if (activeViable) {
        selectedProfile = activeViable;
      } else {
        selectedProfile = ProviderSelector.selectProvider(
          viableProfiles,
          context,
          this.settings.selectionStrategy
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
        provider: selectedProfile.name,
        responseTime: 0,
        isSuccessful: false,
        error: errorMsg,
      };
    }

    // Try primary provider
    
    // Reload settings before each request to pick up any changes from SettingsDialog
    this.settings = this.loadSettings();

    try {
      console.log(`🔄 Attempting request to ${selectedProfile.name} (Type: ${selectedProfile.providerType}, Model: ${selectedProfile.modelName})`);
      console.log(`🌐 Base URL: ${selectedProfile.baseUrl}`);
      const response = await adapter.generateContent(prompt, systemPrompt);
      if (response.isSuccessful) {
        return response;
      }
      primaryError = response.error || 'Unknown error';
      console.error(`❌ Primary provider "${selectedProfile.name}" failed: ${primaryError}`);
    } catch (error) {
      primaryError = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error with primary provider "${selectedProfile.name}":`, error);
      console.error(`   Raw error: ${primaryError}`);
    }

    // Fallback if enabled and primary failed
    if (this.settings.enableFallback) {
      const fallbackChain = ProviderSelector.getFallbackChain(
        this.settings.profiles.filter(p => p.id !== selectedProfile!.id),
        context
      );

      for (const fallbackProfile of fallbackChain) {
        try {
          console.log(`🔄 Trying fallback provider: ${fallbackProfile.name}`);
          const fallbackAdapter = this.getAdapter(fallbackProfile);
          if (fallbackAdapter) {
            const response = await fallbackAdapter.generateContent(prompt, systemPrompt);
            if (response.isSuccessful) {
              console.log(`✓ Fallback provider "${fallbackProfile.name}" succeeded`);
              return response;
            }
            console.error(`❌ Fallback provider "${fallbackProfile.name}" failed: ${response.error}`);
          }
        } catch (error) {
          console.error(`❌ Error with fallback provider ${fallbackProfile.name}:`, error);
        }
      }
    }

    const errorMsg = `All providers failed. Primary provider "${selectedProfile.name}" error: ${primaryError}. Check your API key, base URL, and provider type match your actual API service.`;
    console.error(`\n🛑 ${errorMsg}\n`);
    
    return {
      content: '',
      provider: selectedProfile.name,
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

    const startTime = Date.now();

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
      } catch (error) {
        console.error(`❌ Failed to create adapter for ${profile.name}:`, error);
        return null;
      }
    }
    return this.adapters.get(profile.id) || null;
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
}

// Export singleton instance
export const enhancedAIService = EnhancedAIService.getInstance();
