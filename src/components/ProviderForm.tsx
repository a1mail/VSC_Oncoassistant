/**
 * Provider Form Component
 * Used for creating and editing API provider profiles
 */

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ProviderFactory, ProviderType } from '@/lib/providers';
import { SavedProviderProfile } from '@/lib/providers/profileService';
import { EnhancedAIProfile } from '@/lib/providers/types';

interface ProviderFormProps {
  profile: Partial<SavedProviderProfile> | null;
  onSave: (data: Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const PROVIDER_INFO: Record<string, { label: string; docs: string }> = {
  gemini: {
    label: 'Google Gemini',
    docs: 'Get key from: https://ai.google.dev/app',
  },
  openai_compatible: {
    label: 'OpenAI Compatible',
    docs: 'Works with OpenAI, DeepSeek, Ollama, and other compatible APIs',
  },
  anthropic: {
    label: 'Anthropic Claude',
    docs: 'Get key from: https://console.anthropic.com',
  },
  deepseek: {
    label: 'DeepSeek',
    docs: 'Get key from: https://platform.deepseek.com',
  },
  qwen: {
    label: 'Alibaba QWEN',
    docs: 'Get key from: https://dashscope.aliyuncs.com',
  },
  gigachat: {
    label: 'Sberbank GigaChat',
    docs: 'Get credentials from: https://develop.sber.ru',
  },
  alice: {
    label: 'Yandex Alice API',
    docs: 'Get credentials from: https://yandex.cloud',
  },
  openrouter: {
    label: 'OpenRouter',
    docs: 'Get key from: https://openrouter.ai',
  },
  aitunnel: {
    label: 'AITunnel',
    docs: 'Multi-provider API aggregator',
  },
  local: {
    label: 'Local (Ollama/LM Studio)',
    docs: 'Run models locally on your machine',
  },
};

export function ProviderForm({ profile, onSave, onCancel }: ProviderFormProps) {
  const [formData, setFormData] = useState<Partial<SavedProviderProfile>>({
    name: profile?.name || '',
    type: profile?.type || 'openai_compatible',
    modelName: profile?.modelName || '',
    baseUrl: profile?.baseUrl || '',
    apiKey: profile?.apiKey || '',
    isActive: profile?.isActive ?? true,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{isHealthy: boolean; error?: string} | null>(null);

  const providerType = formData.type as ProviderType;
  const providerInfo = PROVIDER_INFO[providerType];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.modelName?.trim()) {
      newErrors.modelName = 'Model name is required';
    }

    if (providerType !== 'local' && providerType !== 'gemini') {
      if (!formData.baseUrl?.trim()) {
        newErrors.baseUrl = 'Base URL is required';
      }
      if (!formData.apiKey?.trim()) {
        newErrors.apiKey = 'API key is required';
      }
    }

    if (providerType === 'gemini' && !formData.apiKey?.trim()) {
      newErrors.apiKey = 'API key is required for Gemini';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSave(formData as Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>);
  };

  const getModelPlaceholder = (): string => {
    const template = ProviderFactory.getProviderTemplate(providerType);
    return template.modelName || 'model-name';
  };

  const getUrlPlaceholder = (): string => {
    const template = ProviderFactory.getProviderTemplate(providerType);
    return template.baseUrl || 'https://api.example.com/v1';
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const template = ProviderFactory.getProviderTemplate(providerType);
      const tempProfile: EnhancedAIProfile = {
        id: 'test-temp-id',
        name: formData.name?.trim() || 'Тестовый профиль',
        providerType,
        apiKey: (formData.apiKey || '').trim(),
        baseUrl: (formData.baseUrl || '').trim() || String(template.baseUrl || ''),
        modelName: (formData.modelName || '').trim() || String(template.modelName || ''),
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
        priority: template.priority || 5,
      };
      
      const adapter = ProviderFactory.createAdapter(tempProfile);
      const result = await adapter.testConnection();
      
      setTestResult({
        isHealthy: result.isHealthy,
        error: result.error
      });
    } catch (error: any) {
      setTestResult({
        isHealthy: false,
        error: error.message || 'Ошибка при тестировании соединения'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Alert: API Key Security */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Important:</strong> API keys are stored securely in your browser's local storage and never sent anywhere except to the AI provider you configure.
        </div>
      </div>

      {/* Required Fields Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Required Fields:</strong> Profile Name, Provider Type, Model Name{providerType !== 'local' && ', API Base URL, and API Key'}
          {providerType === 'local' && ' and Local API URL'}
        </p>
      </div>

      {/* Profile Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Profile Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            setTestResult(null);
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          placeholder="e.g., My ChatGPT Pro, Local Llama Model"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
            errors.name
              ? 'border-red-300 focus:ring-red-500'
              : 'border-slate-300 focus:ring-blue-500'
          }`}
        />
        {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
      </div>

      {/* Provider Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          AI Provider <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.type || ''}
          onChange={(e) => {
            setFormData({ ...formData, type: e.target.value as ProviderType });
            setTestResult(null);
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          title="Select AI provider type"
          aria-label="AI Provider"
        >
          {Object.entries(PROVIDER_INFO).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {providerInfo && (
          <p className="text-xs text-slate-500 mt-1.5">{providerInfo.docs}</p>
        )}
      </div>

      {/* Model Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Model Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.modelName || ''}
          onChange={(e) => {
            setFormData({ ...formData, modelName: e.target.value });
            setTestResult(null);
            if (errors.modelName) setErrors({ ...errors, modelName: '' });
          }}
          placeholder={getModelPlaceholder()}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
            errors.modelName
              ? 'border-red-300 focus:ring-red-500'
              : 'border-slate-300 focus:ring-blue-500'
          }`}
        />
        {errors.modelName && <p className="text-xs text-red-600 mt-1">{errors.modelName}</p>}
        <p className="text-xs text-slate-500 mt-1.5">
          {providerType === 'gemini' && 'gemini-2.0-flash, gemini-1.5-pro, etc.'}
          {providerType === 'openai_compatible' && 'gpt-4o, gpt-4-turbo, gpt-3.5-turbo, etc.'}
          {providerType === 'anthropic' && 'claude-3-sonnet-20240229, claude-3-opus-20240229, etc.'}
          {providerType === 'local' && 'llama2, mistral, neural-chat, etc.'}
          {['deepseek', 'qwen', 'gigachat', 'alice', 'openrouter', 'aitunnel'].includes(providerType) && 'Check provider documentation for available models'}
        </p>
      </div>

      {/* Base URL - Only for non-local variants */}
      {providerType !== 'local' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            API Base URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={formData.baseUrl || ''}
            onChange={(e) => {
              setFormData({ ...formData, baseUrl: e.target.value });
              setTestResult(null);
              if (errors.baseUrl) setErrors({ ...errors, baseUrl: '' });
            }}
            placeholder={getUrlPlaceholder()}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition font-mono text-sm ${
              errors.baseUrl
                ? 'border-red-300 focus:ring-red-500'
                : 'border-slate-300 focus:ring-blue-500'
            }`}
          />
          {errors.baseUrl && <p className="text-xs text-red-600 mt-1">{errors.baseUrl}</p>}
          <p className="text-xs text-slate-500 mt-1.5">
            {providerType === 'openai_compatible' && (
              <>
                Examples: OpenAI: <code className="bg-slate-100 px-1">https://api.openai.com/v1</code>,
                DeepSeek: <code className="bg-slate-100 px-1">https://api.deepseek.com</code>,
                Ollama: <code className="bg-slate-100 px-1">http://localhost:11434/v1</code>
              </>
            )}
            {providerType === 'deepseek' && (
              <code className="bg-slate-100 px-1">https://api.deepseek.com</code>
            )}
            {providerType === 'qwen' && (
              <code className="bg-slate-100 px-1">https://dashscope.aliyuncs.com/compatible-mode/v1</code>
            )}
            {providerType === 'gigachat' && (
              <code className="bg-slate-100 px-1">https://gigachat.devices.sberbank.ru/api/v1</code>
            )}
            {providerType === 'anthropic' && (
              <code className="bg-slate-100 px-1">https://api.anthropic.com/v1</code>
            )}
          </p>
        </div>
      )}

      {/* API Key */}
      {providerType !== 'local' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            API Key <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={formData.apiKey || ''}
              onChange={(e) => {
                setFormData({ ...formData, apiKey: e.target.value });
                setTestResult(null);
                if (errors.apiKey) setErrors({ ...errors, apiKey: '' });
              }}
              placeholder="sk-... or secret-... or your-api-key"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition pr-10 font-mono text-sm ${
                errors.apiKey
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title={showApiKey ? 'Hide key' : 'Show key'}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.apiKey && <p className="text-xs text-red-600 mt-1">{errors.apiKey}</p>}
          <p className="text-xs text-slate-500 mt-1.5">
            Keep your API key confidential. It will only be stored in your browser session.
          </p>
        </div>
      )}

      {/* Set as Active */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive ?? true}
          onChange={(e) => {
            setFormData({ ...formData, isActive: e.target.checked });
            setTestResult(null);
          }}
          className="w-4 h-4 rounded border-slate-300 text-blue-600"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
          Use this profile by default
        </label>
      </div>

      {/* Form Actions */}
      <div className="pt-4 border-t space-y-4">
        {/* Test Connection Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex-1">
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.isHealthy ? 'text-green-600 font-medium' : 'text-red-600'}`}>
                {testResult.isHealthy ? (
                  <><CheckCircle className="w-4 h-4" /> Соединение установлено (OK)</>
                ) : (
                  <><AlertCircle className="w-4 h-4" /> Ошибка: {testResult.error}</>
                )}
              </div>
            )}
            {!testResult && <span className="text-sm text-slate-500">Проверьте настройки перед сохранением</span>}
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Тестирование...</> : 'Тест соединения'}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Сохранить профиль
          </button>
        </div>
      </div>
    </form>
  );
}
