/**
 * AI Service Compatibility Layer
 * Bridges the old AIService API with the new Enhanced AI Service
 * Maintains backward compatibility while supporting new features
 * Integrates with profileService for saved API profiles
 */

import { GoogleGenAI } from "@google/genai";
import { enhancedAIService, EnhancedAIProfile, ProviderFactory } from '@/lib/providers';
import { profileService, SavedProviderProfile } from '@/lib/providers/profileService';

// Legacy Types (re-exported for backward compatibility)
export type AIProvider = 'gemini' | 'openai_compatible';

export interface AIProfile {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

export interface AISettings {
  profiles: AIProfile[];
  activeProfileId: string;
  enableFallback: boolean;
}

// Helper to remove empty fields recursively to save tokens
function removeEmptyFields(obj: any): any {
  if (Array.isArray(obj)) {
    const cleaned = obj.map(removeEmptyFields).filter(v => v !== null && v !== undefined && v !== '' && v !== false && (typeof v !== 'object' || Object.keys(v).length > 0));
    return cleaned.length > 0 ? cleaned : undefined;
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const value = removeEmptyFields(obj[key]);
      if (value !== undefined && value !== null && value !== '' && value !== false && (typeof value !== 'object' || Object.keys(value).length > 0)) {
        newObj[key] = value;
      }
    });
    return Object.keys(newObj).length > 0 ? newObj : undefined;
  }
  return obj;
}

function cleanJson(text: string): string {
  let cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

/**
 * Convert SavedProviderProfile to EnhancedAIProfile
 */
function savedToEnhancedProfile(saved: SavedProviderProfile): EnhancedAIProfile {
  const template = ProviderFactory.getProviderTemplate(saved.type);
  
  // Ensure all required fields are set with proper defaults
  const baseUrl = (saved.baseUrl || '').trim() || 
    (typeof template.baseUrl === 'string' ? template.baseUrl : '') || 
    '';
  
  const modelName = (saved.modelName || '').trim() || 
    (typeof template.modelName === 'string' ? template.modelName : '') || 
    'gpt-4';
  
  const apiKey = (saved.apiKey || '').trim();

  const enhanced: EnhancedAIProfile = {
    id: saved.id,
    name: saved.name,
    providerType: saved.type,
    apiKey: apiKey, // Keep as is - even empty for some providers
    baseUrl: baseUrl,
    modelName: modelName,
    metrics: {
      successCount: 0,
      failureCount: 0,
      isHealthy: true,
    },
    capabilities: template.capabilities || {
      supportsImages: false,
      supportsJSON: false,
      supportsSystemPrompt: true,
      supportsVision: false,
      maxTokens: 4000,
      contextWindow: 128000,
    },
    isActive: saved.isActive,
    priority: template.priority || 5,
  };

  // Validate required fields
  if (!enhanced.modelName) {
    throw new Error(`Profile "${saved.name}" is missing model name`);
  }

  // Validate provider-specific requirements
  if (saved.type === 'local') {
    // Local models don't require API key
    if (!baseUrl) {
      throw new Error(`Profile "${saved.name}" (Local) requires a base URL (e.g., http://localhost:11434)`);
    }
  } else {
    // All other providers require API key
    if (!apiKey) {
      throw new Error(`Profile "${saved.name}" (${saved.type}) requires an API key`);
    }
    if (!baseUrl) {
      throw new Error(`Profile "${saved.name}" (${saved.type}) requires a base URL`);
    }
  }

  return enhanced;
}

/**
 * Sync saved profiles from profileService to enhancedAIService
 */
function syncProfilesFromService(): void {
  const savedProfiles = profileService.getAllProfiles();
  
  console.log(`\n📋 Syncing profiles from profileService...`);
  console.log(`Found ${savedProfiles.length} saved profiles`);
  
  // Only sync if there are saved profiles
  if (savedProfiles.length === 0) {
    console.warn('⚠️ No saved profiles found - will use default');
    return;
  }

  const convertedProfiles: EnhancedAIProfile[] = [];
  const errors: string[] = [];

  // Convert all profiles, collecting any errors
  savedProfiles.forEach(saved => {
    try {
      // Get the full profile with API key
      const fullProfile = profileService.getProfile(saved.id);
      if (!fullProfile) {
        errors.push(`Profile "${saved.name}" not found in storage`);
        return;
      }

      console.log(`  Converting: ${fullProfile.name} (${fullProfile.type})`);
      const enhanced = savedToEnhancedProfile(fullProfile);
      convertedProfiles.push(enhanced);
      console.log(`    ✓ Converted successfully`);
    } catch (error: any) {
      const errorMsg = error.message || `Unknown error converting profile ${saved.name}`;
      console.error(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  });

  if (convertedProfiles.length === 0) {
    console.error('❌ No profiles could be converted:', errors);
    return;
  }

  if (errors.length > 0) {
    console.warn(`⚠️ Some profiles had errors:`, errors);
  }

  console.log(`\n✓ Successfully converted ${convertedProfiles.length} profiles`);

  // Find active profile - must be one of the converted ones
  const activeProfile = profileService.getActiveProfile();
  let activeId = activeProfile?.id;
  
  // Make sure active ID is in converted profiles
  if (!activeId || !convertedProfiles.some(p => p.id === activeId)) {
    activeId = convertedProfiles[0].id;
    console.log(`📌 Setting active profile to: ${convertedProfiles[0].name}`);
  } else {
    console.log(`📌 Using active profile: ${activeProfile?.name}`);
  }

  // Update enhancedAIService ONLY with converted profiles
  // Remove old default profiles that don't have valid config
  const settings = enhancedAIService.getSettings();
  const mergedProfiles = convertedProfiles; // Use ONLY converted profiles, not the old ones
  
  console.log(`\n📝 Updating enhancedAIService with ${mergedProfiles.length} profiles`);
  
  try {
    enhancedAIService.saveSettings({
      ...settings,
      profiles: mergedProfiles,
      activeProfileId: activeId!,
    });
    console.log('✅ Profiles synced and saved to enhancedAIService\n');
  } catch (error) {
    console.error('❌ Failed to save synced profiles:', error);
  }
}

/**
 * Migrate legacy settings to enhanced settings
 */
function migrateToEnhanced(legacySettings: AISettings): void {
  // Load legacy settings and check if migration is needed
  const stored = localStorage.getItem('ai_settings_enhanced');
  if (stored) {
    // Already migrated
    return;
  }

  // Convert legacy profiles to enhanced profiles
  const enhancedProfiles = legacySettings.profiles.map(profile => {
    const template = ProviderFactory.getProviderTemplate(
      profile.provider === 'gemini' ? 'gemini' : 'openai_compatible'
    );

    const enhanced: EnhancedAIProfile = {
      id: profile.id,
      name: profile.name,
      providerType: profile.provider === 'gemini' ? 'gemini' : 'openai_compatible',
      apiKey: profile.apiKey,
      baseUrl: profile.baseUrl || template.baseUrl || '',
      modelName: profile.modelName || template.modelName || '',
      metrics: {
        successCount: 0,
        failureCount: 0,
        isHealthy: true,
      },
      capabilities: template.capabilities || {
        supportsImages: false,
        supportsJSON: false,
        supportsSystemPrompt: true,
        supportsVision: false,
        maxTokens: 4000,
        contextWindow: 128000,
      },
      isActive: true,
      priority: profile.provider === 'gemini' ? 8 : 6,
    };
    return enhanced;
  });

  // Save as enhanced settings
  const enhancedSettings = {
    profiles: enhancedProfiles,
    activeProfileId: legacySettings.activeProfileId,
    enableFallback: legacySettings.enableFallback,
    selectionStrategy: 'FastestFirst' as const,
    autoHealthCheck: true,
    healthCheckInterval: 30,
  };

  enhancedAIService.saveSettings(enhancedSettings);
}

/**
 * Compatibility wrapper for legacy aiService API
 */
export const aiService = {
  getConfig: (): AISettings => {
    // Try to get legacy settings first
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      return JSON.parse(stored);
    }
    
    const legacy = localStorage.getItem('ai_config');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: AIProfile = {
        id: 'migrated-profile',
        name: 'Пользовательский ИИ',
        provider: parsed.provider || 'gemini',
        apiKey: parsed.apiKey,
        baseUrl: parsed.baseUrl,
        modelName: parsed.modelName || 'gemini-3.1-pro-preview'
      };
      const settings = {
        profiles: [migrated],
        activeProfileId: 'migrated-profile',
        enableFallback: true
      };
      localStorage.setItem('ai_settings', JSON.stringify(settings));
      return settings;
    }

    // Default fallback
    const defaultProfile: AIProfile = {
      id: 'default-gemini',
      name: 'Google Gemini (По умолчанию)',
      provider: 'gemini',
      modelName: 'gemini-2.0-flash'
    };

    return {
      profiles: [defaultProfile],
      activeProfileId: 'default-gemini',
      enableFallback: true
    };
  },

  setConfig: (settings: AISettings) => {
    localStorage.setItem('ai_settings', JSON.stringify(settings));
    // Also migrate to enhanced
    migrateToEnhanced(settings);
  },

  prepareDiagnosisPrompt: (patientData: any, documents: any[] = []) => {
    const safePatientData = { ...patientData };
    if (safePatientData.patient) {
      safePatientData.patient = {
        ...safePatientData.patient,
        full_name: "Patient X",
        phone: "[REDACTED]",
        address: "[REDACTED]",
        birth_date: safePatientData.patient.birth_date ? safePatientData.patient.birth_date.substring(0, 4) : "Unknown"
      };
    }

    const optimizedData = removeEmptyFields(safePatientData);

    let prompt = `
You are an expert oncologist assistant operating under the jurisdiction of the Russian Federation.
You strictly adhere to the Clinical Recommendations (CR RF) approved by the Ministry of Health.

Analyze the following patient data and formulate a Working Diagnosis.

Patient Data:
${JSON.stringify(optimizedData, null, 2)}
    `;

    if (documents && documents.length > 0) {
      prompt += `\n\nAttached Medical Documents:\n`;
      documents.forEach((doc, index) => {
        if (doc.type === 'text') {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n${doc.content}\n`;
        } else {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n[Image Content Attached]\n`;
        }
      });
    }

    prompt += `
INSTRUCTIONS:
1. Formulate the "working_diagnosis" to include the primary oncological diagnosis.
2. Include any comorbidities (concomitant diseases) listed in the anamnesis as part of the full diagnosis structure, following ICD-10 standards.
3. Identify and list any complications of the primary disease if the data suggests them.
4. CRITICAL: ALL TEXT VALUES IN THE JSON RESPONSE MUST BE IN RUSSIAN LANGUAGE (РУССКИЙ ЯЗЫК).

Provide the output in the following JSON format:
{
  "working_diagnosis": "Full text of the diagnosis including primary disease, TNM, complications, and comorbidities",
  "icd10": "Primary Code (e.g. C50.4)",
  "tnm": "TNM staging (if applicable, otherwise null)",
  "reasoning": "Explanation of why this diagnosis was chosen based on the data",
  "confidence": "High/Medium/Low",
  "missing_data": ["List of specific tests required to confirm diagnosis according to CR RF"],
  "is_final": false
}

Do not use Markdown formatting in the response, just raw JSON.
    `;

    return prompt;
  },

  prepareTreatmentPrompt: (diagnosisData: any, patientData: any, documents: any[] = []) => {
    const safePatientData = { ...patientData };
    if (safePatientData.patient) {
      safePatientData.patient = {
        ...safePatientData.patient,
        full_name: "Patient X",
        phone: "[REDACTED]",
        address: "[REDACTED]",
        birth_date: safePatientData.patient.birth_date ? safePatientData.patient.birth_date.substring(0, 4) : "Unknown"
      };
    }

    const optimizedPatientData = removeEmptyFields(safePatientData);
    const optimizedDiagnosis = removeEmptyFields(diagnosisData);

    let prompt = `
You are an expert oncologist assistant operating under the jurisdiction of the Russian Federation.
Based on the confirmed diagnosis and patient data, outline the treatment plan according to CR RF.

Diagnosis: ${JSON.stringify(optimizedDiagnosis)}
Patient Context: ${JSON.stringify(optimizedPatientData)}
    `;

    if (documents && documents.length > 0) {
      prompt += `\n\nAttached Medical Documents:\n`;
      documents.forEach((doc, index) => {
        if (doc.type === 'text') {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n${doc.content}\n`;
        } else {
          prompt += `\n--- Document ${index + 1} (${doc.name}) ---\n[Image Content Attached]\n`;
        }
      });
    }

    prompt += `
INSTRUCTIONS:
1. Propose a treatment strategy (Curative/Palliative/Symptomatic).
2. Define the primary treatment (Surgery, Chemotherapy, Radiation, etc.).
3. Specify the regimen/protocol if applicable.
4. CRITICAL: Check for CONTRAINDICATIONS based on patient comorbidities and condition.
5. CRITICAL: Check for DRUG-DRUG INTERACTIONS.
6. If contraindications found, list them in "warnings" field.
7. Provide DETAILED PRESCRIPTION LIST with all details.
8. CRITICAL: ALL TEXT VALUES IN JSON MUST BE IN RUSSIAN (РУССКИЙ ЯЗЫК).

Provide output in JSON format with treatment_strategy, primary_treatment, regimen, prescriptions, recommendations, warnings, cr_source.
Do not use Markdown, just raw JSON.
    `;

    return prompt;
  },

  executeRawPrompt: async (prompt: string, documents: any[] = []) => {
    try {
      // Sync profiles from profileService before generating content
      syncProfilesFromService();
      
      const response = await enhancedAIService.generateContent(prompt);
      
      if (!response.isSuccessful) {
        throw new Error(response.error || 'AI generation failed');
      }

      return JSON.parse(cleanJson(response.content));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to execute prompt');
    }
  },

  diagnose: async (patientData: any) => {
    const prompt = aiService.prepareDiagnosisPrompt(patientData);
    return await aiService.executeRawPrompt(prompt);
  },

  recommendTreatment: async (diagnosisData: any, patientData: any) => {
    const prompt = aiService.prepareTreatmentPrompt(diagnosisData, patientData);
    return await aiService.executeRawPrompt(prompt);
  },

  /**
   * Diagnose provider configuration issues
   */
  diagnostProvider: async (profileId: string) => {
    return await enhancedAIService.diagnosProvider(profileId);
  },

  /**
   * Test a single provider
   */
  testProvider: async (profileId: string) => {
    return await enhancedAIService.testProvider(profileId);
  }
};

// Initialize migration if needed
if (typeof window !== 'undefined' && localStorage) {
  const legacySettings = aiService.getConfig();
  migrateToEnhanced(legacySettings);
}
