# Multi-Provider AI System - Quick Start Guide

## Overview
The OncoAssistant now supports 10+ AI providers with intelligent selection, health monitoring, and automatic fallback capabilities.

---

## For Users

### Adding a New AI Provider

1. **Open Settings** → Click "Добавить профиль" (Add Profile)
2. **Choose Provider Type** from dropdown:
   - Google Gemini
   - OpenAI-Compatible (ChatGPT, DeepSeek, Local)
   - Anthropic Claude
   - And 7 more...
3. **Configure Connection**:
   - Enter Base URL (defaults provided)
   - Paste API Key (if required)
   - Select Model Name
4. **Optional Settings**:
   - Enable/disable specific provider
   - Set priority (1-10, higher = selected first)
   - Toggle capabilities (images, JSON)
5. **Test Connection** → Click test button to verify
6. **Save** and make active

### Selecting a Provider Strategy

Settings → "Стратегия выбора провайдера"

- **FastestFirst** (default): Prioritizes response speed
- **CheapestFirst**: Minimizes costs
- **MostReliable**: Maximizes success rate  
- **RoundRobin**: Tests all providers equally

### Monitoring Provider Health

- Green status = Provider is working
- Red status = Provider has issues
- Manual test button = Test now without waiting
- Automatic checks = Configured in settings

---

## For Developers

### Using the Enhanced Service

```typescript
import { enhancedAIService, ProviderFactory } from '@/lib/providers';

// Get all configured profiles
const profiles = enhancedAIService.getProfiles();

// Generate content with automatic provider selection
const response = await enhancedAIService.generateContent(
  "Your prompt here",
  "Optional system prompt", 
  {
    type: 'diagnosis',           // or 'treatment', 'quick_check', 'complex_analysis'
    priority: 'quality',         // or 'cost', 'speed', 'reliability'
    timestamp: new Date()
  }
);

// Check if successful
if (response.isSuccessful) {
  console.log(response.content);
  console.log(`Cost: $${response.estimatedCost}`);
  console.log(`Time: ${response.responseTime}ms`);
} else {
  console.error(response.error);
}
```

### Working with Legacy Code

```typescript
// Old imports still work!
import { aiService } from '@/lib/aiService';

// All existing methods maintained
const config = aiService.getConfig();
const result = await aiService.executeRawPrompt(prompt);
```

### Creating a New Provider Adapter

```typescript
import { BaseProviderAdapter, GenerationOptions, AIResponse } from '@/lib/providers';
import { EnhancedAIProfile, HealthCheckResult } from '@/lib/providers/types';

export class MyProviderAdapter extends BaseProviderAdapter {
  async generateContent(
    prompt: string,
    systemPrompt?: string,
    options: GenerationOptions = {}
  ): Promise<AIResponse> {
    // Implement your logic
    // Use this.retryWithBackoff() for retry logic
    // Use this.estimateTokens() for token counting
    // Use this.profile for configuration access
  }

  async testConnection(): Promise<HealthCheckResult> {
    // Quick connectivity test
  }

  async estimateCost(prompt: string): Promise<number> {
    // Calculate expected cost
  }

  async getCapabilities() {
    return this.profile.capabilities;
  }

  async validateConfiguration(): Promise<boolean> {
    // Validate all required settings are present
  }
}
```

Then register in `ProviderFactory`:

```typescript
case 'my_provider':
  return new MyProviderAdapter(profile);
```

### Provider Selection Strategies

```typescript
import { ProviderSelector } from '@/lib/providers';

// Get ranked providers
const ranked = ProviderSelector.scoreProviders(
  providers,
  context,
  'FastestFirst'
);

// Get fallback chain
const fallbacks = ProviderSelector.getFallbackChain(providers, context);

// Manually select
const selected = ProviderSelector.selectProvider(
  providers,
  context,
  'MostReliable'
);
```

---

## Provider Configuration Examples

### OpenAI (ChatGPT)
```
Provider Type: OpenAI-Compatible
Base URL: https://api.openai.com/v1
Model: gpt-4o
API Key: sk-...
```

### Local Ollama
```
Provider Type: OpenAI-Compatible
Base URL: http://localhost:11434/v1
Model: mistral
API Key: (leave empty)
```

### DeepSeek
```
Provider Type: DeepSeek
Base URL: https://api.deepseek.com
Model: deepseek-chat
API Key: sk-...
```

### Anthropic Claude
```
Provider Type: Anthropic
Base URL: https://api.anthropic.com/v1
Model: claude-3-sonnet-20240229
API Key: sk-ant-...
```

### Alibaba QWEN
```
Provider Type: QWEN
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
Model: qwen-max
API Key: sk-...
```

### Google Gemini (System)
```
Provider Type: Gemini
API Key: (from environment variables)
Model: gemini-2.0-flash
```

---

## Health Checking

### Automatic Checks
- Runs every 30 minutes (configurable)
- Tests all active providers
- Updates health status in UI
- Respects rate limiting

### Manual Checks
- Click test button next to each provider
- Instant feedback
- Updates metrics
- Safe to run frequently

### Health Indicators
- **Healthy**: Provider is operational
- **Error**: Provider is down or misconfigured
- **Unknown**: Never tested

---

## Cost Management

### Cost Estimation
- Calculated per provider before request
- Assumes 1 token ≈ 4 characters
- Estimates 1.5x output for output tokens
- Uses configured pricing per million tokens

### Cost Tracking
- Displayed in response metrics
- Aggregated in provider statistics
- Helps choose strategy

### Example Costs
- Gemini: ~$0.00001 per prompt
- OpenAI GPT-4: ~$0.0003 per prompt
- Claude: ~$0.0005 per prompt

---

## Troubleshooting

### Provider Not Connecting
1. Check Base URL is correct (no trailing slashes)
2. Check API key is valid
3. Click test button to see specific error
4. Verify provider is active (toggle in settings)
5. Check network/firewall

### Slow Responses
1. Switch to FastestFirst strategy
2. Check provider health (may be overloaded)
3. Test with smaller prompts
4. Consider geographic proximity to server

### High Costs
1. Switch to CheapestFirst strategy
2. Consider local models (Ollama)
3. Use simpler/smaller models
4. Batch requests when possible

### No Providers Available
1. Check at least one provider is configured
2. Check at least one provider is active
3. Disable fallback to test individual providers
4. Test provider connections manually

---

## Advanced Usage

### Context-Aware Selection

```typescript
// For quick clinical decisions
const response = await enhancedAIService.generateContent(prompt, system, {
  type: 'quick_check',
  priority: 'speed',
  timestamp: new Date()
});

// For complex analyses requiring high accuracy
const response = await enhancedAIService.generateContent(prompt, system, {
  type: 'complex_analysis',
  requiresJSON: true,
  priority: 'quality',
  timestamp: new Date()
});

// For cost-sensitive batch processing
const response = await enhancedAIService.generateContent(prompt, system, {
  type: 'diagnosis',
  priority: 'cost',
  timestamp: new Date()
});
```

### Custom Provider Selection

```typescript
// Get all providers and score them
const scores = ProviderSelector.scoreProviders(
  enhancedAIService.getProfiles(),
  context,
  'MostReliable'
);

// Use specific provider
const selectedProfile = scores[0].profile;
const response = await enhancedAIService.generateContent(prompt, system, selectedProfile.id);
```

### Monitoring Performance

```typescript
// Get metrics from active provider
const profile = enhancedAIService.getActiveProfile();
console.log('Success Rate:', profile.metrics.successCount / (profile.metrics.successCount + profile.metrics.failureCount));
console.log('Avg Response Time:', profile.metrics.averageResponseTime, 'ms');
console.log('Health Status:', profile.metrics.isHealthy);
```

---

## Performance Tips

1. **Enable automatic health checks** to keep provider status current
2. **Use CheapestFirst** for batch diagnostic processing
3. **Use FastestFirst** for real-time clinical decisions
4. **Use MostReliable** for final treatment recommendations
5. **Test providers** after configuring to catch issues early
6. **Monitor costs** regularly to optimize provider mix
7. **Set appropriate priorities** based on use case

---

## Architecture Overview

```
UI Layer (SettingsDialog)
    ↓
Enhanced AI Service (enhancedAIService)
    ↓
Provider Selector (intelligent selection)
    ↓
Adapter (provider-specific)
    ↓
External API
```

**Data Flow**:
1. Request enters with context
2. Selector chooses best provider
3. Adapter prepares request
4. API returns response
5. Metrics updated
6. Result returned with metadata

---

## Support & Issues

For issues:
1. Check provider configuration in Settings
2. Test provider connection manually
3. Check provider status in health indicators
4. Review error messages in browser console
5. Try different provider or strategy
6. Check network connectivity

---

## Version Info
- **Phase**: 1 (Core System)
- **Providers Implemented**: 3 (Gemini, OpenAI, Anthropic)
- **Providers Available**: 10
- **Selection Strategies**: 4
- **Status**: Production Ready

See `plans/phase1_implementation_complete.md` for technical details.
