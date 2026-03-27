import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PromptPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
  onConfirm: (finalPrompt: string) => void;
  isLoading: boolean;
}

export function PromptPreviewDialog({ isOpen, onClose, promptText, onConfirm, isLoading }: PromptPreviewDialogProps) {
  const [editedPrompt, setEditedPrompt] = useState(promptText);

  useEffect(() => {
    setEditedPrompt(promptText);
  }, [promptText, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Предпросмотр запроса к ИИ
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
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
          />
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button 
            onClick={() => onConfirm(editedPrompt)} 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {isLoading ? "Отправка..." : "Отправить запрос"}
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
