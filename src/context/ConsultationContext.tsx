import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

type Document = {
  id: string;
  name: string;
  type: 'text' | 'image';
  content: string; // text content or base64
  includeInAnalysis: boolean;
};

type ConsultationData = {
  patient?: any;
  anamnesis?: any;
  exam?: any;
  diagnostics?: any;
  diagnosis?: any;
  treatment?: any;
  documents?: Document[];
};

type ConsultationContextType = {
  data: ConsultationData;
  consultationId: string;
  updateData: (section: keyof ConsultationData, value: any) => void;
  resetData: () => void;
  saveToServer: (silent?: boolean) => Promise<void>;
  triggerReload: () => void;
};

const ConsultationContext = createContext<ConsultationContextType | undefined>(undefined);

export function ConsultationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ConsultationData>({});
  const [consultationId, setConsultationId] = useState<string>(Date.now().toString());

  const updateData = (section: keyof ConsultationData, value: any) => {
    setData((prev) => ({ ...prev, [section]: value }));
  };

  const triggerReload = () => {
    setConsultationId(Date.now().toString());
  };

  const resetData = () => {
    setData({});
    triggerReload();
  };

  const saveToServer = async (silent = false) => {
    if (!data.patient?.full_name) {
       // Don't save if no patient name
       return;
    }

    if (!data.patient?.id) {
      // If patient not saved yet, try to save patient first
      if (data.patient) {
        try {
          const savedPatient = await api.savePatient(data.patient);
          updateData('patient', savedPatient);
          
          // Use updated data with the saved patient (including ID)
          const dataToSave = { ...data, patient: savedPatient };
          await api.saveConsultation(savedPatient.id!, dataToSave);
          
          if (!silent) console.log("Данные успешно сохранены в базу данных");
        } catch (e) {
          console.error(e);
          if (!silent) console.error("Ошибка при сохранении");
        }
      } else {
        if (!silent) console.warn("Сначала заполните данные пациента");
      }
      return;
    }

    try {
      await api.saveConsultation(data.patient.id, data);
      if (!silent) console.log("Данные успешно сохранены в базу данных");
    } catch (error) {
      console.error(error);
      if (!silent) console.error("Ошибка при сохранении");
    }
  };

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (data.patient?.full_name) {
        saveToServer(true);
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [data]);

  return (
    <ConsultationContext.Provider value={{ data, consultationId, updateData, resetData, saveToServer, triggerReload }}>
      {children}
    </ConsultationContext.Provider>
  );
}

export function useConsultation() {
  const context = useContext(ConsultationContext);
  if (context === undefined) {
    throw new Error('useConsultation must be used within a ConsultationProvider');
  }
  return context;
}
