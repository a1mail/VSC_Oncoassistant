import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, GripHorizontal, Loader2, Minus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PromptPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
  onConfirm: (finalPrompt: string) => void;
  isLoading: boolean;
  onMinimize?: () => void;
}

export function PromptPreviewDialog({
  isOpen,
  onClose,
  promptText,
  onConfirm,
  isLoading,
  onMinimize,
}: PromptPreviewDialogProps) {
  const [editedPrompt, setEditedPrompt] = useState(promptText);
  const [progress, setProgress] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 48, y: 88 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const windowWidth = useMemo(() => {
    if (typeof window === 'undefined') {
      return 860;
    }

    return Math.min(860, Math.max(360, window.innerWidth - 32));
  }, [isOpen]);

  const clampPosition = (nextX: number, nextY: number) => {
    if (typeof window === 'undefined') {
      return { x: nextX, y: nextY };
    }

    const maxX = Math.max(16, window.innerWidth - windowWidth - 16);
    const maxY = Math.max(16, window.innerHeight - 120);

    return {
      x: Math.min(Math.max(16, nextX), maxX),
      y: Math.min(Math.max(16, nextY), maxY),
    };
  };

  useEffect(() => {
    setEditedPrompt(promptText);
  }, [promptText, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsMinimized(false);

    if (typeof window !== 'undefined') {
      const centeredX = Math.max(16, Math.round((window.innerWidth - windowWidth) / 2));
      const initialY = Math.max(16, Math.round(window.innerHeight * 0.08));
      setPosition(clampPosition(centeredX, initialY));
    }
  }, [isOpen, windowWidth]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          // Slow down progress as it gets closer to 90%
          if (prev >= 90) return prev;
          const increment = Math.max(0.5, (90 - prev) * 0.05);
          return Math.min(90, prev + increment);
        });
      }, 500);
    } else {
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 500);
      }
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      setPosition(
        clampPosition(
          event.clientX - dragOffsetRef.current.x,
          event.clientY - dragOffsetRef.current.y,
        ),
      );
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, windowWidth]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50">
        <div
          className="pointer-events-auto fixed right-4 top-20 rounded-2xl border border-slate-200 bg-white shadow-xl"
          style={{ width: Math.min(windowWidth, 360) }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
              ) : (
                <Eye className="h-4 w-4 flex-shrink-0 text-blue-600" />
              )}
              <span className="truncate text-sm font-medium text-slate-900">
                {isLoading ? 'Запрос к ИИ выполняется в фоне' : 'Предпросмотр запроса к ИИ'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Развернуть"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className="pointer-events-auto fixed flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{
          left: position.x,
          top: position.y,
          width: windowWidth,
          maxWidth: 'calc(100vw - 32px)',
          height: 'min(80vh, 760px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        <div
          className="flex cursor-move items-center justify-between border-b border-slate-200 px-4 py-4"
          onMouseDown={handleHeaderMouseDown}
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Предпросмотр запроса к ИИ
          </h2>
          <div className="flex items-center gap-1">
            <GripHorizontal className="h-4 w-4 text-slate-300" />
            <button
              onClick={() => {
                setIsMinimized(true);
                onMinimize?.();
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Свернуть"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Внимание: Конфиденциальность данных</p>
            <p>
              Это точный текст запроса, который будет отправлен в ИИ. 
              Система автоматически скрыла основные персональные данные (ФИО, телефон), но вы должны проверить текст.
              Убедитесь, что в тексте или прикрепленных документах не осталось конфиденциальной информации перед отправкой.
            </p>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Текст запроса (вы можете отредактировать его):
          </label>
          <Textarea 
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="flex-1 font-mono text-sm resize-none"
            placeholder="Текст запроса..."
            readOnly={isLoading}
          />
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          {isLoading && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Генерация ответа ИИ...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            {isLoading ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMinimized(true);
                    onMinimize?.();
                  }}
                >
                  Свернуть
                </Button>
                <Button disabled className="bg-blue-600 gap-2 min-w-[180px]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Обработка...
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Отмена
                </Button>
                <Button 
                  onClick={() => onConfirm(editedPrompt)} 
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[180px]"
                >
                  Отправить запрос
                  <Send className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
