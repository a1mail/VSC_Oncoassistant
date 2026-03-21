/**
 * Provider Profile Service
 * Manages saved API provider configurations with secure storage
 * API keys are stored in localStorage for persistence across sessions
 * (Keys are still kept private - never exposed in UI after saving)
 */

export interface SavedProviderProfile {
  id: string;
  name: string;
  type: 'gemini' | 'openai_compatible' | 'anthropic' | 'deepseek' | 'qwen' | 'gigachat' | 'alice' | 'openrouter' | 'aitunnel' | 'local';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
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
      this.profiles = stored ? JSON.parse(stored) : [];
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
      id: Date.now().toString(),
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
}

// Export singleton instance
export const profileService = new ProfileService();
