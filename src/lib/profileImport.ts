import { SavedProviderProfile } from '@/lib/providers/profileService';
import { ProviderFactory } from '@/lib/providers/factory';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai_compatible: 'OpenAI Compatible',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  qwen: 'Alibaba QWEN',
  gigachat: 'Sber GigaChat',
  alice: 'Yandex Alice',
  openrouter: 'OpenRouter',
  aitunnel: 'AITunnel',
  local: 'Local (Ollama/LM Studio)',
};

export type ImportedProfileData = Omit<SavedProviderProfile, 'id' | 'createdAt' | 'updatedAt'>;

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

const isLikelyApiEndpoint = (value: string): boolean => {
  const url = value.toLowerCase();
  return (
    url.includes('/api') ||
    /\/v\d+\b/.test(url) ||
    url.includes('localhost') ||
    url.includes('openrouter.ai') ||
    url.includes('googleapis.com') ||
    url.includes('generativelanguage.googleapis.com')
  );
};

const isLikelyApiKey = (value: string): boolean =>
  /^(sk-|sk_or_|skorv1-|sk-or-v1-|AIza|gsk_|sess-|token-)/i.test(value) || /[A-Za-z0-9][A-Za-z0-9_-]{23,}/.test(value);

const looksLikeModelIdentifier = (value: string): boolean => {
  const candidate = stripWrappingQuotes(value);
  if (!candidate || isLikelyUrl(candidate)) return false;
  if (candidate.includes(' ')) return false;
  if (/^[\w.-]+\/[\w.:+-]+$/i.test(candidate)) return true;
  if (/^[A-Za-z0-9._:-]{4,}$/.test(candidate) && /[A-Za-z]/.test(candidate) && /[0-9:/_-]/.test(candidate)) {
    return true;
  }
  return /^(gemini|gpt|claude|deepseek|qwen|llama|mistral|nemotron|glm|mixtral|yi|o\d)/i.test(candidate);
};

const providerAliasEntries = Object.entries(PROVIDER_TYPE_ALIASES).sort((a, b) => b[0].length - a[0].length);

const detectProviderTypeHint = (value?: string): SavedProviderProfile['type'] | undefined => {
  if (!value) return undefined;
  const normalized = normalizeImportKey(value);
  if (normalized && PROVIDER_TYPE_ALIASES[normalized]) {
    return PROVIDER_TYPE_ALIASES[normalized];
  }

  const compact = value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const [alias, providerType] of providerAliasEntries) {
    if (compact.includes(alias)) {
      return providerType;
    }
  }

  return undefined;
};

const inferFieldByKeyContext = (
  rawKey: string,
): 'name' | 'model' | 'provider' | 'baseUrl' | 'apiKey' | null => {
  const normalized = normalizeImportKey(rawKey);
  if (!normalized) return null;

  const hasAny = (...tokens: string[]) => tokens.some((token) => normalized.includes(token));

  if (hasAny('apikey', 'apitoken', 'token', 'secret', 'auth', 'bearer', 'credential', 'accesskey', 'key')) {
    return 'apiKey';
  }
  if (hasAny('baseurl', 'apiurl', 'endpoint', 'host', 'server', 'url')) {
    return 'baseUrl';
  }
  if (hasAny('providertype', 'provider', 'vendor', 'service', 'gateway', 'aggregator', 'platform')) {
    return 'provider';
  }
  if (hasAny('modelname', 'modelid', 'engine', 'llm', 'model')) {
    return 'model';
  }
  if (hasAny('profilename', 'profile', 'name', 'title')) {
    return 'name';
  }

  return null;
};

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
  const explicitProvider = detectProviderTypeHint(value);
  if (explicitProvider) {
    return explicitProvider;
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
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return 'openai_compatible';
  }
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.startsWith('qwen')) return 'qwen';
  if (model.startsWith('grok')) return 'openai_compatible';

  return 'openai_compatible';
};

const assignParsedValue = (
  field: keyof Omit<ParsedImportFields, 'shared'> | keyof ParsedImportFields['shared'],
  values: string[],
  target: ParsedImportFields,
  index?: number,
) => {
  const collectionBySharedField: Record<keyof ParsedImportFields['shared'], keyof Omit<ParsedImportFields, 'shared'>> = {
    name: 'names',
    model: 'models',
    provider: 'providers',
    baseUrl: 'baseUrls',
    apiKey: 'apiKeys',
  };

  if ((field as string) in collectionBySharedField) {
    const sharedField = field as keyof ParsedImportFields['shared'];
    const collectionField = collectionBySharedField[sharedField];
    const collection = target[collectionField];

    if (typeof index === 'number') {
      if (values[0]) {
        collection[index] = values[0];
      }
      return;
    }

    if (values.length > 1) {
      values.forEach((value, idx) => {
        collection[idx] = value;
      });
      return;
    }

    if (values[0]) {
      target.shared[sharedField] = values[0];
    }
    return;
  }

  const collection = target[field as keyof Omit<ParsedImportFields, 'shared'>];
  if (Array.isArray(collection)) {
    values.forEach((value, idx) => {
      collection[typeof index === 'number' ? index + idx : idx] = value;
    });
  }
};

const parseTextImport = (content: string): ParsedImportFields => {
  const parsed = createEmptyParsedImportFields();
  const lines = content.split(/\r?\n/);
  let pendingListField: 'models' | null = null;
  let pendingScalarField: keyof ParsedImportFields['shared'] | null = null;

  const isStructuredImportKey = (value: string): boolean => {
    const normalized = normalizeImportKey(value);
    if (inferFieldByKeyContext(value)) {
      return true;
    }
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
    const cleanedLine = stripWrappingQuotes(line);
    const providerHint = detectProviderTypeHint(cleanedLine);

    if (
      providerHint &&
      !isLikelyUrl(cleanedLine) &&
      !looksLikeModelIdentifier(cleanedLine) &&
      !parsed.shared.provider
    ) {
      parsed.shared.provider = providerHint;
    }

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

    const keyValueMatch = line.match(/^([^:=]+)\s*[:=]\s*(.*)$/);
    const keyOnlyMatch = line.match(/^([^:=]+)\s*[:=]\s*$/);

    if (pendingListField === 'models') {
      const looksLikeNewSection =
        (!!keyOnlyMatch && isStructuredImportKey(keyOnlyMatch[1])) ||
        (!!keyValueMatch && isStructuredImportKey(keyValueMatch[1]));

      if (!looksLikeNewSection) {
        if (looksLikeModelIdentifier(cleanedLine) || cleanedLine.includes('/')) {
          parsed.models.push(cleanedLine);
          continue;
        }
      }
    }

    if (!keyValueMatch) {
      if (keyOnlyMatch) {
        const inferredField = inferFieldByKeyContext(keyOnlyMatch[1]);
        const normalizedKey = normalizeImportKey(keyOnlyMatch[1]);
        if (inferredField === 'model' || ['model', 'modelname', 'models'].includes(normalizedKey)) {
          pendingListField = 'models';
          pendingScalarField = null;
          continue;
        }
        if (inferredField === 'apiKey') {
          pendingScalarField = 'apiKey';
          pendingListField = null;
          continue;
        }
      }

      if (pendingListField === 'models' && looksLikeModelIdentifier(cleanedLine)) {
        parsed.models.push(cleanedLine);
        continue;
      }

      if (pendingScalarField === 'apiKey' && parsed.shared.apiKey && !line.includes(':') && !line.includes('=')) {
        parsed.shared.apiKey = `${parsed.shared.apiKey}${cleanedLine}`;
        continue;
      }

      if (isLikelyUrl(cleanedLine) && !parsed.shared.baseUrl && (isLikelyApiEndpoint(cleanedLine) || pendingScalarField === 'baseUrl')) {
        parsed.shared.baseUrl = cleanedLine;
        continue;
      }

      if (isLikelyApiKey(cleanedLine) && !parsed.shared.apiKey) {
        parsed.shared.apiKey = cleanedLine;
        continue;
      }

      if (!parsed.shared.model && looksLikeModelIdentifier(cleanedLine)) {
        parsed.models.push(cleanedLine);
        continue;
      }

      if (providerHint && !parsed.shared.provider) {
        parsed.shared.provider = providerHint;
      }
      continue;
    }

    const [, rawKey, rawValue] = keyValueMatch;
    const normalizedKey = normalizeImportKey(rawKey);
    const inferredField = inferFieldByKeyContext(rawKey);
    const values = splitListValue(rawValue);
    const indexedMatch = normalizedKey.match(
      /^(name|profilename|profile|modelname|model|providertype|provider|type|baseurl|apiurl|url|endpoint|apikey|apitoken|token|key|secret)(\d+)$/,
    );
    const index = indexedMatch ? Number(indexedMatch[2]) - 1 : undefined;
    const baseKey = indexedMatch ? indexedMatch[1] : normalizedKey;
    const resolvedField =
      (['name', 'profilename', 'profile'].includes(baseKey) && 'name') ||
      (['model', 'modelname', 'models'].includes(baseKey) && 'model') ||
      (['providertype', 'provider', 'type', 'providers', 'providerforallmodels', 'providersforallmodels'].includes(baseKey) &&
        'provider') ||
      (['baseurl', 'apiurl', 'url', 'endpoint', 'urls', 'baseurlforallmodels', 'urlforallmodels', 'apiurlforallmodels'].includes(baseKey) &&
        'baseUrl') ||
      (['apikey', 'apitoken', 'token', 'key', 'secret', 'keys', 'apiforallmodels', 'apikeyforallmodels', 'tokenforallmodels', 'keyforallmodels', 'secretforallmodels'].includes(baseKey) &&
        'apiKey') ||
      inferredField;

    if (resolvedField === 'model' && values.length === 0) {
      pendingListField = 'models';
      pendingScalarField = null;
      continue;
    }

    if (resolvedField === 'apiKey' && values.length === 0) {
      pendingScalarField = 'apiKey';
      pendingListField = null;
      continue;
    }

    if (resolvedField === 'name' && values.length > 0) {
      assignParsedValue('name', values, parsed, index);
      pendingScalarField = 'name';
      pendingListField = null;
    } else if (resolvedField === 'model' && values.length > 0) {
      assignParsedValue('model', values, parsed, index);
      pendingListField = null;
      pendingScalarField = null;
    } else if (resolvedField === 'provider' && values.length > 0) {
      assignParsedValue('provider', values, parsed, index);
      pendingScalarField = 'provider';
      pendingListField = null;
    } else if (resolvedField === 'baseUrl' && values.length > 0) {
      assignParsedValue('baseUrl', values, parsed, index);
      pendingScalarField = 'baseUrl';
      pendingListField = null;
    } else if (resolvedField === 'apiKey' && values.length > 0) {
      assignParsedValue('apiKey', values, parsed, index);
      pendingScalarField = 'apiKey';
      pendingListField = null;
    } else if (values.length > 0) {
      const firstValue = values[0];
      if (!parsed.shared.baseUrl && isLikelyUrl(firstValue) && (isLikelyApiEndpoint(firstValue) || inferredField === 'baseUrl')) {
        parsed.shared.baseUrl = firstValue;
      } else if (!parsed.shared.apiKey && isLikelyApiKey(firstValue)) {
        parsed.shared.apiKey = firstValue;
      } else if (!parsed.shared.model && looksLikeModelIdentifier(firstValue)) {
        parsed.models.push(firstValue);
      } else {
        const keyProviderHint = detectProviderTypeHint(`${rawKey} ${rawValue}`);
        if (keyProviderHint && !parsed.shared.provider) {
          parsed.shared.provider = keyProviderHint;
        }
      }
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

  for (const [rawKey, value] of Object.entries(input)) {
    const inferredField = inferFieldByKeyContext(rawKey);
    if (!inferredField) continue;

    const asArray = getStringArray(value);
    const asSingle = getStringValue(value);
    if (asArray.length === 0 && !asSingle) continue;

    if (inferredField === 'model') {
      if (asArray.length > 1) {
        parsed.models = asArray;
      } else if (!parsed.shared.model) {
        parsed.shared.model = asSingle || asArray[0];
      }
      continue;
    }

    if (inferredField === 'provider') {
      if (asArray.length > 1) {
        parsed.providers = asArray;
      } else if (!parsed.shared.provider) {
        parsed.shared.provider = asSingle || asArray[0];
      }
      continue;
    }

    if (inferredField === 'baseUrl') {
      if (asArray.length > 1) {
        parsed.baseUrls = asArray;
      } else if (!parsed.shared.baseUrl) {
        parsed.shared.baseUrl = asSingle || asArray[0];
      }
      continue;
    }

    if (inferredField === 'apiKey') {
      if (asArray.length > 1) {
        parsed.apiKeys = asArray;
      } else if (!parsed.shared.apiKey) {
        parsed.shared.apiKey = asSingle || asArray[0];
      }
      continue;
    }
  }

  return parsed;
};

const buildImportedProfiles = (data: unknown): ImportedProfileData[] => {
  if (Array.isArray(data)) {
    return data.flatMap((item) => buildImportedProfiles(item));
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Import file does not contain provider profile data');
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
      throw new Error('Failed to detect model name from imported data');
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
    throw new Error('Import file is empty');
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


export { parseImportedProfiles };
