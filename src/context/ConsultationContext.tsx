import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

type SaveResult = {
  success: boolean;
  message: string;
  type: 'success' | 'error' | 'warning';
};

type ConsultationContextType = {
  data: ConsultationData;
  consultationId: string;
  updateData: (section: keyof ConsultationData, value: any) => void;
  resetData: () => void;
  saveToServer: (silent?: boolean) => Promise<SaveResult>;
  triggerReload: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
};

const ConsultationContext = createContext<ConsultationContextType | undefined>(undefined);
const DRAFT_STORAGE_KEY = 'onco_consultation_draft';

const loadDraft = (): ConsultationData => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export function ConsultationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ConsultationData>(loadDraft);
  const [consultationId, setConsultationId] = useState<string>(Date.now().toString());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const updateData = useCallback((section: keyof ConsultationData, value: any) => {
    setData((prev) => {
      if (prev[section] === value) return prev;
      setSaveStatus('idle'); // Reset status when data changes
      return { ...prev, [section]: value };
    });
  }, []);

  const triggerReload = useCallback(() => {
    setConsultationId(Date.now().toString());
    setSaveStatus('idle');
    setLastSaved(null);
  }, []);

  const resetData = useCallback(() => {
    setData({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    triggerReload();
  }, [triggerReload]);

  const saveToServer = useCallback(async (silent = false): Promise<SaveResult> => {
    if (!data.patient?.full_name) {
      return { 
        success: false, 
        message: 'Сначала введите ФИО пациента', 
        type: 'warning' 
      };
    }
    
    setSaveStatus('saving');
    
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
          setSaveStatus('saved');
          setLastSaved(new Date());
          return { 
            success: true, 
            message: 'Данные успешно сохранены', 
            type: 'success' 
          };
        } catch (e:any) {
          console.error(e);
          setSaveStatus('error');
          return { 
            success: false, 
            message: `Ошибка при сохранении: ${e?.message || 'неизвестная ошибка'}`, 
            type: 'error' 
          };
        }
      } else {
        setSaveStatus('error');
        return { 
          success: false, 
          message: 'Сначала заполните данные пациента', 
          type: 'warning' 
        };
      }
    }

    try {
      await api.saveConsultation(data.patient.id, data);
      if (!silent) console.log("Данные успешно сохранены в базу данных");
      setSaveStatus('saved');
      setLastSaved(new Date());
      return { 
        success: true, 
        message: 'Данные успешно сохранены', 
        type: 'success' 
      };
    } catch (error:any) {
      console.error(error);
      setSaveStatus('error');
      return { 
        success: false, 
        message: `Ошибка при сохранении: ${error?.message || 'неизвестная ошибка'}`, 
        type: 'error' 
      };
    }
  }, [data, updateData]);

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (data.patient?.full_name) {
        saveToServer(true);
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [data, saveToServer]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  return (
    <ConsultationContext.Provider value={{ data, consultationId, updateData, resetData, saveToServer, triggerReload, saveStatus, lastSaved }}>
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
