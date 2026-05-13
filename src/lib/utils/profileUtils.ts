import type { EnhancedAIProfile } from '@/lib/providers/types';

export function isViableProfile(profile: EnhancedAIProfile): boolean {
  if (profile.providerType === 'local') {
    return !!profile.baseUrl?.trim();
  }
  return !!profile.apiKey?.trim() && !!profile.baseUrl?.trim();
}
