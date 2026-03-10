# AI Provider Testing and Validation System

## Testing Philosophy
- **Fail Fast**: Detect issues before they affect users
- **Graceful Degradation**: Maintain functionality when providers fail
- **Continuous Validation**: Regular health checks during operation
- **User Transparency**: Clear feedback on provider status

## Testing Levels

### Level 1: Connection Testing (Basic Health Check)
**Purpose**: Verify API endpoint is reachable and credentials are valid
**Frequency**: On startup, manual trigger, periodic (every 5 minutes)

```typescript
interface ConnectionTest {
  testName: string;
  testPrompt: string;
  expectedResponse: string | RegExp;
  timeout: number; // ms
  validateResponse: (response: any) => boolean;
}

// Example tests:
const CONNECTION_TESTS: Record<AIProviderType, ConnectionTest> = {
  gemini: {
    testName: "Gemini Quick Test",
    testPrompt: "Respond with the word 'OK' only.",
    expectedResponse: "OK",
    timeout: 5000,
    validateResponse: (r) => r.text?.trim() === "OK"
  },
  openai_compatible: {
    testName: "OpenAI Compatibility Test",
    testPrompt: "Say 'connected'",
    expectedResponse: "connected",
    timeout: 8000,
    validateResponse: (r) => r.choices?.[0]?.message?.content?.includes("connected")
  }
  // ... other providers
};
```

### Level 2: Functional Testing (Capability Validation)
**Purpose**: Verify provider can handle medical prompts and return proper JSON
**Frequency**: On first use, after configuration changes, periodic (daily)

```typescript
interface FunctionalTest {
  testType: 'diagnosis' | 'treatment' | 'json_parsing';
  testData: any; // Mock patient data
  validationCriteria: {
    requiredFields: string[];
    jsonSchema?: object;
    responseTimeMax?: number;
    language?: 'russian' | 'english';
  };
}
```

### Level 3: Performance Testing (Benchmarking)
**Purpose**: Measure response time, token usage, cost
**Frequency**: Periodic (weekly), after provider updates

```typescript
interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  successRate: number; // 0-1
  tokensPerRequest: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCostPerRequest: number;
}
```

## Testing Implementation

### 1. Automated Health Checks
```typescript
class ProviderHealthMonitor {
  private providers: Map<string, ProviderHealth>;
  private checkInterval: number = 300000; // 5 minutes
  
  async startMonitoring() {
    setInterval(() => this.runHealthChecks(), this.checkInterval);
  }
  
  async runHealthChecks() {
    for (const provider of this.getConfiguredProviders()) {
      try {
        const health = await this.testProvider(provider);
        this.updateHealthStatus(provider.id, health);
        
        if (!health.isHealthy) {
          this.notifyAdmin(`Provider ${provider.name} is unhealthy`);
          this.disableProviderTemporarily(provider.id);
        }
      } catch (error) {
        this.logHealthCheckError(provider.id, error);
      }
    }
  }
  
  async testProvider(provider: EnhancedAIProfile): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    // Level 1: Connection test
    const connectionTest = CONNECTION_TESTS[provider.providerType];
    const response = await this.executeTestPrompt(provider, connectionTest);
    
    const responseTime = Date.now() - startTime;
    const isValid = connectionTest.validateResponse(response);
    
    return {
      isHealthy: isValid && responseTime < connectionTest.timeout,
      lastCheck: new Date(),
      responseTime,
      error: isValid ? undefined : 'Invalid response format'
    };
  }
}
```

### 2. Manual Testing Interface
```typescript
// UI Components for manual testing
interface ProviderTestPanelProps {
  provider: EnhancedAIProfile;
  onTestComplete: (result: TestResult) => void;
}

const ProviderTestPanel: React.FC<ProviderTestPanelProps> = ({ provider, onTestComplete }) => {
  const [testInProgress, setTestInProgress] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  
  const runTest = async (testType: TestType) => {
    setTestInProgress(true);
    try {
      const result = await aiTestService.runTest(provider, testType);
      setTestResults([...testResults, result]);
      onTestComplete(result);
    } finally {
      setTestInProgress(false);
    }
  };
  
  return (
    <div className="provider-test-panel">
      <h3>Test Provider: {provider.name}</h3>
      <div className="test-buttons">
        <button onClick={() => runTest('connection')}>Test Connection</button>
        <button onClick={() => runTest('diagnosis')}>Test Diagnosis</button>
        <button onClick={() => runTest('treatment')}>Test Treatment</button>
        <button onClick={() => runTest('performance')}>Benchmark</button>
      </div>
      {/* Test results display */}
    </div>
  );
};
```

### 3. Batch Testing Suite
```typescript
class BatchTester {
  async testAllProviders(): Promise<ProviderComparisonReport> {
    const providers = this.getConfiguredProviders();
    const results: ProviderTestResult[] = [];
    
    // Run tests in parallel with concurrency limit
    const concurrentLimit = 3;
    const chunks = this.chunkArray(providers, concurrentLimit);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(provider => this.testProviderComprehensive(provider))
      );
      results.push(...chunkResults);
    }
    
    return this.generateComparisonReport(results);
  }
  
  async testProviderComprehensive(provider: EnhancedAIProfile): Promise<ProviderTestResult> {
    const tests = [
      this.runConnectionTest(provider),
      this.runFunctionalTest(provider, 'diagnosis'),
      this.runFunctionalTest(provider, 'treatment'),
      this.runPerformanceTest(provider)
    ];
    
    const testResults = await Promise.allSettled(tests);
    
    return {
      providerId: provider.id,
      providerName: provider.name,
      overallStatus: this.calculateOverallStatus(testResults),
      testDetails: testResults,
      timestamp: new Date()
    };
  }
}
```

## Validation Criteria

### 1. Response Format Validation
```typescript
function validateMedicalResponse(response: any, expectedSchema: string): ValidationResult {
  const validations = [
    validateJSONStructure(response),
    validateRequiredFields(response, ['diagnosis', 'confidence']),
    validateLanguage(response, 'russian'),
    validateMedicalTerminology(response),
    validateNoPII(response) // Ensure no patient identifiers
  ];
  
  return {
    isValid: validations.every(v => v.isValid),
    errors: validations.flatMap(v => v.errors),
    warnings: validations.flatMap(v => v.warnings)
  };
}
```

### 2. Quality Metrics
```typescript
interface QualityMetrics {
  clinicalAccuracy: number; // 0-1, based on medical validation
  responseCompleteness: number; // 0-1, required fields present
  formattingCorrectness: number; // 0-1, proper JSON structure
  languageAppropriateness: number; // 0-1, medical Russian quality
  hallucinationScore: number; // 0-1, lower is better
}
```

### 3. Performance Thresholds
```typescript
const PERFORMANCE_THRESHOLDS = {
  responseTime: {
    excellent: 3000, // 3 seconds
    good: 8000,      // 8 seconds
    poor: 15000,     // 15 seconds
    unacceptable: 30000 // 30 seconds
  },
  successRate: {
    excellent: 0.99, // 99%
    good: 0.95,      // 95%
    poor: 0.90,      // 90%
    unacceptable: 0.80 // 80%
  }
};
```

## Testing Scenarios

### Scenario 1: New Provider Configuration
```
User Action: Adds new GigaChat provider
System Response:
1. Auto-detect provider type from base URL
2. Run connection test immediately
3. If successful, run basic functional test
4. Store performance baseline
5. Enable provider for use
```

### Scenario 2: Provider Failure Detection
```
Trigger: 3 consecutive failed requests
System Response:
1. Mark provider as "degraded"
2. Run comprehensive health check
3. If health check fails, mark as "unavailable"
4. Switch to next provider in fallback chain
5. Notify user with option to retry
```

### Scenario 3: Periodic Quality Assessment
```
Schedule: Every 24 hours for active providers
Actions:
1. Run standardized test cases
2. Compare responses across providers
3. Update performance metrics
4. Generate quality report
5. Adjust provider rankings
```

## User Interface for Testing

### 1. Provider Status Dashboard
```
┌─────────────────────────────────────┐
│ AI Providers Status                 │
├─────────────────────────────────────┤
│ ✅ Gemini 1.5 Pro      │ 2.3s │ 99% │
│ ✅ GPT-4 Turbo         │ 3.1s │ 98% │
│ ⚠️ Claude 3 Opus       │ 8.5s │ 92% │
│ ❌ GigaChat            │ --   │ 0%  │
│ 🔄 DeepSeek Chat       │ Testing... │
└─────────────────────────────────────┘
```

### 2. Test Results Viewer
```typescript
interface TestResultView {
  provider: string;
  testType: string;
  status: 'pass' | 'fail' | 'warning';
  responseTime: number;
  details: {
    rawResponse?: string;
    parsedResponse?: any;
    errors?: string[];
    warnings?: string[];
  };
  timestamp: Date;
}
```

### 3. Comparison View
```typescript
interface ProviderComparison {
  providers: string[];
  metrics: {
    responseTime: number[];
    successRate: number[];
    costPerRequest: number[];
    qualityScore: number[];
  };
  recommendations: {
    fastest: string;
    cheapest: string;
    mostReliable: string;
    bestQuality: string;
  };
}
```

## Integration with Existing System

### 1. Augmented AI Service
```typescript
class EnhancedAIService {
  private healthMonitor: ProviderHealthMonitor;
  private providerSelector: IntelligentProviderSelector;
  
  async generateWithValidation(
    prompt: string, 
    options: GenerationOptions
  ): Promise<ValidatedAIResponse> {
    // 1. Select best provider based on health and performance
    const provider = await this.providerSelector.selectProvider(options);
    
    // 2. Execute with timeout and fallback
    const response = await this.executeWithFallback(provider, prompt, options);
    
    // 3. Validate response quality
    const validation = await this.validateResponse(response, options.expectedSchema);
    
    // 4. Update performance metrics
    await this.updateProviderMetrics(provider.id, {
      responseTime: response.metadata.responseTime,
      success: validation.isValid,
      tokensUsed: response.metadata.tokens
    });
    
    return {
      ...response,
      validation,
      providerUsed: provider.id
    };
  }
}
```

### 2. Enhanced Error Handling
```typescript
interface EnhancedErrorHandling {
  classifyError(error: any): ErrorCategory;
  
  handleError(
    error: any, 
    provider: EnhancedAIProfile, 
    context: RequestContext
  ): RecoveryAction;
  
  // Recovery actions:
  // - Retry with same provider
  // - Switch to fallback provider
  // - Degrade response quality (e.g., accept non-JSON)
  // - Return cached response
  // - Notify user with specific guidance
}
```

## Testing Data Management

### 1. Test Cases Repository
```typescript
// Standardized test cases for consistent benchmarking
const TEST_CASES = {
  diagnosis: [
    {
      id: 'lung_cancer_early',
      patientData: { /* anonymized */ },
      expectedDiagnosis: 'Рак легкого',
      expectedICD10: 'C34.9'
    },
    {
      id: 'breast_cancer_advanced',
      patientData: { /* anonymized */ },
      expectedDiagnosis: 'Рак молочной железы',
      expectedICD10: 'C50.9'
    }
  ],
  treatment: [
    {
      id: 'colon_cancer_treatment',
      diagnosis: { /* */ },
      expectedTreatment: 'Химиотерапия по схеме FOLFOX'
    }
  ]
};
```

### 2. Performance Baseline Storage
```typescript
// Store historical performance for trend analysis
interface PerformanceBaseline {
  providerId: string;
  metric: 'responseTime' | 'successRate' | 'cost';
  values: {
    timestamp: Date;
    value: number;
    sampleSize: number;
  }[];
  trends: {
    direction: 'improving' | 'stable' | 'degrading';
    rateOfChange: number;
    confidence: number;
  };
}
```

## Deployment Strategy

### Phase 1: Silent Monitoring (2 weeks)
- Add health checks without UI changes
- Log all test results internally
- Establish performance baselines
- No user-visible changes

### Phase 2: Basic UI (1 week)
- Add provider status indicators
- Manual test buttons in settings
- Basic error notifications
- Optional feature flag

### Phase 3: Advanced Features (2 weeks)
- Automated fallback based on health
- Performance-based provider selection
- Quality validation
- Comprehensive reporting

### Phase 4: Optimization (Ongoing)
- Machine learning for provider selection
- Predictive failure detection
- Cost optimization algorithms
- User preference learning

## Success Metrics for Testing System

### Technical Metrics
- False positive rate < 1% (healthy providers marked unhealthy)
- False negative rate < 5% (unhealthy providers not detected)
- Test execution time < 30 seconds per provider
- System overhead < 5% of total AI request time

### User Experience Metrics
- Provider issues detected before user encounters them
- Clear actionable feedback when providers fail
- Minimal interruption during provider switching
- Transparency into system health

### Business Metrics
- Reduced support tickets for AI issues
- Increased user confidence in AI features
- Better cost management through provider optimization
- Competitive advantage through reliability

## Risk Mitigation

### Testing System Risks
1. **False Alarms**: Implement confirmation retries, user override
2. **Performance Impact**: Optimize test frequency, background execution
3. **Data Privacy**: Use anonymized test data, no PII in tests
4. **Provider Rate Limits**: Respect API limits, implement backoff

### Implementation Risks
1. **Complexity**: Incremental rollout, feature flags
2. **User Confusion**: Clear UI, progressive disclosure
3. **Maintenance**: Modular design, comprehensive documentation

## Next Steps

### Immediate (Next Sprint)
1. Implement basic connection testing for existing providers
2. Add health status tracking to AI profiles
3. Create manual test button in settings dialog

### Short-term (1 month)
1. Implement automated periodic health checks
2. Add provider status indicators to UI
3. Create basic fallback based on health status

### Medium-term (2-3 months)
1. Implement comprehensive test suite
2. Add performance benchmarking
3. Create provider comparison dashboard

### Long-term (3-6 months)
1. Machine learning for intelligent provider selection
2. Predictive failure detection
3. Automated quality assessment

---

**Confidence Level**: High  
**Estimated Implementation Time**: 2-3 months (phased)  
**Critical Success Factors**: User feedback, provider API stability  
**Key Innovation**: Proactive health monitoring with graceful degradation