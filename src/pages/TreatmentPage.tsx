import React, { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { aiService } from '@/lib/aiService';
import { Pill, Loader2, BookOpen, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';

export function TreatmentPage() {
  const { data, updateData, consultationId } = useConsultation();
  const [isLoading, setIsLoading] = useState(false);
  const [treatmentPlan, setTreatmentPlan] = useState<any>(data.treatment || null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    setTreatmentPlan(data.treatment || null);
  }, [consultationId]);

  const handleGeneratePlan = async () => {
    if (!data.diagnosis) {
      console.warn("Сначала необходимо сформировать диагноз!");
      return;
    }

    // Prepare sanitized data for AI
    const patientContext = {
      age: data.patient?.birth_date ? new Date().getFullYear() - new Date(data.patient.birth_date).getFullYear() : 'Unknown',
      gender: data.patient?.gender,
      ecog: data.exam?.ecog
    };

    const prompt = aiService.prepareTreatmentPrompt(data.diagnosis, patientContext, data.documents || []);
    setPromptText(prompt);
    setIsPromptOpen(true);
  };

  const handleConfirmGeneratePlan = async (finalPrompt: string) => {
    setIsLoading(true);
    try {
      const result = await aiService.executeRawPrompt(finalPrompt, data.documents || []);
      setTreatmentPlan(result);
      updateData('treatment', result);
      setIsPromptOpen(false);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        alert(`Ошибка ИИ: ${error.message}`);
      } else {
        alert("Ошибка при генерации плана лечения");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Лечение - ${data.patient?.full_name || 'Пациент'}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 24px; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
              h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; color: #444; border-bottom: 1px solid #eee; }
              .patient-info { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
              .treatment-block { margin-bottom: 20px; }
              .label { font-weight: bold; color: #555; }
              .value { margin-top: 5px; white-space: pre-wrap; }
              .regimen { background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; }
              .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Медицинское заключение: План лечения</h1>
            
            <div class="patient-info">
              <div><span class="label">Пациент:</span> ${data.patient?.full_name || 'Не указано'}</div>
              <div><span class="label">Дата рождения:</span> ${data.patient?.birth_date ? new Date(data.patient.birth_date).toLocaleDateString('ru-RU') : 'Не указано'}</div>
            </div>

            <div class="treatment-block">
              <h2>Стратегия лечения</h2>
              <div class="value">${treatmentPlan.treatment_strategy}</div>
              <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Источник: ${treatmentPlan.cr_source}</div>
            </div>

            <div class="treatment-block">
              <h2>Основное лечение</h2>
              <div class="value">${treatmentPlan.primary_treatment}</div>
            </div>

            ${treatmentPlan.regimen ? `
            <div class="treatment-block">
              <h2>Рекомендуемая схема (Протокол)</h2>
              <div class="regimen">${treatmentPlan.regimen}</div>
            </div>
            ` : ''}

            ${treatmentPlan.warnings && treatmentPlan.warnings.length > 0 ? `
            <div class="treatment-block" style="border: 1px solid #f59e0b; background: #fffbeb; padding: 15px; border-radius: 5px;">
              <h2 style="color: #d97706; margin-top: 0; border-bottom: none;">⚠️ Противопоказания и Взаимодействия</h2>
              <ul style="color: #92400e;">
                ${treatmentPlan.warnings.map((item: string) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            ` : ''}

            ${treatmentPlan.recommendations && treatmentPlan.recommendations.length > 0 ? `
            <div class="treatment-block">
              <h2>Рекомендации пациенту</h2>
              <ul>
                ${treatmentPlan.recommendations.map((item: string) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            ` : ''}

            <div class="footer">
              Сформировано: ${new Date().toLocaleDateString('ru-RU')}
            </div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <PromptPreviewDialog 
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        promptText={promptText}
        onConfirm={handleConfirmGeneratePlan}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center no-print">
        <h2 className="text-3xl font-bold tracking-tight">Лечение</h2>
        <div className="flex gap-2">
          <Button onClick={handleGeneratePlan} disabled={isLoading} className="gap-2" variant="outline">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
            {treatmentPlan ? "Обновить план лечения" : "Сформировать план лечения"}
          </Button>
          {treatmentPlan && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                Печать назначений
              </Button>
              <Button onClick={() => navigate('/prescriptions')} className="bg-blue-600 gap-2">
                Далее: Назначения <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!treatmentPlan && (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Pill className="w-12 h-12 mb-4 opacity-20" />
            <p>Нажмите кнопку выше, чтобы получить рекомендации по лечению на основе диагноза.</p>
          </CardContent>
        </Card>
      )}

      {treatmentPlan && (
        <div className="space-y-6">
          {/* Warnings / Contraindications */}
          {treatmentPlan.warnings && treatmentPlan.warnings.length > 0 && (
            <Card className="border-amber-400 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Activity className="w-5 h-5 text-amber-600" />
                  Внимание: Противопоказания и Взаимодействия
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-amber-900 font-medium">
                  {treatmentPlan.warnings.map((warning: string, idx: number) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Strategy */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle>Стратегия лечения: {treatmentPlan.treatment_strategy}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Источник: {treatmentPlan.cr_source}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-slate-800">{treatmentPlan.primary_treatment}</p>
            </CardContent>
          </Card>

          {/* Regimen */}
          {treatmentPlan.regimen && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500" />
                  Рекомендуемая схема (Протокол)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-100 p-4 rounded-md font-mono text-sm text-slate-800">
                  {treatmentPlan.regimen}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Рекомендации пациенту</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-slate-700">
                {treatmentPlan.recommendations?.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
