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

import { appStorage } from '@/lib/appStorage';
import {
  loadPortablePatientDatabase,
  savePortablePatientDatabase,
  type PortableConsultationRecord,
} from '@/lib/portablePatientStorage';

const PATIENTS_STORAGE_KEY = 'onco_patients';
const CONSULTATIONS_STORAGE_KEY = 'onco_consultations';

function readPatientsFromLocalStorage(): Patient[] {
  try {
    const data = appStorage.getItem(PATIENTS_STORAGE_KEY);
    return data ? JSON.parse(data) as Patient[] : [];
  } catch {
    return [];
  }
}

function readConsultationsFromLocalStorage(): Record<string, PortableConsultationRecord> {
  try {
    const data = appStorage.getItem(CONSULTATIONS_STORAGE_KEY);
    return data ? JSON.parse(data) as Record<string, PortableConsultationRecord> : {};
  } catch {
    return {};
  }
}

function writeLocalMirror(
  patients: Patient[],
  consultations: Record<string, PortableConsultationRecord>
): void {
  appStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patients));
  appStorage.setItem(CONSULTATIONS_STORAGE_KEY, JSON.stringify(consultations));
}

/**
 * Reads the active patient storage snapshot.
 * In the standalone HTML build it prefers the selected portable JSON database.
 */
async function getStorageSnapshot(): Promise<{
  patients: Patient[];
  consultations: Record<string, PortableConsultationRecord>;
}> {
  const portableDatabase = await loadPortablePatientDatabase();
  if (portableDatabase) {
    writeLocalMirror(portableDatabase.patients as Patient[], portableDatabase.consultations);
    return {
      patients: portableDatabase.patients as Patient[],
      consultations: portableDatabase.consultations,
    };
  }

  return {
    patients: readPatientsFromLocalStorage(),
    consultations: readConsultationsFromLocalStorage(),
  };
}

/**
 * Persists the patient storage snapshot.
 * Update the active browser or memory snapshot only after the durable write succeeds.
 */
async function saveStorageSnapshot(
  patients: Patient[],
  consultations: Record<string, PortableConsultationRecord>
): Promise<void> {
  await savePortablePatientDatabase({
      version: 1,
      savedAt: new Date().toISOString(),
      patients,
      consultations,
  });
  writeLocalMirror(patients, consultations);
}

let mutationQueue: Promise<unknown> = Promise.resolve();

/** Serialize read-modify-write operations so concurrent autosaves cannot overwrite each other. */
function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.catch(() => undefined);
  return result;
}

export const api = {
  getPatients: async (): Promise<Patient[]> => {
    const snapshot = await getStorageSnapshot();
    return snapshot.patients;
  },

  savePatient: (patient: Patient): Promise<Patient> => serializeMutation(async () => {
    const snapshot = await getStorageSnapshot();
    const patients = [...snapshot.patients];
    const updatedPatient = { ...patient };
    
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
    
    await saveStorageSnapshot(patients, snapshot.consultations);
    return updatedPatient;
  }),

  deletePatient: (id: number): Promise<void> => serializeMutation(async () => {
    const snapshot = await getStorageSnapshot();
    const newPatients = snapshot.patients.filter((p) => p.id !== id);
    const allConsultations = { ...snapshot.consultations };
    delete allConsultations[id];
    await saveStorageSnapshot(newPatients, allConsultations);
  }),

  getConsultation: async (patientId: number) => {
    const snapshot = await getStorageSnapshot();
    return snapshot.consultations[patientId] || null;
  },

  saveConsultation: (patientId: number, data: Record<string, unknown>) => serializeMutation(async () => {
    const snapshot = await getStorageSnapshot();
    const allConsultations: Record<string, PortableConsultationRecord> = {
      ...snapshot.consultations,
    };

    const consultation = {
      patient_id: patientId,
      data: JSON.stringify(data),
      date: new Date().toISOString()
    };
    
    allConsultations[patientId] = consultation;

    // Update latest diagnosis on patient
    const diag = data?.diagnosis as Record<string, unknown> | undefined;
    const latestDiagnosis = (diag?.working_diagnosis || diag?.diagnosis_text || diag?.clinical_diagnosis || null) as string | null;
    if (latestDiagnosis) {
      const patients = [...snapshot.patients];
      const pIndex = patients.findIndex(p => p.id === patientId);
      if (pIndex >= 0) {
        patients[pIndex].latest_diagnosis = latestDiagnosis;
        await saveStorageSnapshot(patients, allConsultations);
        return { id: Date.now() };
      }
    }
    
    await saveStorageSnapshot(snapshot.patients, allConsultations);
    return { id: Date.now() };
  })
};
