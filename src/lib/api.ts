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
};

export const api = {
  parseError: async (res: Response, fallback: string) => {
    try {
      const data = await res.json();
      return String(data?.error || fallback);
    } catch {
      try {
        const text = await res.text();
        return text || fallback;
      } catch {
        return fallback;
      }
    }
  },
  getPatients: async (): Promise<Patient[]> => {
    const res = await fetch('/api/patients');
    if (!res.ok) throw new Error(await api.parseError(res, 'Failed to fetch patients'));
    return res.json();
  },

  savePatient: async (patient: Patient): Promise<Patient> => {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    if (!res.ok) throw new Error(await api.parseError(res, 'Failed to save patient'));
    return res.json();
  },

  getConsultation: async (patientId: number) => {
    const res = await fetch(`/api/consultations/${patientId}`);
    if (!res.ok) throw new Error(await api.parseError(res, 'Failed to fetch consultation'));
    return res.json();
  },

  saveConsultation: async (patientId: number, data: any) => {
    const res = await fetch(`/api/consultations/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(await api.parseError(res, 'Failed to save consultation'));
    return res.json();
  }
};
