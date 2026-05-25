import React, { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { aiService } from '@/lib/aiService';
import { Brain, AlertCircle, CheckCircle, Loader2, ArrowRight, FileCode2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { esc, openPrintWindow, buildPatientInfoBlock, buildFooter } from '@/lib/htmlUtils';
import { extractRawAiDebugState, type RawAiDebugState } from '@/lib/rawAiDebug';
import type { DiagnosisResult } from '@/lib/types/consultation';
import { calculateAge } from '@/lib/utils/dateUtils';

import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { RawAiResponseDialog } from '@/components/RawAiResponseDialog';

export function DiagnosisPage() {
  const { data, consultationId, updateData, activeAiTask, retryContexts, startAiRequest, clearRetryContext } = useConsultation();
  const [aiResult, setAiResult] = useState<DiagnosisResult | null>(data.diagnosis || null);
  const [rawDebugState, setRawDebugState] = useState<RawAiDebugState | null>(extractRawAiDebugState(data.diagnosis));
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isRawResponseOpen, setIsRawResponseOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const navigate = useNavigate();
  const hasRunningAiTask = activeAiTask?.status === 'running';
  const isRunningCurrentTask = activeAiTask?.section === 'diagnosis' && activeAiTask.status === 'running';
  const retryContext = retryContexts.diagnosis;
  const missingData = Array.isArray(aiResult?.missing_data)
    ? aiResult.missing_data
    : typeof aiResult?.missing_data === 'string' && aiResult.missing_data.trim()
      ? [aiResult.missing_data]
      : [];

  React.useEffect(() => {
    setAiResult(data.diagnosis || null);
    setRawDebugState(extractRawAiDebugState(data.diagnosis));
  }, [consultationId, data.diagnosis]);

  React.useEffect(() => {
    if (activeAiTask?.section === 'diagnosis' && activeAiTask.status !== 'running') {
      setIsPromptOpen(false);
    }
  }, [activeAiTask]);

  const handleAnalyze = async () => {
    if (hasRunningAiTask) {
      return;
    }

    // Prepare sanitized data for AI
    const patientContext = {
      age: calculateAge(data.patient?.birth_date) ?? 'Unknown',
      gender: data.patient?.gender,
      menopause_status: data.patient?.menopause_status,
      menopause_basis: data.patient?.menopause_basis,
      anamnesis: data.anamnesis,
      exam: data.exam,
      diagnostics: data.diagnostics
    };

    let prompt = aiService.prepareDiagnosisPrompt(patientContext, data.documents || []);
    if (retryContext?.rawResponse) {
      prompt = aiService.appendRawResponseRetryContext(prompt, 'diagnosis', retryContext.rawResponse, {
        provider: retryContext.rawProvider,
        previousError: retryContext.sourceErrorMessage,
      });
    }
    setPromptText(aiService.getFinalExecutionPrompt(prompt));
    setIsPromptOpen(true);
  };

  const handleConfirmAnalyze = (finalPrompt: string) => {
    setRawDebugState(null);
    void startAiRequest('diagnosis', finalPrompt, data.documents || []).catch((error) => {
      console.error(error);
      const extractedRawDebugState = extractRawAiDebugState(error);
      if (extractedRawDebugState) {
        setRawDebugState(extractedRawDebugState);
      }
    });
  };

  const handleConfirm = () => {
    updateData('diagnosis', aiResult ?? undefined);
    navigate('../treatment');
  };

  const handlePrint = () => {
    if (!aiResult) return;
    const missingHtml = missingData.length > 0
      ? `<div class="diagnosis-block"><h2>Рекомендации по дообследованию</h2><ul>${missingData.map((item: string) => `<li>${esc(item)}</li>`).join('')}</ul></div>`
      : '';

    openPrintWindow({
      title: `Диагноз - ${data.patient?.full_name || 'Пациент'}`,
      extraCss: '.diagnosis-block { margin-bottom: 20px; }',
      bodyHtml: `
        <h1>Медицинское заключение: Диагноз</h1>
        ${buildPatientInfoBlock(data.patient)}
        <div class="diagnosis-block">
          <h2>Клинический диагноз</h2>
          <div><span class="label">Код МКБ-10:</span> ${esc(aiResult.icd10)}</div>
          ${aiResult.tnm ? `<div><span class="label">TNM:</span> ${esc(aiResult.tnm)}</div>` : ''}
          <div class="value">${esc(aiResult.working_diagnosis)}</div>
        </div>
        <div class="diagnosis-block">
          <h2>Обоснование</h2>
          <div class="value">${esc(aiResult.reasoning)}</div>
        </div>
        ${missingHtml}
        ${buildFooter()}`,
    });
  };

  const handleUpdateDiagnosis = (newDiagnosis: string) => {
    const updatedResult = { ...aiResult, working_diagnosis: newDiagnosis } as DiagnosisResult;
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
        isLoading={isRunningCurrentTask}
      />
      <RawAiResponseDialog
        isOpen={isRawResponseOpen}
        onClose={() => setIsRawResponseOpen(false)}
        title="Сырой ответ ИИ: Диагноз"
        rawResponse={rawDebugState?.rawResponse || ''}
        responseFormat={rawDebugState?.rawResponseFormat}
        provider={rawDebugState?.rawProvider}
        responseTime={rawDebugState?.rawResponseTime}
        wasRepaired={rawDebugState?.wasRepaired}
      />

      <div className="flex justify-between items-center no-print">
        <h2 className="text-3xl font-bold tracking-tight">Диагноз</h2>
        <div className="flex gap-2">
          <Button onClick={handleAnalyze} disabled={hasRunningAiTask} className="gap-2" variant="outline">
            {isRunningCurrentTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {aiResult ? "Пересчитать диагноз" : "Сформировать диагноз с ИИ"}
          </Button>
          {(aiResult || rawDebugState) && (
            <>
              <Button variant="outline" onClick={() => setIsRawResponseOpen(true)} className="gap-2">
                <FileCode2 className="w-4 h-4" />
                Сырой ответ ИИ
              </Button>
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

      {retryContext?.rawResponse && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-blue-900 md:flex-row md:items-center md:justify-between">
            <div>
              Следующий ручной запрос на диагноз будет дополнен сырым ответом предыдущей модели как справочным контекстом.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsRawResponseOpen(true)}>
                Показать сырой ответ
              </Button>
              <Button variant="outline" onClick={() => clearRetryContext('diagnosis')}>
                Не использовать
              </Button>
            </div>
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
                {missingData.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                    {missingData.map((item: string, idx: number) => (
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
