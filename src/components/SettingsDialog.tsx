/**
 * Settings Dialog Component
 * Manages API provider profiles with simple create/edit/delete interface
 */

import React, { useState, useEffect } from 'react';
import { Settings, X, Edit2, Trash2, Plus, AlertCircle } from 'lucide-react';
import { profileService, SavedProviderProfile, ProviderListItem } from '@/lib/providers/profileService';
import { ProviderForm } from './ProviderForm';
import { aiService } from '@/lib/aiServiceCompat';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai_compatible: 'OpenAI Compatible',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  qwen: 'Alibaba QWEN',
  gigachat: 'Sberbank GigaChat',
  alice: 'Yandex Alice',
  openrouter: 'OpenRouter',
  aitunnel: 'AITunnel',
  local: 'Local (Ollama/LM Studio)',
};

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [profiles, setProfiles] = useState<ProviderListItem[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<SavedProviderProfile | null>(null);
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [enableFallback, setEnableFallback] = useState(true);
  const [showFallbackWarning, setShowFallbackWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
      loadFallbackSetting();
      setView('list');
    }
  }, [isOpen]);

  const loadProfiles = () => {
    setProfiles(profileService.getAllProfiles());
  };

  const loadFallbackSetting = () => {
    try {
      const settings = localStorage.getItem('ai_settings_enhanced');
      if (settings) {
        const parsed = JSON.parse(settings);
        setEnableFallback(parsed.enableFallback !== false);
      }
    } catch (error) {
      console.error('Error loading fallback setting:', error);
      setEnableFallback(true);
    }
  };

  const handleFallbackToggle = (newValue: boolean) => {
    if (profiles.length > 1 && newValue) {
      // Enabling fallback with multiple profiles
      setShowFallbackWarning(true);
    }
    
    setEnableFallback(newValue);
    
    // Save to localStorage
    try {
      const settings = localStorage.getItem('ai_settings_enhanced');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed.enableFallback = newValue;
      localStorage.setItem('ai_settings_enhanced', JSON.stringify(parsed));
    } catch (error) {
      console.error('Error saving fallback setting:', error);
    }
  };

  const handleAddNew = () => {
    setEditingProfileId(null);
    setEditingProfile(null);
    setView('form');
  };

  const handleEdit = (id: string) => {
    const profile = profileService.getProfile(id);
    if (profile) {
      setEditingProfileId(id);
      setEditingProfile(profile);
      setView('form');
    }
  };

  const handleDelete = (id: string) => {
    if (profileService.count() <= 1) {
      alert('Cannot delete the last profile');
      return;
    }
    if (confirm('Delete this provider profile? This cannot be undone.')) {
      profileService.deleteProfile(id);
      loadProfiles();
    }
  };

  const handleSetActive = (id: string) => {
    profileService.setActiveProfile(id);
    loadProfiles();
  };

  const handleSaveProfile = (data: Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProfileId) {
      // Update existing
      profileService.updateProfile(editingProfileId, data);
    } else {
      // Create new
      profileService.createProfile(data);
    }
    loadProfiles();
    setView('list');
  };

  const handleCancel = () => {
    setView('list');
    setEditingProfileId(null);
    setEditingProfile(null);
  };

  const handleTestProvider = async (id: string) => {
    setTestingProfileId(id);
    try {
      const diagnostic = await aiService.diagnostProvider(id);
      setTestResults({ ...testResults, [id]: diagnostic });
      
      if (diagnostic.isConfigValid) {
        // If config is valid, also test the connection
        const testResult = await aiService.testProvider(id);
        setTestResults({ ...testResults, [id]: { ...diagnostic, connectionTest: testResult } });
      }
    } catch (error) {
      console.error('Error testing provider:', error);
      setTestResults({ 
        ...testResults, 
        [id]: {
          provider: 'Unknown',
          isConfigValid: false,
          issues: [error instanceof Error ? error.message : 'Unknown error'],
          suggestions: ['Check the browser console for more details']
        }
      });
    } finally {
      setTestingProfileId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI Provider Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            title="Close settings dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {view === 'list' && (
            <>
              {/* Empty State */}
              {profiles.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-4">No provider profiles created yet</p>
                  <button
                    onClick={handleAddNew}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Profile
                  </button>
                </div>
              ) : (
                <>
                  {/* Header with Add Button */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-600">
                      {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} saved
                    </p>
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Profile
                    </button>
                  </div>

                  {/* Profiles List */}
                  <div className="space-y-2">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          profile.isActive
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => handleSetActive(profile.id)}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="activeProfile"
                                checked={profile.isActive}
                                onChange={() => handleSetActive(profile.id)}
                                className="w-4 h-4 text-blue-600 cursor-pointer"
                                title="Select this provider profile"
                                aria-label={`Select ${profile.name} as active profile`}
                              />
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {profile.name}
                                </div>
                                <div className="text-xs text-slate-600 mt-1 space-y-1">
                                  <div>
                                    <span className="font-medium">Provider:</span>{' '}
                                    {PROVIDER_LABELS[profile.type] || profile.type}
                                  </div>
                                  <div>
                                    <span className="font-medium">Model:</span>{' '}
                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs font-mono">
                                      {profile.modelName}
                                    </code>
                                  </div>
                                  {profile.hasApiKey && (
                                    <div className="text-green-700 text-xs">
                                      ✓ API key saved
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleTestProvider(profile.id)}
                              disabled={testingProfileId === profile.id}
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Test provider connection"
                            >
                              {testingProfileId === profile.id ? (
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(profile.id)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit profile"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {profiles.length > 1 && (
                              <button
                                onClick={() => handleDelete(profile.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Test Results */}
                        {testResults[profile.id] && (
                          <div className={`mt-3 p-3 bg-slate-50 border-l-4 rounded ${
                            testResults[profile.id].isConfigValid ? 'border-green-500' : 'border-red-500'
                          }`}>
                            {testResults[profile.id].isConfigValid ? (
                              <div>
                                <p className="text-sm font-semibold text-green-700">✓ Configuration Valid</p>
                                {testResults[profile.id].connectionTest && (
                                  <div className="mt-2 text-xs text-slate-700">
                                    {testResults[profile.id].connectionTest.isHealthy ? (
                                      <p className="text-green-700">✓ Connection successful! API is responding.</p>
                                    ) : (
                                      <div>
                                        <p className="text-red-700 mb-1">✗ Connection failed</p>
                                        <p className="text-slate-600">{testResults[profile.id].connectionTest.error}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-semibold text-red-700 mb-2">Configuration Issues Found:</p>
                                <ul className="text-xs text-red-700 space-y-1 mb-2">
                                  {testResults[profile.id].issues?.map((issue: string, idx: number) => (
                                    <li key={idx}>• {issue}</li>
                                  ))}
                                </ul>
                                {testResults[profile.id].suggestions && testResults[profile.id].suggestions.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-700 mb-1">Suggestions:</p>
                                    <ul className="text-xs text-slate-700 space-y-1">
                                      {testResults[profile.id].suggestions.map((suggestion: string, idx: number) => (
                                        <li key={idx}>→ {suggestion}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-sm text-slate-700">
                      <strong>How it works:</strong> Select a provider profile to use it for AI requests. Your API keys are stored securely in your browser session and cleared when you close the tab.
                    </p>
                  </div>

                  {/* Fallback Settings */}
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-1">Automatic Fallback</h4>
                        <p className="text-sm text-slate-700">
                          When enabled, if your primary provider fails, OncoAssistant will automatically try other configured providers.
                        </p>
                        {profiles.length > 1 && (
                          <p className="text-xs text-amber-700 mt-2">
                            ⚠️ You have {profiles.length} providers configured. Fallback could switch between them, potentially incurring charges on different services.
                          </p>
                        )}
                      </div>
                      <label className="flex items-center gap-3 flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={enableFallback}
                          onChange={(e) => handleFallbackToggle(e.target.checked)}
                          className="w-5 h-5 text-amber-600 rounded"
                          title="Enable automatic fallback to other providers"
                          aria-label="Automatic Fallback"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {enableFallback ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>

                    {showFallbackWarning && enableFallback && profiles.length > 1 && (
                      <div className="p-3 bg-orange-100 border border-orange-400 rounded text-sm text-orange-800">
                        <strong>Important:</strong> Automatic fallback is now enabled. If your primary provider fails:
                        <ul className="mt-2 ml-4 list-disc space-y-1 text-xs">
                          <li>System will try: {profiles.filter(p => !p.isActive).slice(0, 2).map(p => p.name).join(', ')}</li>
                          <li>You may be charged by multiple providers</li>
                          <li>Check your browser console (F12) to see which provider completed each request</li>
                        </ul>
                        <button
                          onClick={() => setShowFallbackWarning(false)}
                          className="mt-2 text-xs underline hover:no-underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {!enableFallback && (
                      <div className="p-3 bg-blue-100 border border-blue-400 rounded text-sm text-blue-800">
                        <strong>Note:</strong> Fallback is disabled. If your primary provider fails, requests will return an error and no fallback will be attempted.
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {view === 'form' && (
            <>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-slate-400" />
                {editingProfileId ? 'Edit Profile' : 'Create New Profile'}
              </h3>
              <ProviderForm
                profile={editingProfile}
                onSave={handleSaveProfile}
                onCancel={handleCancel}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {view === 'list' && (
          <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

