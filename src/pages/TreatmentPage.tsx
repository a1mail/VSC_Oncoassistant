import React, { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { aiService } from '@/lib/aiService';
import { Pill, Loader2, BookOpen, Activity, ArrowRight, FileCode2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { normalizePrescriptions, toPrescriptionText } from '@/lib/prescriptions';
import { esc, openPrintWindow, buildPatientInfoBlock, buildFooter } from '@/lib/htmlUtils';
import { extractRawAiDebugState, type RawAiDebugState } from '@/lib/rawAiDebug';
import type { TreatmentResult, ConsultationData } from '@/lib/types/consultation';
import { calculateAge } from '@/lib/utils/dateUtils';

import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { RawAiResponseDialog } from '@/components/RawAiResponseDialog';

export function TreatmentPage() {
  const { data, consultationId, activeAiTask, retryContexts, startAiRequest, clearRetryContext } = useConsultation();
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentResult | null>(data.treatment || null);
  const [rawDebugState, setRawDebugState] = useState<RawAiDebugState | null>(extractRawAiDebugState(data.treatment));
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isRawResponseOpen, setIsRawResponseOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const navigate = useNavigate();
  const hasRunningAiTask = activeAiTask?.status === 'running';
  const isRunningCurrentTask = activeAiTask?.section === 'treatment' && activeAiTask.status === 'running';
  const retryContext = retryContexts.treatment;
  const treatmentStrategyText = toPrescriptionText(treatmentPlan?.treatment_strategy);
  const primaryTreatmentText = toPrescriptionText(treatmentPlan?.primary_treatment);
  const regimenText = toPrescriptionText(treatmentPlan?.regimen);
  const crSourceText = toPrescriptionText(treatmentPlan?.cr_source);
  const warnings = Array.isArray(treatmentPlan?.warnings)
    ? treatmentPlan.warnings.map(toPrescriptionText).filter(Boolean)
    : typeof treatmentPlan?.warnings === 'string' && treatmentPlan.warnings.trim()
      ? [treatmentPlan.warnings]
      : [];
  const recommendations = Array.isArray(treatmentPlan?.recommendations)
    ? treatmentPlan.recommendations.map(toPrescriptionText).filter(Boolean)
    : typeof treatmentPlan?.recommendations === 'string' && treatmentPlan.recommendations.trim()
      ? [treatmentPlan.recommendations]
      : [];
  const prescriptions = normalizePrescriptions(treatmentPlan?.prescriptions);

  React.useEffect(() => {
    setTreatmentPlan(data.treatment || null);
    setRawDebugState(extractRawAiDebugState(data.treatment));
  }, [consultationId, data.treatment]);

  React.useEffect(() => {
    if (activeAiTask?.section === 'treatment' && activeAiTask.status !== 'running') {
      setIsPromptOpen(false);
    }
  }, [activeAiTask]);

  const handleGeneratePlan = async () => {
    if (hasRunningAiTask) {
      return;
    }

    if (!data.diagnosis) {
      console.warn("Сначала необходимо сформировать диагноз!");
      return;
    }

    // Prepare sanitized data for AI
    const patientContext = {
      age: calculateAge(data.patient?.birth_date) ?? 'Unknown',
      gender: data.patient?.gender,
      ecog: data.exam?.ecog,
      menopause_status: data.patient?.menopause_status,
      menopause_basis: data.patient?.menopause_basis,
    };

    let prompt = aiService.prepareTreatmentPrompt(data.diagnosis as unknown as Record<string, unknown>, patientContext as unknown as ConsultationData, data.documents || []);
    if (retryContext?.rawResponse) {
      prompt = aiService.appendRawResponseRetryContext(prompt, 'treatment', retryContext.rawResponse, {
        provider: retryContext.rawProvider,
        previousError: retryContext.sourceErrorMessage,
      });
    }
    setPromptText(aiService.getFinalExecutionPrompt(prompt));
    setIsPromptOpen(true);
  };

  const handleConfirmGeneratePlan = (finalPrompt: string) => {
    setRawDebugState(null);
    void startAiRequest('treatment', finalPrompt, data.documents || []).catch((error) => {
      console.error(error);
      const extractedRawDebugState = extractRawAiDebugState(error);
      if (extractedRawDebugState) {
        setRawDebugState(extractedRawDebugState);
      }
    });
  };

  const handlePrint = () => {
    const regimenHtml = regimenText
      ? `<div class="treatment-block"><h2>Рекомендуемая схема (Протокол)</h2><div class="regimen">${esc(regimenText)}</div></div>`
      : '';
    const warningsHtml = warnings.length > 0
      ? `<div class="treatment-block" style="border:1px solid #f59e0b;background:#fffbeb;padding:15px;border-radius:5px;"><h2 style="color:#d97706;margin-top:0;border-bottom:none;">⚠️ Противопоказания и Взаимодействия</h2><ul style="color:#92400e;">${warnings.map((item: string) => `<li>${esc(item)}</li>`).join('')}</ul></div>`
      : '';
    const recommendationsHtml = recommendations.length > 0
      ? `<div class="treatment-block"><h2>Рекомендации пациенту</h2><ul>${recommendations.map((item: string) => `<li>${esc(item)}</li>`).join('')}</ul></div>`
      : '';
    const prescriptionsHtml = prescriptions.length > 0
      ? `<div class="treatment-block"><h2>Назначения</h2><ul>${prescriptions.map((item) => `<li><strong>${esc(item.name)}</strong>: ${esc(item.details)}</li>`).join('')}</ul></div>`
      : '';

    openPrintWindow({
      title: `Лечение - ${data.patient?.full_name || 'Пациент'}`,
      extraCss: '.treatment-block { margin-bottom: 20px; } .regimen { background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; }',
      bodyHtml: `
        <h1>Медицинское заключение: План лечения</h1>
        ${buildPatientInfoBlock(data.patient)}
        <div class="treatment-block">
          <h2>Стратегия лечения</h2>
          <div class="value">${esc(treatmentStrategyText)}</div>
          <div style="font-size:0.9em;color:#666;margin-top:5px;">Источник: ${esc(crSourceText)}</div>
        </div>
        <div class="treatment-block">
          <h2>Основное лечение</h2>
          <div class="value">${esc(primaryTreatmentText)}</div>
        </div>
        ${regimenHtml}
        ${warningsHtml}
        ${recommendationsHtml}
        ${prescriptionsHtml}
        ${buildFooter()}`,
    });
  };

  return (
    <div className="space-y-6">
      <PromptPreviewDialog 
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        promptText={promptText}
        onConfirm={handleConfirmGeneratePlan}
        isLoading={isRunningCurrentTask}
      />
      <RawAiResponseDialog
        isOpen={isRawResponseOpen}
        onClose={() => setIsRawResponseOpen(false)}
        title="Сырой ответ ИИ: Лечение"
        rawResponse={rawDebugState?.rawResponse || ''}
        responseFormat={rawDebugState?.rawResponseFormat}
        provider={rawDebugState?.rawProvider}
        responseTime={rawDebugState?.rawResponseTime}
        wasRepaired={rawDebugState?.wasRepaired}
      />

      <div className="flex justify-between items-center no-print">
        <h2 className="text-3xl font-bold tracking-tight">Лечение</h2>
        <div className="flex gap-2">
          <Button onClick={handleGeneratePlan} disabled={hasRunningAiTask} className="gap-2" variant="outline">
            {isRunningCurrentTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
            {treatmentPlan ? "Обновить план лечения" : "Сформировать план лечения"}
          </Button>
          {(treatmentPlan || rawDebugState) && (
            <>
              <Button variant="outline" onClick={() => setIsRawResponseOpen(true)} className="gap-2">
                <FileCode2 className="w-4 h-4" />
                Сырой ответ ИИ
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                Печать назначений
              </Button>
              <Button onClick={() => navigate('../prescriptions')} className="bg-blue-600 gap-2">
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

      {retryContext?.rawResponse && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-blue-900 md:flex-row md:items-center md:justify-between">
            <div>
              Следующий ручной запрос на лечение будет дополнен сырым ответом предыдущей модели как справочным контекстом.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsRawResponseOpen(true)}>
                Показать сырой ответ
              </Button>
              <Button variant="outline" onClick={() => clearRetryContext('treatment')}>
                Не использовать
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {treatmentPlan && (
        <div className="space-y-6">
          {/* Warnings / Contraindications */}
          {warnings.length > 0 && (
            <Card className="border-amber-400 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Activity className="w-5 h-5 text-amber-600" />
                  Внимание: Противопоказания и Взаимодействия
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-amber-900 font-medium">
                  {warnings.map((warning: string, idx: number) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Strategy */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle>Стратегия лечения: {treatmentStrategyText || 'Не указана'}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Источник: {crSourceText || 'Не указан'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-slate-800">{primaryTreatmentText || 'Не указано'}</p>
            </CardContent>
          </Card>

          {/* Regimen */}
          {regimenText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500" />
                  Рекомендуемая схема (Протокол)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-100 p-4 rounded-md font-mono text-sm text-slate-800">
                  {regimenText}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Рекомендации пациенту</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-slate-700">
                {recommendations.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          )}

          {prescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Назначения</CardTitle>
                <CardDescription>
                  Выделено из структурированного ответа ИИ и будет доступно также на вкладке `Назначения`.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prescriptions.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {item.type}
                        </span>
                        <span className="font-semibold text-slate-900">{item.name}</span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{item.details}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
