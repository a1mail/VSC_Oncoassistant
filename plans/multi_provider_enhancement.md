# Multi-Provider AI System Enhancement Plan

## Current System Analysis

### Strengths
1. **Dual Provider Support**: Gemini (client-side) and OpenAI-compatible (server-side)
2. **Fallback Mechanism**: Sequential retry across providers when enabled
3. **Configuration UI**: Settings dialog for managing AI profiles
4. **PII Protection**: Patient data anonymization before sending to AI
5. **Prompt Engineering**: Well-structured medical prompts in Russian

### Limitations Identified
1. **Limited Provider Types**: Only Gemini and OpenAI-compatible
2. **No Performance Tracking**: Doesn't measure response time or success rate
3. **Basic Error Handling**: Simple sequential fallback without intelligence
4. **No Health Checks**: Providers not tested before use
5. **Manual Configuration**: Users must know API endpoints and formats

## Target Providers to Support

### Primary Categories
1. **Google Gemini** (existing)
2. **OpenAI-Compatible** (existing + enhanced)
3. **Anthropic Claude** (new)
4. **DeepSeek** (new)
5. **QWEN/Aliyun** (partial existing)
6. **GigaChat** (new - Russian)
7. **Yandex Alice** (new - Russian)
8. **OpenRouter** (new - aggregator)
9. **AITunnel** (new)
10. **Local Models** (Ollama, LM Studio - future)

## Enhanced Architecture Design

### 1. Provider Configuration Schema
```typescript
interface EnhancedAIProfile {
  id: string;
  name: string;
  providerType: 'gemini' | 'openai_compatible' | 'anthropic' | 'deepseek' | 'qwen' | 'gigachat' | 'alice' | 'openrouter' | 'aitunnel' | 'local';
  
  // Connection Details
  apiKey?: string;
  baseUrl: string;
  modelName: string;
  
  // Provider-specific settings
  apiVersion?: string;  // For Azure, Anthropic
  organizationId?: string; // For OpenAI
  
  // Performance tracking
  lastResponseTime?: number;
  lastUsed?: Date;
  successRate?: number;
  costPerToken?: number;
  
  // Health status
  isHealthy?: boolean;
  lastHealthCheck?: Date;
  errorCount?: number;
  
  // Capabilities
  supportsImages: boolean;
  supportsJSON: boolean;
  maxTokens: number;
  contextWindow: number;
  
  // Prompt optimization
  preferredPromptFormat?: 'openai' | 'anthropic' | 'gemini';
  systemPromptTemplate?: string;
}
```

### 2. Provider Adapter Pattern
Create a unified adapter interface with provider-specific implementations:

```
AIProviderAdapter (Interface)
├── generateContent(prompt, options)
├── testConnection()
├── estimateCost(prompt)
└── getCapabilities()

Concrete Implementations:
├── GeminiAdapter
├── OpenAIAdapter
├── AnthropicAdapter
├── DeepSeekAdapter
├── QwenAdapter
├── GigaChatAdapter
├── AliceAdapter
├── OpenRouterAdapter
└── AITunnelAdapter
```

### 3. Intelligent Provider Selection
```typescript
interface ProviderSelectionStrategy {
  selectProvider(providers: EnhancedAIProfile[], context: RequestContext): EnhancedAIProfile;
}

// Strategies:
// 1. FastestFirst - based on historical response times
// 2. CheapestFirst - based on cost estimation
// 3. MostReliable - based on success rate
// 4. RoundRobin - equal distribution
// 5. PriorityBased - user-defined priority order
```

### 4. Enhanced Fallback System
```typescript
interface FallbackStrategy {
  executeWithFallback(
    primaryProvider: EnhancedAIProfile,
    fallbackProviders: EnhancedAIProfile[],
    request: AIRequest
  ): Promise<AIResponse>;
  
  // Features:
  // - Concurrent testing of multiple providers
  // - Timeout-based fallback (e.g., switch if > 10s)
  // - Partial response acceptance
  // - Error classification and intelligent retry
}
```

## Implementation Plan

### Phase 1: Core Enhancements (Week 1)
1. **Extend Provider Configuration**
   - Update `AIProfile` interface with new fields
   - Add provider type enum
   - Migrate existing settings

2. **Create Provider Factory**
   - Factory pattern for creating provider adapters
   - Dynamic loading based on provider type

3. **Enhanced Settings UI**
   - Provider type dropdown with auto-filled defaults
   - Connection test button
   - Capabilities display

### Phase 2: New Provider Adapters (Week 2)
1. **Anthropic Claude Adapter**
2. **DeepSeek Adapter**
3. **GigaChat Adapter** (Russian-specific)
4. **Alice Adapter** (Yandex, Russian)
5. **OpenRouter Adapter** (unified gateway)

### Phase 3: Intelligence Layer (Week 3)
1. **Performance Tracking**
   - Response time measurement
   - Success/failure logging
   - Cost estimation

2. **Health Monitoring**
   - Periodic connection tests
   - Automatic disable of failing providers
   - Recovery detection

3. **Smart Selection**
   - Implement selection strategies
   - User preference configuration
   - Context-aware provider choice

### Phase 4: Advanced Features (Week 4)
1. **Prompt Optimization**
   - Provider-specific prompt templates
   - Token optimization
   - Format adaptation

2. **Batch Processing**
   - Parallel requests to multiple providers
   - Response comparison/validation
   - Consensus-based answers

3. **Local Model Support**
   - Ollama integration
   - LM Studio support
   - Offline capability

## Provider-Specific Considerations

### 1. GigaChat (Russian)
- Requires SberID authentication
- Special API endpoints
- Russian language optimized

### 2. Yandex Alice
- Yandex Cloud integration
- Russian language models
- May require OAuth

### 3. OpenRouter
- Unified API for multiple providers
- Cost tracking built-in
- Standardized response format

### 4. AITunnel
- Custom tunneling solutions
- May require special headers
- Rate limiting considerations

### 5. QWEN/DashScope
- Already partially supported
- Need complete adapter
- Chinese language considerations

## Prompt Template Strategy

### Current Approach
- Single Russian-language prompt for all providers
- JSON response format requirement
- Medical context specific

### Enhanced Approach
```typescript
interface PromptTemplate {
  providerType: AIProviderType;
  systemPrompt: string;
  userPromptTemplate: string;
  responseFormat: 'json' | 'text' | 'markdown';
  temperature: number;
  maxTokens: number;
  
  // Provider-specific optimizations
  optimizations: {
    useNativeJSONMode: boolean;  // For providers with JSON mode
    addFormatInstructions: boolean; // Explicit format instructions
    tokenOptimization: boolean;   // Remove unnecessary tokens
  };
}
```

### Benefits of Provider-Specific Templates
1. **Cost Reduction**: Optimize tokens for each provider's pricing
2. **Quality Improvement**: Use provider-recommended formats
3. **Reliability**: Work around provider limitations
4. **Speed**: Reduce parsing errors and retries

## Testing Strategy

### 1. Connection Testing
- Simple "hello world" prompt
- Validate API key and endpoint
- Check response format compliance

### 2. Functional Testing
- Medical diagnosis prompt
- Treatment recommendation prompt
- JSON parsing validation
- Error handling

### 3. Performance Testing
- Response time measurement
- Concurrent request handling
- Rate limit detection

### 4. User Testing
- Manual "Test Connection" button
- Provider comparison view
- Quality assessment interface

## UI/UX Improvements

### Settings Dialog Enhancements
1. **Provider Cards**: Visual status indicators (online/offline/error)
2. **Quick Test**: One-click connection test
3. **Performance Dashboard**: Response times, success rates, costs
4. **Provider Comparison**: Side-by-side capability view
5. **Template Editor**: Provider-specific prompt customization

### Provider Selection Interface
1. **Auto-select**: Smart provider choice
2. **Manual Override**: User selection per request
3. **Batch Mode**: Try all providers, compare results
4. **Fallback Visualization**: Show which provider was used

## Security Considerations

### 1. API Key Management
- Secure storage (encrypted localStorage)
- Key rotation support
- Usage auditing

### 2. Data Privacy
- Maintain PII anonymization
- Provider data retention policies
- Compliance with medical regulations

### 3. Rate Limiting
- Provider-specific rate limit handling
- Queue management for busy providers
- User notification of limits

## Cost Management

### 1. Cost Tracking
- Token counting per provider
- Cost estimation before requests
- Monthly usage reports

### 2. Budget Controls
- Per-provider spending limits
- Automatic provider switching when budget exceeded
- Usage alerts

### 3. Optimization
- Provider selection based on cost
- Prompt optimization to reduce tokens
- Caching of similar responses

## Deployment Strategy

### 1. Incremental Rollout
- Start with enhanced existing providers
- Add one new provider at a time
- Gather user feedback

### 2. Migration Path
- Backward compatibility with existing profiles
- Automatic migration of settings
- Clear documentation of changes

### 3. Monitoring
- Usage analytics per provider
- Error rate tracking
- Performance metrics

## Success Metrics

### Technical Metrics
- 99% successful AI requests (with fallback)
- Average response time < 10 seconds
- Zero data loss during provider switching
- 100% backward compatibility

### User Metrics
- Reduced "AI unavailable" errors
- Improved response quality
- Lower cost per consultation
- Increased user satisfaction

### Business Metrics
- Support for 10+ AI providers
- 95% uptime for AI features
- Reduced dependency on single provider
- Competitive advantage in medical AI

## Risk Mitigation

### High Risks
1. **Provider API Changes**: Monitor provider announcements, rapid adapter updates
2. **Cost Overruns**: Implement spending limits, alerts
3. **Data Privacy**: Maintain strict anonymization, regular audits

### Medium Risks
1. **Performance Degradation**: Continuous monitoring, automatic fallback
2. **User Confusion**: Clear UI, tooltips, documentation
3. **Migration Issues**: Thorough testing, rollback plan

### Low Risks
1. **New Provider Integration**: Standard adapter pattern, isolated testing
2. **UI Complexity**: Progressive disclosure, expert mode toggle

## Next Steps

### Immediate (Next 48 hours)
1. Update `AIProfile` interface with new fields
2. Create provider adapter interface
3. Enhance SettingsDialog with provider type selector
4. Implement basic connection testing

### Short-term (1 week)
1. Build 2-3 new provider adapters (Anthropic, DeepSeek)
2. Implement performance tracking
3. Add health check mechanism

### Medium-term (2-3 weeks)
1. Complete all target provider adapters
2. Implement intelligent selection
3. Add cost tracking and optimization

### Long-term (1 month+)
1. Local model support
2. Advanced batch processing
3. Machine learning for provider selection

---

**Confidence Level**: High  
**Estimated Implementation Time**: 4-6 weeks (phased)  
**Critical Dependencies**: Provider API documentation, user feedback  
**Key Success Factor**: Maintaining backward compatibility while adding features