/**
 * Settings Dialog Component
 * Manages API provider profiles with simple create/edit/delete interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Edit2, Trash2, Plus, AlertCircle, FileText, Save, Upload } from 'lucide-react';
import { profileService, SavedProviderProfile, ProviderListItem } from '@/lib/providers/profileService';
import { ProviderFactory } from '@/lib/providers';
import { ProviderForm } from './ProviderForm';
import { aiService } from '@/lib/aiServiceCompat';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';

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

type Prompt = {
  id: string;
  name: string;
  description: string;
  content: string;
};

type ImportedProfileData = Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>;

type ParsedImportFields = {
  names: string[];
  models: string[];
  providers: string[];
  baseUrls: string[];
  apiKeys: string[];
  shared: {
    name?: string;
    model?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
  };
};

const PROVIDER_TYPE_ALIASES: Record<string, SavedProviderProfile['type']> = {
  gemini: 'gemini',
  googlegemini: 'gemini',
  google: 'gemini',
  openai: 'openai_compatible',
  openaicompatible: 'openai_compatible',
  anthropic: 'anthropic',
  claude: 'anthropic',
  deepseek: 'deepseek',
  qwen: 'qwen',
  alibabaqwen: 'qwen',
  gigachat: 'gigachat',
  sbergigachat: 'gigachat',
  yandexalice: 'alice',
  alice: 'alice',
  openrouter: 'openrouter',
  aitunnel: 'aitunnel',
  local: 'local',
  ollama: 'local',
  lmstudio: 'local',
};

const createEmptyParsedImportFields = (): ParsedImportFields => ({
  names: [],
  models: [],
  providers: [],
  baseUrls: [],
  apiKeys: [],
  shared: {},
});

const normalizeImportKey = (key: string): string =>
  key.toLowerCase().replace(/[\s_\-.]+/g, '');

const stripWrappingQuotes = (value: string): string =>
  value.trim().replace(/^["'`]+|["'`]+$/g, '').trim();

const splitListValue = (value: string): string[] =>
  value
    .split(/[\n,;|]+/)
    .map((item) => stripWrappingQuotes(item))
    .filter(Boolean);

const isLikelyUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value) || /^http:\/\/localhost/i.test(value);

const isLikelyApiKey = (value: string): boolean =>
  /^(sk-|sk_or_|skorv1-|sk-or-v1-|AIza|gsk_|sess-|token-)/i.test(value) || value.length > 20;

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = stripWrappingQuotes(value);
  return normalized || undefined;
};

const getStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? splitListValue(item) : []))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return splitListValue(value);
  }

  return [];
};

const normalizeProviderType = (value?: string, baseUrl?: string, modelName?: string): SavedProviderProfile['type'] => {
  const normalizedValue = normalizeImportKey(value || '');
  if (normalizedValue && PROVIDER_TYPE_ALIASES[normalizedValue]) {
    return PROVIDER_TYPE_ALIASES[normalizedValue];
  }

  const url = (baseUrl || '').toLowerCase();
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('generativelanguage.googleapis.com') || url.includes('googleapis.com')) return 'gemini';
  if (url.includes('anthropic.com')) return 'anthropic';
  if (url.includes('deepseek.com')) return 'deepseek';
  if (url.includes('dashscope') || url.includes('qwen')) return 'qwen';
  if (url.includes('gigachat')) return 'gigachat';
  if (url.includes('yandex') || url.includes('alice')) return 'alice';
  if (url.includes('aitunnel')) return 'aitunnel';
  if (url.includes('localhost:11434') || url.includes('ollama') || url.includes('lmstudio')) return 'local';

  const model = (modelName || '').toLowerCase();
  if (model.startsWith('gemini')) return 'gemini';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.startsWith('qwen')) return 'qwen';

  return 'openai_compatible';
};

const assignParsedValue = (
  field: keyof Omit<ParsedImportFields, 'shared'> | keyof ParsedImportFields['shared'],
  values: string[],
  target: ParsedImportFields,
  index?: number,
) => {
  if (field in target.shared) {
    if (typeof index === 'number') {
      const collection = target[field as keyof Omit<ParsedImportFields, 'shared'>];
      if (Array.isArray(collection) && values[0]) {
        collection[index] = values[0];
      }
      return;
    }

    if (values.length > 1) {
      const collection = target[field as keyof Omit<ParsedImportFields, 'shared'>];
      if (Array.isArray(collection)) {
        values.forEach((value, idx) => {
          collection[idx] = value;
        });
      }
      return;
    }

    target.shared[field as keyof ParsedImportFields['shared']] = values[0];
  }
};

const parseTextImport = (content: string): ParsedImportFields => {
  const parsed = createEmptyParsedImportFields();
  const lines = content.split(/\r?\n/);
  let pendingListField: 'models' | null = null;
  let pendingScalarField: keyof ParsedImportFields['shared'] | null = null;

  const isStructuredImportKey = (value: string): boolean => {
    const normalized = normalizeImportKey(value);
    return [
      'name',
      'profilename',
      'profile',
      'model',
      'modelname',
      'models',
      'provider',
      'providertype',
      'providers',
      'providerforallmodels',
      'baseurl',
      'baseurlforallmodels',
      'apiurl',
      'apiurlforallmodels',
      'url',
      'urlforallmodels',
      'endpoint',
      'apikey',
      'apikeyforallmodels',
      'apiforallmodels',
      'token',
      'tokenforallmodels',
      'key',
      'keyforallmodels',
      'secret',
      'secretforallmodels',
    ].some((knownKey) => normalized === knownKey || normalized.startsWith(`${knownKey}`));
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const providerDashMatch = line.match(/^provider\s*-\s*(.+?)(?:\s*-\s*for\s+all\s+models)?$/i);
    if (providerDashMatch) {
      parsed.shared.provider = stripWrappingQuotes(providerDashMatch[1]);
      pendingListField = null;
      pendingScalarField = null;
      continue;
    }

    const baseUrlDashMatch = line.match(/^base[_\s-]*url\s*-\s*(.+)$/i);
    if (baseUrlDashMatch) {
      parsed.shared.baseUrl = stripWrappingQuotes(baseUrlDashMatch[1]);
      pendingListField = null;
      pendingScalarField = null;
      continue;
    }

    const apiDashMatch = line.match(/^(api(?:[_\s-]*key)?|token|secret)\s*-\s*(.+)$/i);
    if (apiDashMatch) {
      parsed.shared.apiKey = stripWrappingQuotes(apiDashMatch[2]);
      pendingListField = null;
      pendingScalarField = 'apiKey';
      continue;
    }

    const keyValueMatch = line.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
    const keyOnlyMatch = line.match(/^([^:=]+)\s*[:=]\s*$/);

    if (pendingListField === 'models') {
      const looksLikeNewSection =
        (!!keyOnlyMatch && isStructuredImportKey(keyOnlyMatch[1])) ||
        (!!keyValueMatch && isStructuredImportKey(keyValueMatch[1]));

      if (!looksLikeNewSection) {
        parsed.models.push(stripWrappingQuotes(line));
        continue;
      }
    }

    if (!keyValueMatch) {
      if (keyOnlyMatch) {
        const normalizedKey = normalizeImportKey(keyOnlyMatch[1]);
        if (['model', 'modelname', 'models'].includes(normalizedKey)) {
          pendingListField = 'models';
          pendingScalarField = null;
          continue;
        }
      }

      if (pendingListField === 'models') {
        parsed.models.push(stripWrappingQuotes(line));
        continue;
      }

      if (pendingScalarField === 'apiKey' && parsed.shared.apiKey && !line.includes(':') && !line.includes('=')) {
        parsed.shared.apiKey = `${parsed.shared.apiKey}${stripWrappingQuotes(line)}`;
        continue;
      }

      if (!parsed.shared.baseUrl && isLikelyUrl(line)) {
        parsed.shared.baseUrl = stripWrappingQuotes(line);
      } else if (!parsed.shared.apiKey && isLikelyApiKey(line)) {
        parsed.shared.apiKey = stripWrappingQuotes(line);
      }
      continue;
    }

    const [, rawKey, rawValue] = keyValueMatch;
    const normalizedKey = normalizeImportKey(rawKey);
    const values = splitListValue(rawValue);
    if (values.length === 0) continue;

    const indexedMatch = normalizedKey.match(/^(name|profilename|profile|modelname|model|providertype|provider|type|baseurl|apiurl|url|endpoint|apikey|apitoken|token|key|secret)(\d+)$/);
    const index = indexedMatch ? Number(indexedMatch[2]) - 1 : undefined;
    const baseKey = indexedMatch ? indexedMatch[1] : normalizedKey;

    if (['name', 'profilename', 'profile'].includes(baseKey)) {
      assignParsedValue('name', values, parsed, index);
      pendingScalarField = 'name';
      pendingListField = null;
    } else if (['model', 'modelname', 'models'].includes(baseKey)) {
      assignParsedValue('model', values, parsed, index);
      pendingListField = values.length === 0 ? 'models' : null;
      pendingScalarField = null;
    } else if (['providertype', 'provider', 'type', 'providers'].includes(baseKey)) {
      assignParsedValue('provider', values, parsed, index);
      pendingScalarField = 'provider';
      pendingListField = null;
    } else if (['providerforallmodels', 'providersforallmodels'].includes(baseKey)) {
      assignParsedValue('provider', values, parsed, index);
      pendingScalarField = 'provider';
      pendingListField = null;
    } else if (['baseurl', 'apiurl', 'url', 'endpoint', 'urls'].includes(baseKey)) {
      assignParsedValue('baseUrl', values, parsed, index);
      pendingScalarField = 'baseUrl';
      pendingListField = null;
    } else if (['baseurlforallmodels', 'urlforallmodels', 'apiurlforallmodels'].includes(baseKey)) {
      assignParsedValue('baseUrl', values, parsed, index);
      pendingScalarField = 'baseUrl';
      pendingListField = null;
    } else if (['apikey', 'apitoken', 'token', 'key', 'secret', 'keys'].includes(baseKey)) {
      assignParsedValue('apiKey', values, parsed, index);
      pendingScalarField = 'apiKey';
      pendingListField = null;
    } else if (['apiforallmodels', 'apikeyforallmodels', 'tokenforallmodels', 'keyforallmodels', 'secretforallmodels'].includes(baseKey)) {
      assignParsedValue('apiKey', values, parsed, index);
      pendingScalarField = 'apiKey';
      pendingListField = null;
    }
  }

  return parsed;
};

const parseObjectImport = (input: Record<string, unknown>): ParsedImportFields => {
  const parsed = createEmptyParsedImportFields();

  const assignSharedFromAliases = (
    aliases: string[],
    field: keyof ParsedImportFields['shared'],
    collection: keyof Omit<ParsedImportFields, 'shared'>,
  ) => {
    for (const alias of aliases) {
      const value = input[alias];
      if (value === undefined) continue;

      const arrayValue = getStringArray(value);
      if (arrayValue.length > 1) {
        parsed[collection] = arrayValue;
        return;
      }

      const stringValue = getStringValue(value);
      if (stringValue) {
        parsed.shared[field] = stringValue;
        return;
      }
    }
  };

  assignSharedFromAliases(['name', 'profileName', 'profile_name', 'title'], 'name', 'names');
  assignSharedFromAliases(['model', 'modelName', 'model_name', 'models'], 'model', 'models');
  assignSharedFromAliases(['provider', 'providerType', 'provider_type', 'type', 'providers'], 'provider', 'providers');
  assignSharedFromAliases(['baseUrl', 'base_url', 'url', 'apiUrl', 'endpoint', 'urls'], 'baseUrl', 'baseUrls');
  assignSharedFromAliases(['apiKey', 'api_key', 'key', 'token', 'apiToken', 'secret', 'keys'], 'apiKey', 'apiKeys');

  return parsed;
};

const buildImportedProfiles = (data: unknown): ImportedProfileData[] => {
  if (Array.isArray(data)) {
    return data.flatMap((item) => buildImportedProfiles(item));
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Файл не содержит данных профилей');
  }

  const record = data as Record<string, unknown>;

  if (Array.isArray(record.profiles)) {
    return buildImportedProfiles(record.profiles);
  }

  if (Array.isArray(record.providers) && record.providers.every((item) => item && typeof item === 'object')) {
    return buildImportedProfiles(record.providers);
  }

  const parsed = parseObjectImport(record);
  const totalProfiles = Math.max(
    1,
    parsed.names.length,
    parsed.models.length,
    parsed.providers.length,
    parsed.baseUrls.length,
    parsed.apiKeys.length,
  );

  const profiles: ImportedProfileData[] = [];

  for (let index = 0; index < totalProfiles; index++) {
    const rawModelName = parsed.models[index] || parsed.shared.model || '';
    const rawBaseUrl = parsed.baseUrls[index] || parsed.shared.baseUrl || '';
    const rawApiKey = parsed.apiKeys[index] || parsed.shared.apiKey || '';
    const rawProvider = parsed.providers[index] || parsed.shared.provider || '';
    const type = normalizeProviderType(rawProvider, rawBaseUrl, rawModelName);
    const template = ProviderFactory.getProviderTemplate(type);
    const modelName = rawModelName || String(template.modelName || '');
    const baseUrl = rawBaseUrl || String(template.baseUrl || '');
    const baseName = parsed.names[index] || parsed.shared.name || '';
    const providerLabel = PROVIDER_LABELS[type] || type;
    const name = totalProfiles > 1
      ? (baseName ? `${baseName} - ${modelName || index + 1}` : `${providerLabel} - ${modelName || index + 1}`)
      : (baseName || `${providerLabel} - ${modelName || 'imported'}`);

    if (!modelName) {
      throw new Error('Не удалось определить название модели из импортируемого файла');
    }

    profiles.push({
      name,
      type,
      modelName,
      baseUrl,
      apiKey: rawApiKey,
      isActive: false,
    });
  }

  return profiles;
};

const parseImportedProfiles = (content: string): ImportedProfileData[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Файл пустой');
  }

  try {
    return buildImportedProfiles(JSON.parse(trimmed));
  } catch {
    const parsedText = parseTextImport(trimmed);
    return buildImportedProfiles(parsedText.shared.model || parsedText.models.length > 0
      ? {
          name: parsedText.shared.name,
          model: parsedText.models.length > 0 ? parsedText.models : parsedText.shared.model,
          provider: parsedText.providers.length > 0 ? parsedText.providers : parsedText.shared.provider,
          baseUrl: parsedText.baseUrls.length > 0 ? parsedText.baseUrls : parsedText.shared.baseUrl,
          apiKey: parsedText.apiKeys.length > 0 ? parsedText.apiKeys : parsedText.shared.apiKey,
        }
      : parsedText);
  }
};

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'providers' | 'prompts'>('providers');
  const [profiles, setProfiles] = useState<ProviderListItem[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<SavedProviderProfile | null>(null);
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [enableFallback, setEnableFallback] = useState(true);
  const [fallbackProfileIds, setFallbackProfileIds] = useState<string[]>([]);
  const [showFallbackWarning, setShowFallbackWarning] = useState(false);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState('');
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const loadedProfiles = loadProfiles();
      loadFallbackSetting(loadedProfiles);
      if (activeTab === 'prompts') {
        loadPrompts();
      }
      setView('list');
    }
  }, [isOpen, activeTab]);

  const loadPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const stored = localStorage.getItem('onco_prompts');
      if (stored) {
        setPrompts(JSON.parse(stored));
      } else {
        // Default prompt if empty
        const defaultPrompts = [
          {
            id: '1',
            name: 'Системный промпт',
            description: 'Базовые инструкции для ИИ-помощника',
            content: 'Ты - опытный онколог и специалист по диагностике. Используй доступную информацию для предложения наиболее вероятных диагнозов и практических рекомендаций.'
          }
        ];
        setPrompts(defaultPrompts);
        localStorage.setItem('onco_prompts', JSON.stringify(defaultPrompts));
      }
    } catch (err) {
      console.error('Failed to load prompts', err);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handleSavePrompt = async (id: string) => {
    try {
      const newPrompts = prompts.map(p => p.id === id ? { ...p, content: promptContent } : p);
      setPrompts(newPrompts);
      localStorage.setItem('onco_prompts', JSON.stringify(newPrompts));
      setEditingPromptId(null);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении промпта');
    }
  };

  const loadProfiles = () => {
    const loadedProfiles = profileService.getAllProfiles();
    setProfiles(loadedProfiles);
    return loadedProfiles;
  };

  const loadFallbackSetting = (availableProfiles: ProviderListItem[] = profiles) => {
    try {
      const settings = localStorage.getItem('ai_settings_enhanced');
      if (settings) {
        const parsed = JSON.parse(settings);
        setEnableFallback(parsed.enableFallback !== false);
        const availableIds = new Set(availableProfiles.map((profile) => profile.id));
        const primaryProfileId =
          typeof parsed.activeProfileId === 'string' && availableIds.has(parsed.activeProfileId)
            ? parsed.activeProfileId
            : availableProfiles.find((profile) => profile.isActive)?.id;
        const storedFallbacks = Array.isArray(parsed.fallbackProfileIds) ? parsed.fallbackProfileIds : [];
        setFallbackProfileIds(
          storedFallbacks.filter(
            (profileId: string, index: number) =>
              typeof profileId === 'string' &&
              storedFallbacks.indexOf(profileId) === index &&
              availableIds.has(profileId) &&
              profileId !== primaryProfileId,
          ),
        );
      } else {
        setEnableFallback(true);
        setFallbackProfileIds([]);
      }
    } catch (error) {
      console.error('Error loading fallback setting:', error);
      setEnableFallback(true);
      setFallbackProfileIds([]);
    }
  };

  const saveFallbackConfiguration = (
    nextEnableFallback: boolean,
    nextFallbackProfileIds: string[],
    nextActiveProfileId?: string,
  ) => {
    try {
      const settings = localStorage.getItem('ai_settings_enhanced');
      const parsed = settings ? JSON.parse(settings) : {};
      const activeProfileId =
        nextActiveProfileId || parsed.activeProfileId || profiles.find((profile) => profile.isActive)?.id || '';

      parsed.enableFallback = nextEnableFallback;
      parsed.activeProfileId = activeProfileId;
      parsed.fallbackProfileIds = nextFallbackProfileIds.filter((profileId, index, all) => {
        return (
          typeof profileId === 'string' &&
          profileId !== activeProfileId &&
          all.indexOf(profileId) === index
        );
      });
      localStorage.setItem('ai_settings_enhanced', JSON.stringify(parsed));
    } catch (error) {
      console.error('Error saving fallback setting:', error);
    }
  };

  const handleFallbackToggle = (newValue: boolean) => {
    if (fallbackProfileIds.length > 0 && newValue) {
      // Enabling fallback with multiple profiles
      setShowFallbackWarning(true);
    }
    
    setEnableFallback(newValue);
    saveFallbackConfiguration(newValue, fallbackProfileIds);
  };

  const handleFallbackProfilesChange = (nextFallbackProfileIds: string[]) => {
    const primaryProfileId = profiles.find((profile) => profile.isActive)?.id;
    const sanitized = nextFallbackProfileIds.filter((profileId) => profileId !== primaryProfileId);
    setFallbackProfileIds(sanitized);
    saveFallbackConfiguration(enableFallback, sanitized, primaryProfileId);
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
      const nextProfiles = loadProfiles();
      const nextActiveProfileId = nextProfiles.find((profile) => profile.isActive)?.id;
      const nextFallbacks = fallbackProfileIds.filter((profileId) => profileId !== id && profileId !== nextActiveProfileId);
      setFallbackProfileIds(nextFallbacks);
      saveFallbackConfiguration(enableFallback, nextFallbacks, nextActiveProfileId);
      aiService.syncProviderRuntime();
    }
  };

  const handleSetActive = (id: string) => {
    profileService.setActiveProfile(id);
    const nextFallbacks = fallbackProfileIds.filter((profileId) => profileId !== id);
    setFallbackProfileIds(nextFallbacks);
    saveFallbackConfiguration(enableFallback, nextFallbacks, id);
    loadProfiles();
    aiService.syncProviderRuntime();
  };

  const handleSaveProfile = async (data: Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingProfileId) {
        await profileService.updateProfileWithMetadata(editingProfileId, data);
      } else {
        await profileService.createProfileWithMetadata(data);
      }
      const nextProfiles = loadProfiles();
      loadFallbackSetting(nextProfiles);
      aiService.syncProviderRuntime();
      setView('list');
    } catch (error) {
      console.error('Failed to save provider profile:', error);
      alert('Ошибка при сохранении профиля провайдера');
    }
  };

  const handleCancel = () => {
    setView('list');
    setEditingProfileId(null);
    setEditingProfile(null);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const profilesToCreate = parseImportedProfiles(content);
        await Promise.all(
          profilesToCreate.map((profile) => profileService.createProfileWithMetadata(profile)),
        );

        alert(`Успешно импортировано профилей: ${profilesToCreate.length}`);
        const nextProfiles = loadProfiles();
        loadFallbackSetting(nextProfiles);
        aiService.syncProviderRuntime();
      } catch (err: any) {
        alert('Ошибка при импорте: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <Settings className="w-5 h-5" />
              Настройки ИИ
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('providers')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'providers' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Провайдеры
              </button>
              <button 
                onClick={() => setActiveTab('prompts')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'prompts' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Промпты
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            title="Close settings dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'providers' && (
            <>
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
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportFile} 
                        className="hidden" 
                        accept=".json,.txt"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                        title="Импорт профилей (JSON/TXT)"
                      >
                        <Upload className="w-4 h-4" />
                        Импорт
                      </button>
                      <button
                        onClick={handleAddNew}
                        className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить
                      </button>
                    </div>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestProvider(profile.id);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(profile.id);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit profile"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {profiles.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(profile.id);
                                }}
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
                          Если включено, OncoAssistant будет переходить только к тем резервным моделям, которые вы явно выбрали ниже.
                        </p>
                        {profiles.length > 1 && (
                          <p className="text-xs text-amber-700 mt-2">
                            ⚠️ Автопереключение больше не использует все подряд профили. Будут пробоваться только выбранные резервные модели.
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

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-slate-900">Предпочтительная модель</div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          {profiles.find((profile) => profile.isActive)?.name || 'Не выбрана'}
                        </div>
                        <p className="text-xs text-slate-500">
                          Используется для текущего запроса в первую очередь.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-slate-900">Резервные модели</div>
                        <MultiSelect
                          options={profiles
                            .filter((profile) => !profile.isActive)
                            .map((profile) => ({
                              value: profile.id,
                              label: `${profile.name} (${PROVIDER_LABELS[profile.type] || profile.type})`,
                            }))}
                          selected={fallbackProfileIds}
                          onChange={handleFallbackProfilesChange}
                          placeholder="Выберите резервные модели"
                        />
                        <p className="text-xs text-slate-500">
                          Порядок автопереключения соответствует порядку выбора моделей.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium text-slate-900 mb-2">Прочие доступные модели</div>
                      {profiles.filter((profile) => !profile.isActive && !fallbackProfileIds.includes(profile.id)).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profiles
                            .filter((profile) => !profile.isActive && !fallbackProfileIds.includes(profile.id))
                            .map((profile) => (
                              <span
                                key={profile.id}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                              >
                                {profile.name}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Все доступные модели уже выбраны как резервные.</p>
                      )}
                    </div>

                    {showFallbackWarning && enableFallback && fallbackProfileIds.length > 0 && (
                      <div className="p-3 bg-orange-100 border border-orange-400 rounded text-sm text-orange-800">
                        <strong>Важно:</strong> Автопереключение включено. Если основная модель не сработает:
                        <ul className="mt-2 ml-4 list-disc space-y-1 text-xs">
                          <li>Система попробует только выбранные вами резервные модели: {fallbackProfileIds.map((profileId) => profiles.find((profile) => profile.id === profileId)?.name || profileId).join(', ')}</li>
                          <li>Остальные профили не будут использоваться автоматически</li>
                          <li>Возможны расходы у нескольких провайдеров, если резервные модели платные</li>
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
                        <strong>Примечание:</strong> Автопереключение выключено. Если основная модель не ответит, запрос завершится ошибкой без перехода к резервным.
                      </div>
                    )}

                    {enableFallback && fallbackProfileIds.length === 0 && (
                      <div className="p-3 bg-slate-100 border border-slate-300 rounded text-sm text-slate-700">
                        Резервные модели не выбраны. Даже при включённом автопереключении система не будет использовать другие профили, пока вы их явно не добавите.
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'providers' && view === 'form' && (
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

          {activeTab === 'prompts' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Системные инструкции (Промпты)
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  Здесь вы можете изменить инструкции, которые отправляются нейросети перед генерацией ответа. Это позволяет настроить стиль и фокус внимания ИИ.
                </p>
              </div>

              {isLoadingPrompts ? (
                <div className="text-center py-8 text-slate-500">Загрузка промптов...</div>
              ) : (
                <div className="space-y-4">
                  {prompts.map(prompt => (
                    <div key={prompt.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900">{prompt.name}</h4>
                          <p className="text-xs text-slate-500">{prompt.description}</p>
                        </div>
                        {editingPromptId !== prompt.id && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setEditingPromptId(prompt.id);
                              setPromptContent(prompt.content);
                            }}
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4 mr-1" /> Изменить
                          </Button>
                        )}
                      </div>
                      
                      {editingPromptId === prompt.id ? (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={promptContent}
                            onChange={(e) => setPromptContent(e.target.value)}
                            className="w-full min-h-[150px] p-3 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setEditingPromptId(null)}>Отмена</Button>
                            <Button onClick={() => handleSavePrompt(prompt.id)} className="gap-2">
                              <Save className="w-4 h-4" /> Сохранить
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 bg-slate-50 p-3 rounded-md border border-slate-100">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">{prompt.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(view === 'list' || activeTab === 'prompts') && (
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

