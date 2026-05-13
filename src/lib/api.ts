export type Patient = {
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
  updated_at?: string;
  latest_diagnosis?: string;
};

export const api = {
  getPatients: async (): Promise<Patient[]> => {
    try {
      const data = localStorage.getItem('onco_patients');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePatient: async (patient: Patient): Promise<Patient> => {
    const patients = await api.getPatients();
    let updatedPatient = { ...patient };
    
    if (patient.id) {
      const index = patients.findIndex(p => p.id === patient.id);
      if (index >= 0) {
        updatedPatient.updated_at = new Date().toISOString();
        patients[index] = updatedPatient;
      } else {
        updatedPatient.id = Date.now();
        updatedPatient.updated_at = new Date().toISOString();
        patients.push(updatedPatient);
      }
    } else {
      updatedPatient.id = Date.now();
      updatedPatient.updated_at = new Date().toISOString();
      patients.push(updatedPatient);
    }
    
    localStorage.setItem('onco_patients', JSON.stringify(patients));
    return updatedPatient;
  },

  deletePatient: async (id: number): Promise<void> => {
    const patients = await api.getPatients();
    const newPatients = patients.filter(p => p.id !== id);
    localStorage.setItem('onco_patients', JSON.stringify(newPatients));
    
    // Also delete associated consultations
    const allConsultationsStr = localStorage.getItem('onco_consultations');
    if (allConsultationsStr) {
      try {
        const allConsultations = JSON.parse(allConsultationsStr);
        delete allConsultations[id];
        localStorage.setItem('onco_consultations', JSON.stringify(allConsultations));
      } catch {}
    }
  },

  getConsultation: async (patientId: number) => {
    try {
      const data = localStorage.getItem('onco_consultations');
      const allConsultations = data ? JSON.parse(data) : {};
      return allConsultations[patientId] || null;
    } catch {
      return null;
    }
  },

  saveConsultation: async (patientId: number, data: Record<string, unknown>) => {
    let allConsultations: Record<string, unknown> = {};
    try {
      const stored = localStorage.getItem('onco_consultations');
      if (stored) allConsultations = JSON.parse(stored);
    } catch {}
    
    const consultation = {
      patient_id: patientId,
      data: JSON.stringify(data),
      date: new Date().toISOString()
    };
    
    allConsultations[patientId] = consultation;
    localStorage.setItem('onco_consultations', JSON.stringify(allConsultations));
    
    // Update latest diagnosis on patient
    const diag = data?.diagnosis as Record<string, unknown> | undefined;
    const latestDiagnosis = (diag?.working_diagnosis || diag?.diagnosis_text || diag?.clinical_diagnosis || null) as string | null;
    if (latestDiagnosis) {
      const patients = await api.getPatients();
      const pIndex = patients.findIndex(p => p.id === patientId);
      if (pIndex >= 0) {
        patients[pIndex].latest_diagnosis = latestDiagnosis;
        localStorage.setItem('onco_patients', JSON.stringify(patients));
      }
    }
    
    return { id: Date.now() };
  }
};
