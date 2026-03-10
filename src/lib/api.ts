export type Patient = {
  id?: number;
  full_name: string;
  birth_date: string;
  gender: 'male' | 'female';
  snils?: string;
  policy_number?: string;
  contact_info?: string;
  updated_at?: string;
};

export const api = {
  getPatients: async (): Promise<Patient[]> => {
    const res = await fetch('/api/patients');
    if (!res.ok) throw new Error('Failed to fetch patients');
    return res.json();
  },

  savePatient: async (patient: Patient): Promise<Patient> => {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    if (!res.ok) throw new Error('Failed to save patient');
    return res.json();
  },

  getConsultation: async (patientId: number) => {
    const res = await fetch(`/api/consultations/${patientId}`);
    if (!res.ok) throw new Error('Failed to fetch consultation');
    return res.json();
  },

  saveConsultation: async (patientId: number, data: any) => {
    const res = await fetch('/api/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, data }),
    });
    if (!res.ok) throw new Error('Failed to save consultation');
    return res.json();
  }
};
