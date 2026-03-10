import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useConsultation } from '@/context/ConsultationContext';
import { Copy, Printer, X } from 'lucide-react';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportDialog({ isOpen, onClose }: ReportDialogProps) {
  const { data } = useConsultation();
  const contentRef = useRef<HTMLDivElement>(null);

  const generateReport = () => {
    const parts = [];

    if (data.patient) {
      parts.push(`ПАЦИЕНТ: ${data.patient.full_name || 'Не указано'}`);
      parts.push(`ДАТА РОЖДЕНИЯ: ${data.patient.birth_date ? new Date(data.patient.birth_date).toLocaleDateString('ru-RU') : 'Не указано'}`);
      parts.push(`ПОЛ: ${data.patient.gender === 'male' ? 'Мужской' : 'Женский'}`);
      if (data.patient.snils) parts.push(`СНИЛС: ${data.patient.snils}`);
      if (data.patient.policy_number) parts.push(`ПОЛИС: ${data.patient.policy_number}`);
      parts.push('');
    }

    if (data.anamnesis) {
      parts.push('--- ЖАЛОБЫ И АНАМНЕЗ ---');
      if (data.anamnesis.complaints) parts.push(`ЖАЛОБЫ:\n${data.anamnesis.complaints}`);
      if (data.anamnesis.history_of_disease) parts.push(`ИСТОРИЯ ЗАБОЛЕВАНИЯ:\n${data.anamnesis.history_of_disease}`);
      if (data.anamnesis.life_history) parts.push(`ИСТОРИЯ ЖИЗНИ:\n${data.anamnesis.life_history}`);
      parts.push('');
    }

    if (data.exam) {
      parts.push('--- ОБЪЕКТИВНЫЙ ОСМОТР ---');
      if (data.exam.general_condition) parts.push(`ОБЩЕЕ СОСТОЯНИЕ: ${data.exam.general_condition}`);
      if (data.exam.ecog) parts.push(`ECOG: ${data.exam.ecog}`);
      if (data.exam.local_status) parts.push(`LOCAL STATUS:\n${data.exam.local_status}`);
      parts.push('');
    }

    if (data.diagnostics) {
      parts.push('--- ДАННЫЕ ОБСЛЕДОВАНИЙ ---');
      parts.push(data.diagnostics); // Assuming it's a string or simple object
      parts.push('');
    }

    if (data.diagnosis) {
      parts.push('--- ДИАГНОЗ ---');
      parts.push(data.diagnosis);
      parts.push('');
    }

    if (data.treatment) {
      parts.push('--- ПЛАН ЛЕЧЕНИЯ ---');
      if (data.treatment.treatment_strategy) parts.push(`СТРАТЕГИЯ: ${data.treatment.treatment_strategy}`);
      if (data.treatment.primary_treatment) parts.push(`ОСНОВНОЕ ЛЕЧЕНИЕ: ${data.treatment.primary_treatment}`);
      if (data.treatment.regimen) parts.push(`СХЕМА: ${data.treatment.regimen}`);
      if (data.treatment.recommendations && Array.isArray(data.treatment.recommendations)) {
        parts.push('РЕКОМЕНДАЦИИ:');
        data.treatment.recommendations.forEach((rec: string) => parts.push(`- ${rec}`));
      }
    }

    return parts.join('\n');
  };

  const reportText = generateReport();

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    console.log('Текст скопирован в буфер обмена');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Медицинская карта - ${data.patient?.full_name || 'Пациент'}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
              h1 { font-size: 18px; margin-bottom: 20px; }
              pre { white-space: pre-wrap; font-family: monospace; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>Медицинская карта</h1>
            <pre>${reportText}</pre>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
        // Fallback if popup blocked
        const originalContent = document.body.innerHTML;
        const printContent = document.createElement('div');
        printContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">${reportText}</pre>`;
        document.body.innerHTML = '';
        document.body.appendChild(printContent);
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); // Reload to restore state properly
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Текстовый отчет</h2>
          <p className="text-sm text-slate-500 mt-1">
            Скопируйте данные для вставки в медицинскую информационную систему
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 font-mono text-sm whitespace-pre-wrap mx-4 my-4 rounded-md border border-slate-200">
          {reportText || "Нет данных для отображения"}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" />
            Копировать весь текст
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Печать текста
          </Button>
        </div>
      </div>
    </div>
  );
}
