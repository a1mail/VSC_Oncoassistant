import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { aiService } from '@/lib/aiService';
import { enhancedAIService } from '@/lib/providers';
import type { ConsultationData, ConsultationDocument, AiDebugMetadata } from '@/lib/types/consultation';

export type { ConsultationData, ConsultationDocument };

type SaveResult = {
  success: boolean;
  message: string;
  type: 'success' | 'error' | 'warning';
};

type AiRequestSection = 'diagnosis' | 'treatment';

type AiRetryContext = {
  rawResponse: string;
  rawProvider?: string;
  rawResponseFormat?: string;
  sourceErrorMessage?: string;
};

type AiRequestTask = {
  id: string;
  section: AiRequestSection;
  prompt: string;
  status: 'running' | 'success' | 'error';
  startedAt: string;
  isMinimized: boolean;
  rawResponse?: string;
  rawProvider?: string;
  rawResponseFormat?: string;
  rawResponseTime?: number;
  wasRepaired?: boolean;
  errorMessage?: string;
};

type ConsultationContextType = {
  data: ConsultationData;
  consultationId: string;
  updateData: (section: keyof ConsultationData, value: ConsultationData[keyof ConsultationData]) => void;
  resetData: () => void;
  saveToServer: (silent?: boolean) => Promise<SaveResult>;
  triggerReload: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  activeAiTask: AiRequestTask | null;
  retryContexts: Partial<Record<AiRequestSection, AiRetryContext>>;
  startAiRequest: (section: AiRequestSection, prompt: string, documents?: ConsultationDocument[]) => Promise<void>;
  minimizeAiTask: () => void;
  restoreAiTask: () => void;
  dismissAiTask: () => void;
  markRawResponseForRetry: (section: AiRequestSection, payload?: AiRetryContext | null) => void;
  clearRetryContext: (section: AiRequestSection) => void;
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
  const [activeAiTask, setActiveAiTask] = useState<AiRequestTask | null>(null);
  const [retryContexts, setRetryContexts] = useState<Partial<Record<AiRequestSection, AiRetryContext>>>({});

  const updateData = useCallback((section: keyof ConsultationData, value: ConsultationData[keyof ConsultationData]) => {
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
    setActiveAiTask(null);
    setRetryContexts({});
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
      await api.saveConsultation(data.patient.id, data as unknown as Record<string, unknown>);
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

  const markRawResponseForRetry = useCallback(
    (section: AiRequestSection, payload?: AiRetryContext | null) => {
      setRetryContexts((prev) => {
        if (!payload?.rawResponse?.trim()) {
          const next = { ...prev };
          delete next[section];
          return next;
        }

        return {
          ...prev,
          [section]: payload,
        };
      });
    },
    [],
  );

  const clearRetryContext = useCallback((section: AiRequestSection) => {
    setRetryContexts((prev) => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  }, []);

  const minimizeAiTask = useCallback(() => {
    setActiveAiTask((prev) => (prev ? { ...prev, isMinimized: true } : prev));
  }, []);

  const restoreAiTask = useCallback(() => {
    setActiveAiTask((prev) => (prev ? { ...prev, isMinimized: false } : prev));
  }, []);

  const dismissAiTask = useCallback(() => {
    setActiveAiTask((prev) => {
      if (!prev || prev.status === 'running') {
        return prev;
      }

      return null;
    });
  }, []);

  const startAiRequest = useCallback(
    async (section: AiRequestSection, prompt: string, documents: ConsultationDocument[] = []) => {
      if (activeAiTask?.status === 'running') {
        throw new Error('Уже выполняется другой AI-запрос. Дождитесь его завершения.');
      }

      const taskId = `${section}-${Date.now()}`;
      const activeProfile = enhancedAIService.getActiveProfile();
      const initialProviderLabel = activeProfile
        ? `${activeProfile.name} (${activeProfile.modelName})`
        : undefined;
      setActiveAiTask({
        id: taskId,
        section,
        prompt,
        status: 'running',
        startedAt: new Date().toISOString(),
        isMinimized: false,
        rawProvider: initialProviderLabel,
      });

      try {
        const result = await aiService.executeRawPrompt(prompt, documents, {
          allowInteractiveFallbackPrompt: true,
          onProviderAttempt: (attempt) => {
            const attemptLabel = `${attempt.profileName} (${attempt.modelName})${attempt.stage === 'fallback' ? ' | fallback' : ''}`;
            setActiveAiTask((prev) => {
              if (!prev || prev.id !== taskId) {
                return prev;
              }

              return {
                ...prev,
                rawProvider: attemptLabel,
              };
            });
          },
        });
        setSaveStatus('idle');
        setData((prev) => ({ ...prev, [section]: result }));
        clearRetryContext(section);
        setActiveAiTask((prev) => {
          if (!prev || prev.id !== taskId) {
            return prev;
          }

          return {
            ...prev,
            status: 'success',
            rawResponse: result?.rawResponse,
            rawProvider: result?.rawProvider || prev.rawProvider,
            rawResponseFormat: result?.rawResponseFormat,
            rawResponseTime: result?.rawResponseTime,
            wasRepaired: result?.wasRepaired,
            isMinimized: false,
          };
        });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        const meta = err as Partial<AiDebugMetadata>;
        setActiveAiTask((prev) => {
          if (!prev || prev.id !== taskId) {
            return prev;
          }

          return {
            ...prev,
            status: 'error',
            errorMessage: err.message || 'Ошибка при обращении к ИИ',
            rawResponse: meta.rawResponse,
            rawProvider: meta.rawProvider || prev.rawProvider,
            rawResponseFormat: meta.rawResponseFormat,
            rawResponseTime: meta.rawResponseTime,
            wasRepaired: meta.wasRepaired,
            isMinimized: false,
          };
        });
        throw error;
      }
    },
    [activeAiTask?.status, clearRetryContext],
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  return (
    <ConsultationContext.Provider
      value={{
        data,
        consultationId,
        updateData,
        resetData,
        saveToServer,
        triggerReload,
        saveStatus,
        lastSaved,
        activeAiTask,
        retryContexts,
        startAiRequest,
        minimizeAiTask,
        restoreAiTask,
        dismissAiTask,
        markRawResponseForRetry,
        clearRetryContext,
      }}
    >
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
