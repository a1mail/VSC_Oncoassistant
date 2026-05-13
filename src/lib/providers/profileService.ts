/**
 * Provider Profile Service
 * Manages saved API provider configurations with secure storage
 * API keys are stored in localStorage for persistence across sessions
 * (Keys are still kept private - never exposed in UI after saving)
 */

import { OpenRouterModelInfo } from './types';
import { getOpenRouterModelInfo } from './openrouterModelRegistry';

export interface SavedProviderProfile {
  id: string;
  name: string;
  type: 'gemini' | 'openai_compatible' | 'anthropic' | 'deepseek' | 'qwen' | 'gigachat' | 'alice' | 'openrouter' | 'aitunnel' | 'local';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
  openRouterModelInfo?: OpenRouterModelInfo;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderListItem {
  id: string;
  name: string;
  type: string;
  modelName: string;
  isActive: boolean;
  hasApiKey: boolean; // Never expose actual key
}

class ProfileService {
  private readonly STORAGE_KEY = 'onco_ai_provider_profiles';
  private profiles: SavedProviderProfile[] = [];

  private generateUniqueId(): string {
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

    return `profile-${Date.now()}-${randomPart}`;
  }

  private normalizeProfiles(rawProfiles: SavedProviderProfile[]): SavedProviderProfile[] {
    const seenIds = new Set<string>();
    let changed = false;

    const normalized = rawProfiles.map((profile) => {
      const candidateId = typeof profile.id === 'string' && profile.id.trim() ? profile.id : this.generateUniqueId();
      if (seenIds.has(candidateId)) {
        changed = true;
        return {
          ...profile,
          id: this.generateUniqueId(),
        };
      }

      seenIds.add(candidateId);
      if (candidateId !== profile.id) {
        changed = true;
        return {
          ...profile,
          id: candidateId,
        };
      }

      return profile;
    });

    if (changed) {
      this.profiles = normalized;
      this.saveProfiles();
    }

    return normalized;
  }

  constructor() {
    this.loadProfiles();
  }

  /**
   * Load profiles from localStorage
   * Note: localStorage persists across page refreshes and browser sessions
   * But is cleared when user clears browser cache
   */
  private loadProfiles(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      this.profiles = Array.isArray(parsed) ? this.normalizeProfiles(parsed) : [];
      console.log(`✓ Loaded ${this.profiles.length} profiles from localStorage`);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      this.profiles = [];
    }
  }

  /**
   * Save profiles to localStorage
   * Persists across browser sessions
   */
  private saveProfiles(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profiles));
      console.log(`✓ Saved ${this.profiles.length} profiles to localStorage`);
    } catch (error) {
      console.error('Failed to save profiles:', error);
    }
  }

  /**
   * Get all profiles (without exposing API keys)
   */
  getAllProfiles(): ProviderListItem[] {
    return this.profiles.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      modelName: p.modelName,
      isActive: p.isActive,
      hasApiKey: !!p.apiKey,
    }));
  }

  /**
   * Get a profile by ID (WITH API key for internal use only)
   */
  getProfile(id: string): SavedProviderProfile | null {
    return this.profiles.find(p => p.id === id) || null;
  }

  /**
   * Get the active profile
   */
  getActiveProfile(): SavedProviderProfile | null {
    return this.profiles.find(p => p.isActive) || null;
  }

  /**
   * Create a new profile
   */
  createProfile(data: Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>): SavedProviderProfile {
    const profile: SavedProviderProfile = {
      ...data,
      id: this.generateUniqueId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Deactivate other profiles if this one is active
    if (profile.isActive) {
      this.profiles.forEach(p => p.isActive = false);
    }

    this.profiles.push(profile);
    this.saveProfiles();
    return profile;
  }

  async createProfileWithMetadata(
    data: Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SavedProviderProfile> {
    const created = this.createProfile(data);
    return (await this.refreshOpenRouterMetadata(created.id)) || created;
  }

  /**
   * Update an existing profile
   */
  updateProfile(id: string, data: Partial<SavedProviderProfile>): SavedProviderProfile | null {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return null;

    const profile = {
      ...this.profiles[index],
      ...data,
      id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    // Handle activation
    if (profile.isActive) {
      this.profiles.forEach((p, i) => {
        if (i !== index) p.isActive = false;
      });
    }

    this.profiles[index] = profile;
    this.saveProfiles();
    return profile;
  }

  async updateProfileWithMetadata(
    id: string,
    data: Partial<SavedProviderProfile>,
  ): Promise<SavedProviderProfile | null> {
    const updated = this.updateProfile(id, data);
    if (!updated) {
      return null;
    }

    return this.refreshOpenRouterMetadata(id);
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string): boolean {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return false;

    const deleted = this.profiles[index];
    this.profiles.splice(index, 1);

    // If deleted profile was active, activate the first one
    if (deleted.isActive && this.profiles.length > 0) {
      this.profiles[0].isActive = true;
    }

    this.saveProfiles();
    return true;
  }

  /**
   * Set active profile
   */
  setActiveProfile(id: string): boolean {
    const profile = this.profiles.find(p => p.id === id);
    if (!profile) return false;

    this.profiles.forEach(p => p.isActive = (p.id === id));
    this.saveProfiles();
    return true;
  }

  /**
   * Check if a profile exists
   */
  exists(id: string): boolean {
    return this.profiles.some(p => p.id === id);
  }

  /**
   * Get profile count
   */
  count(): number {
    return this.profiles.length;
  }

  /**
   * Clear all profiles (for logout/reset)
   */
  clearAll(): void {
    this.profiles = [];
    this.saveProfiles();
  }

  /**
   * Enriches OpenRouter profiles with capabilities from the OpenRouter model registry.
   * We persist the metadata so the runtime can route requests without re-fetching it every time.
   */
  async refreshOpenRouterMetadata(
    id: string,
    options: { forceRefresh?: boolean } = {},
  ): Promise<SavedProviderProfile | null> {
    const profile = this.getProfile(id);
    if (!profile || profile.type !== 'openrouter' || !profile.modelName.trim()) {
      return profile;
    }

    const modelInfo = await getOpenRouterModelInfo(profile.modelName, options);
    if (!modelInfo) {
      return profile;
    }

    const updatedProfile = this.updateProfile(id, { openRouterModelInfo: modelInfo });
    return updatedProfile;
  }
}

// Export singleton instance
export const profileService = new ProfileService();
