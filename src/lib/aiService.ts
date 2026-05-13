/**
 * AI Service Module
 * 
 * MIGRATION NOTE: This module now uses the Enhanced AI Service under the hood.
 * The new multi-provider system is available at @/lib/providers
 * 
 * Backward compatibility is maintained for existing code.
 * Gradually migrate to the new system for multi-provider support.
 * 
 * New code should use:
 *   import { enhancedAIService, ProviderFactory } from '@/lib/providers';
 * 
 * Legacy code can continue using this module and will automatically
 * benefit from the new multi-provider capabilities.
 */

export { aiService } from './aiServiceCompat';
