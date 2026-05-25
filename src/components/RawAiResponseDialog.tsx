import React from 'react';
import { X, FileCode2, Clock3, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RawAiResponseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  rawResponse: string;
  responseFormat?: string;
  provider?: string;
  responseTime?: number;
  wasRepaired?: boolean;
}

export function RawAiResponseDialog({
  isOpen,
  onClose,
  title,
  rawResponse,
  responseFormat,
  provider,
  responseTime,
  wasRepaired,
}: RawAiResponseDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <FileCode2 className="h-5 w-5 text-blue-600" />
              {title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
              {provider && <span className="rounded-full bg-slate-100 px-2.5 py-1">Провайдер/модель: {provider}</span>}
              {responseFormat && <span className="rounded-full bg-slate-100 px-2.5 py-1">Формат: {responseFormat.toUpperCase()}</span>}
              {typeof responseTime === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {responseTime} мс
                </span>
              )}
              {wasRepaired && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                  <Wrench className="h-3.5 w-3.5" />
                  Итог был восстановлен из сырого ответа
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600" aria-label="Закрыть">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Здесь показан первичный ответ модели до структурного парсинга. Это помогает понять, что именно вернула нейросеть.
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <Textarea
            value={rawResponse || 'Сырой ответ отсутствует'}
            readOnly
            className="h-full min-h-full resize-none font-mono text-sm"
          />
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-4">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
