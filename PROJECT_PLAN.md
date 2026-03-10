# Project Plan: OncoAssistant (ОнкоПомощник)

## 1. Overview
A specialized Clinical Decision Support System (CDSS) for oncologists to assist in primary patient consultations. The application guides the doctor through the entire workflow, from patient registration to treatment prescription, strictly adhering to the Clinical Recommendations of the Russian Federation (CR RF).

## 2. Architecture
*   **Frontend:** React 19, Tailwind CSS, Framer Motion (for smooth transitions).
*   **Backend:** Node.js (Express), `better-sqlite3` (Local database simulation).
*   **AI Engine:** Google Gemini (`gemini-3.1-pro-preview`) for reasoning and medical analysis.
*   **Storage:** 
    *   Primary: SQLite database (server-side in the container).
    *   Backup/Portable: JSON export/import for saving to the doctor's physical machine.

## 3. Core Modules (Tabs)

### 1. Patient Registration (Паспортная часть)
*   **Fields:** Full Name, DOB, Gender, SNILS, Insurance Policy, Contact Info.
*   **Logic:** Auto-calculate age.

### 2. Anamnesis (Анамнез)
*   **Complaints:** Multi-select (Top 20 oncology complaints: pain, weight loss, fatigue, etc.) + Free text.
*   **History of Present Illness (Anamnesis Morbi):** Timeline of symptoms.
*   **Life History (Anamnesis Vitae):** Heredity (cancer family history), Allergies, Past illnesses, Bad habits.
*   **Logic:** If "Smoker" selected -> prompt for "Pack-years".

### 3. Physical Examination (Осмотр)
*   **Systems:** Skin, Lymph nodes, Respiratory, Cardiovascular, Abdominal, etc.
*   **Input:** Checkboxes for "Normal", specific inputs for pathologies (e.g., "Palpable mass in right upper quadrant").

### 4. Diagnostics (Обследования)
*   **Input:** Lab results (Blood count, Biochemistry), Imaging (CT, MRI, PET descriptions), Biopsy results.
*   **Feature:** File attachment (simulated) or text summary of reports.

### 5. Diagnosis & AI Analysis (Диагноз)
*   **Workflow:**
    1.  Doctor reviews collected data.
    2.  **AI Action:** "Analyze Patient Data".
    3.  AI suggests:
        *   **Working Diagnosis** (ICD-10).
        *   **TNM Staging** (if applicable).
        *   **Missing Data:** List of required tests to confirm diagnosis (Plan of Investigation).
    4.  Doctor confirms or edits the diagnosis.

### 6. Treatment & Recommendations (Лечение)
*   **Workflow:**
    1.  Based on confirmed diagnosis.
    2.  **AI Action:** "Generate Treatment Plan".
    3.  AI suggests:
        *   Specific therapy (Chemo protocols, Surgery type).
        *   Lifestyle recommendations.
        *   Follow-up schedule.
    4.  Strictly references CR RF.

## 4. Technical Roadmap

### Phase 1: Foundation (Current Step)
*   Setup Project Structure.
*   Configure Express + SQLite.
*   Create Basic UI Layout (Navigation/Tabs).

### Phase 2: Data Collection Modules
*   Implement Forms for Registration, Anamnesis, Exam.
*   Implement "Smart Logic" (Adaptive fields).

### Phase 3: AI Integration
*   Develop Prompt Templates for Gemini.
*   Implement "Consult AI" API endpoints.
*   Response parsing and formatting.

### Phase 4: Data Persistence & Reporting
*   Save/Load patient functionality.
*   Generate "Medical Report" (Print view).

## 5. Security & Stability
*   **Data Privacy:** AI requests will be anonymized (Patient Name removed before sending to Gemini).
*   **Validation:** Strict type checking (TypeScript) and schema validation (Zod).
*   **Error Handling:** Graceful fallbacks if AI is unavailable.
