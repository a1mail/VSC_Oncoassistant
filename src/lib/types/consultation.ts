export interface PatientData {
  id?: number;
  full_name: string;
  birth_date: string;
  gender: 'male' | 'female';
  snils?: string;
  policy_number?: string;
  contact_info?: string;
  menopause_mode?: 'auto' | 'manual';
  menopause_status_manual?: 'premenopause' | 'perimenopause' | 'postmenopause' | 'unknown';
  last_menstruation_date?: string;
  bilateral_oophorectomy?: boolean;
  menopause_status?: string;
  menopause_basis?: string;
}

export interface AnamnesisData {
  complaints?: string[];
  complaints_detail?: string;
  anamnesis_morbi?: string;
  heredity?: string;
  allergies?: string;
  smoking?: boolean;
  alcohol?: boolean;
  comorbidities?: string;
  current_medications?: string;
  occupation_desc?: string;
  harmful_factors?: string[];
  harmful_factors_desc?: string;
}

export interface ExamData {
  height?: string;
  weight?: string;
  bmi?: string;
  bsa?: string;
  ecog?: string;
  constitution?: string;
  mammary_lymph_nodes?: string;
  [key: string]: unknown;
}

export interface DiagnosticsData {
  lab_hb?: string;
  lab_wbc?: string;
  lab_plt?: string;
  lab_esr?: string;
  lab_other?: string;
  imaging_methods?: string[];
  imaging_desc?: string;
  histology_desc?: string;
  ihc_desc?: string;
  [key: string]: unknown;
}

export interface AiDebugMetadata {
  rawResponse?: string;
  rawResponseFormat?: string;
  rawProvider?: string;
  rawResponseTime?: number;
  wasRepaired?: boolean;
}

export interface DiagnosisResult extends AiDebugMetadata {
  working_diagnosis?: string;
  icd10?: string;
  tnm?: string | null;
  reasoning?: string;
  confidence?: 'High' | 'Medium' | 'Low';
  missing_data?: string[] | string;
  is_final?: boolean;
}

export interface TreatmentResult extends AiDebugMetadata {
  treatment_strategy?: string;
  primary_treatment?: string;
  regimen?: string;
  prescriptions?: unknown;
  recommendations?: string[] | string;
  warnings?: string[] | string;
  cr_source?: string;
}

export interface ConsultationDocument {
  id: string;
  name: string;
  type: 'text' | 'image';
  content: string;
  includeInAnalysis: boolean;
}

export interface ConsultationData {
  patient?: PatientData;
  anamnesis?: AnamnesisData;
  exam?: ExamData;
  diagnostics?: DiagnosticsData;
  diagnosis?: DiagnosisResult;
  treatment?: TreatmentResult;
  documents?: ConsultationDocument[];
}
