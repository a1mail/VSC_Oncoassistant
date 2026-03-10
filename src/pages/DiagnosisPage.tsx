import React, { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { aiService } from '@/lib/aiService';
import { Brain, AlertCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';

export function DiagnosisPage() {
  const { data, updateData, consultationId } = useConsultation();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(data.diagnosis || null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    setAiResult(data.diagnosis || null);
  }, [consultationId]);

  const handleAnalyze = async () => {
    // Prepare sanitized data for AI
    const patientContext = {
      age: data.patient?.birth_date ? new Date().getFullYear() - new Date(data.patient.birth_date).getFullYear() : 'Unknown',
      gender: data.patient?.gender,
      anamnesis: data.anamnesis,
      exam: data.exam,
      diagnostics: data.diagnostics
    };

    const prompt = aiService.prepareDiagnosisPrompt(patientContext, data.documents || []);
    setPromptText(prompt);
    setIsPromptOpen(true);
  };

  const handleConfirmAnalyze = async (finalPrompt: string) => {
    setIsLoading(true);
    try {
      const result = await aiService.executeRawPrompt(finalPrompt, data.documents || []);
      setAiResult(result);
      updateData('diagnosis', result);
      setIsPromptOpen(false);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        alert(`Ошибка ИИ: ${error.message}`);
      } else {
        alert("Ошибка при обращении к ИИ. Проверьте консоль.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    updateData('diagnosis', aiResult);
    navigate('/treatment');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Диагноз - ${data.patient?.full_name || 'Пациент'}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 24px; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
              h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; color: #444; border-bottom: 1px solid #eee; }
              .patient-info { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
              .diagnosis-block { margin-bottom: 20px; }
              .label { font-weight: bold; color: #555; }
              .value { margin-top: 5px; white-space: pre-wrap; }
              .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Медицинское заключение: Диагноз</h1>
            
            <div class="patient-info">
              <div><span class="label">Пациент:</span> ${data.patient?.full_name || 'Не указано'}</div>
              <div><span class="label">Дата рождения:</span> ${data.patient?.birth_date ? new Date(data.patient.birth_date).toLocaleDateString('ru-RU') : 'Не указано'}</div>
            </div>

            <div class="diagnosis-block">
              <h2>Клинический диагноз</h2>
              <div><span class="label">Код МКБ-10:</span> ${aiResult.icd10}</div>
              ${aiResult.tnm ? `<div><span class="label">TNM:</span> ${aiResult.tnm}</div>` : ''}
              <div class="value">${aiResult.working_diagnosis}</div>
            </div>

            <div class="diagnosis-block">
              <h2>Обоснование</h2>
              <div class="value">${aiResult.reasoning}</div>
            </div>

            ${aiResult.missing_data && aiResult.missing_data.length > 0 ? `
            <div class="diagnosis-block">
              <h2>Рекомендации по дообследованию</h2>
              <ul>
                ${aiResult.missing_data.map((item: string) => `<li>${item}</li>`).join('')}
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

  const handleUpdateDiagnosis = (newDiagnosis: string) => {
    const updatedResult = { ...aiResult, working_diagnosis: newDiagnosis };
    setAiResult(updatedResult);
    updateData('diagnosis', updatedResult);
  };

  return (
    <div className="space-y-6">
      <PromptPreviewDialog 
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        promptText={promptText}
        onConfirm={handleConfirmAnalyze}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center no-print">
        <h2 className="text-3xl font-bold tracking-tight">Диагноз</h2>
        <div className="flex gap-2">
          <Button onClick={handleAnalyze} disabled={isLoading} className="gap-2" variant="outline">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {aiResult ? "Пересчитать диагноз" : "Сформировать диагноз с ИИ"}
          </Button>
          {aiResult && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                Печать
              </Button>
              <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 gap-2">
                Далее: Лечение <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!aiResult && (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Brain className="w-12 h-12 mb-4 opacity-20" />
            <p>Нажмите кнопку выше, чтобы проанализировать данные и сформировать диагноз.</p>
          </CardContent>
        </Card>
      )}

      {aiResult && (
        <div className="space-y-6">
          {/* Main Diagnosis Card */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-blue-900">
                {aiResult.is_final ? "Клинический диагноз (Полный)" : "Рабочий диагноз"}
              </CardTitle>
              <CardDescription>
                Код МКБ-10: <span className="font-bold text-slate-900">{aiResult.icd10}</span>
                {aiResult.tnm && <span className="ml-4">TNM: <span className="font-bold text-slate-900">{aiResult.tnm}</span></span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={aiResult.working_diagnosis} 
                onChange={(e) => handleUpdateDiagnosis(e.target.value)}
                className="text-lg font-medium min-h-[100px] bg-white"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reasoning */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  Обоснование ИИ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {aiResult.reasoning}
                </p>
              </CardContent>
            </Card>

            {/* Missing Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  План дообследования
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aiResult.missing_data && aiResult.missing_data.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                    {aiResult.missing_data.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Данных достаточно для постановки диагноза
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
