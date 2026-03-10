# AI Integration Strategy

## 1. Model Selection
We will use **`gemini-3.1-pro-preview`**.
*   **Reasoning:** Medical diagnosis requires complex reasoning and context window retention, which the Pro model excels at.
*   **Fallback:** `gemini-3-flash-preview` for simple tasks (e.g., summarizing text) to reduce latency.

## 2. Prompt Engineering Strategy

### System Instruction
The AI will be initialized with a strict persona:
> "You are an expert oncologist assistant operating under the jurisdiction of the Russian Federation. You strictly adhere to the Clinical Recommendations (CR RF) approved by the Ministry of Health. You DO NOT hallucinate treatments. If data is insufficient, you explicitly request specific diagnostic tests. You output data in structured JSON format when requested."

### Context Management
We will construct a structured JSON context for every request:
```json
{
  "patient_demographics": { "age": 55, "gender": "male" },
  "complaints": ["hemoptysis", "weight_loss"],
  "history": "Smoker (30 years)",
  "exam_findings": "Decreased breath sounds right lung",
  "diagnostics": "CT Chest: 3cm mass in RUL"
}
```

### Anonymization (Privacy)
**CRITICAL:** No PII (Personally Identifiable Information) will be sent to the AI.
*   **Remove:** Name, SNILS, Policy Number, Exact Address.
*   **Keep:** Age, Gender, Clinical Data.

## 3. Interaction Flows

### Flow A: Diagnostic Hypothesis
1.  **Trigger:** User clicks "Formulate Diagnosis".
2.  **Prompt:** "Based on the provided clinical data, formulate a Working Diagnosis according to ICD-10. List the evidence supporting this. If the diagnosis is not definitive, list the specific tests required by CR RF to confirm it."
3.  **Output:** Structured object with `diagnosis`, `icd10`, `reasoning`, `missing_tests`.

### Flow B: Treatment Planning
1.  **Trigger:** User confirms Diagnosis.
2.  **Prompt:** "For the diagnosis [Diagnosis Name] (Stage [X]), outline the standard treatment protocol according to current Russian Clinical Recommendations. Include surgical options, chemotherapy regimens (if applicable), and radiation therapy."
3.  **Output:** Structured treatment plan.

## 4. Verification Mechanisms
*   **Source Citation:** We will ask the AI to cite the specific Clinical Recommendation (e.g., "KR465: Lung Cancer") where possible.
*   **Doctor Review:** The UI will clearly label all AI outputs as "Suggestions" requiring physician validation.
