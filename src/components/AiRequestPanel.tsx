import React from 'react';
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, Settings, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AiRequestTask = {
  id: string;
  section: 'diagnosis' | 'treatment';
  status: 'running' | 'success' | 'error';
  isMinimized: boolean;
  rawProvider?: string;
  rawResponse?: string;
  errorMessage?: string;
};

interface AiRequestPanelProps {
  task: AiRequestTask | null;
  suggestedModelName?: string;
  onRestore: () => void;
  onMinimize: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
  onUseRawResponse: () => void;
  onShowRawResponse: () => void;
}

const SECTION_LABELS = {
  diagnosis: 'Диагноз',
  treatment: 'Лечение',
};

export function AiRequestPanel({
  task,
  suggestedModelName,
  onRestore,
  onMinimize,
  onDismiss,
  onOpenSettings,
  onUseRawResponse,
  onShowRawResponse,
}: AiRequestPanelProps) {
  if (!task) {
    return null;
  }

  const sectionLabel = SECTION_LABELS[task.section];

  if (task.isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onRestore}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
        >
          {task.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          {task.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          {task.status === 'error' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
          AI: {sectionLabel}
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bot className="h-4 w-4 text-blue-600" />
            AI-запрос: {sectionLabel}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {task.rawProvider ? `Провайдер/модель: ${task.rawProvider}` : 'Провайдер/модель определяется...'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <ChevronDown className="h-5 w-5" />
          </button>
          {task.status !== 'running' && (
            <button onClick={onDismiss} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {task.status === 'running' && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Запрос выполняется в фоне. Можно продолжать работу в приложении.
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onMinimize}>
                Свернуть
              </Button>
            </div>
          </>
        )}

        {task.status === 'success' && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Ответ ИИ получен и сохранён в текущем разделе.
            </div>
            <div className="flex justify-end gap-2">
              {task.rawResponse && (
                <Button variant="outline" onClick={onShowRawResponse}>
                  Сырой ответ
                </Button>
              )}
              <Button variant="outline" onClick={onDismiss}>
                Закрыть
              </Button>
            </div>
          </>
        )}

        {task.status === 'error' && (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{task.errorMessage || 'Ошибка при обработке ответа ИИ'}</span>
              </div>
              <p className="mt-2 text-xs text-amber-800">
                Попробуйте вручную переключиться на более надёжную модель и повторить запрос.
                {suggestedModelName ? ` Рекомендуемая модель: ${suggestedModelName}.` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenSettings} className="gap-2">
                <Settings className="h-4 w-4" />
                Сменить модель
              </Button>
              {task.rawResponse && (
                <Button variant="outline" onClick={onShowRawResponse}>
                  Показать сырой ответ
                </Button>
              )}
              {task.rawResponse && (
                <Button onClick={onUseRawResponse} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Wand2 className="h-4 w-4" />
                  Использовать сырой ответ в следующем запросе
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
