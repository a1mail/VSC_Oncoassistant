import React, { useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { User, FileText, Stethoscope, Activity, Brain, Pill, Save, Upload, Download, Settings, HelpCircle, Database, RefreshCw, FileOutput } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConsultation } from '@/context/ConsultationContext';
import { SettingsDialog } from '@/components/SettingsDialog';
import { HelpDialog } from '@/components/HelpDialog';
import { LoadPatientDialog } from '@/components/LoadPatientDialog';
import { ReportDialog } from '@/components/ReportDialog';
import { useToast } from '@/components/ui/toast';
import { RawAiResponseDialog } from '@/components/RawAiResponseDialog';
import { AiRequestPanel } from '@/components/AiRequestPanel';
import { enhancedAIService } from '@/lib/providers';

const tabs = [
  { id: 'patient', label: 'Пациент', icon: User, path: 'patient' },
  { id: 'anamnesis', label: 'Анамнез', icon: FileText, path: 'anamnesis' },
  { id: 'exam', label: 'Осмотр', icon: Stethoscope, path: 'exam' },
  { id: 'diagnostics', label: 'Обследования', icon: Activity, path: 'diagnostics' },
  { id: 'documents', label: 'Документы', icon: FileText, path: 'documents' },
  { id: 'diagnosis', label: 'Диагноз', icon: Brain, path: 'diagnosis' },
  { id: 'treatment', label: 'Лечение', icon: Pill, path: 'treatment' },
  { id: 'prescriptions', label: 'Назначения', icon: FileText, path: 'prescriptions' },
];

const primaryTabs = tabs.slice(0, 5);
const summaryTabs = tabs.slice(5);
const actionButtonBaseClass =
  "flex h-10 min-w-[144px] items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors";

export function Layout() {
  const {
    data,
    updateData,
    saveToServer,
    resetData,
    consultationId,
    saveStatus,
    lastSaved,
    activeAiTask,
    minimizeAiTask,
    restoreAiTask,
    dismissAiTask,
    markRawResponseForRetry,
  } = useConsultation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLoadPatientOpen, setIsLoadPatientOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isRawAiResponseOpen, setIsRawAiResponseOpen] = useState(false);

  const suggestedReliableModel = useMemo(() => {
    if (!activeAiTask) {
      return '';
    }

    const settings = enhancedAIService.getSettings();
    const currentActiveId = settings.activeProfileId;
    const preferredProfiles = settings.profiles.filter((profile) => {
      if (profile.id === currentActiveId) {
        return false;
      }

      if (!profile.isActive || !profile.metrics.isHealthy) {
        return false;
      }

      if (profile.providerType === 'openrouter' && profile.openRouterModelInfo?.isFreeTier) {
        return false;
      }

      return true;
    });

    return preferredProfiles[0]?.name || '';
  }, [activeAiTask]);

  const handleExport = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient_${data.patient?.full_name || "consultation"}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        // Update all sections
        Object.keys(parsedData).forEach(key => {
          updateData(key as any, parsedData[key]);
        });
        console.log("Данные успешно загружены");
      } catch (error) {
        console.error(error);
        console.error("Ошибка при чтении файла");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <LoadPatientDialog isOpen={isLoadPatientOpen} onClose={() => setIsLoadPatientOpen(false)} />
      <ReportDialog isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
      <RawAiResponseDialog
        isOpen={isRawAiResponseOpen}
        onClose={() => setIsRawAiResponseOpen(false)}
        title={`Сырой ответ ИИ: ${activeAiTask?.section === 'treatment' ? 'Лечение' : 'Диагноз'}`}
        rawResponse={activeAiTask?.rawResponse || ''}
        responseFormat={activeAiTask?.rawResponseFormat}
        provider={activeAiTask?.rawProvider}
        responseTime={activeAiTask?.rawResponseTime}
        wasRepaired={activeAiTask?.wasRepaired}
      />
      <AiRequestPanel
        task={activeAiTask}
        suggestedModelName={suggestedReliableModel}
        onRestore={restoreAiTask}
        onMinimize={minimizeAiTask}
        onDismiss={dismissAiTask}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onShowRawResponse={() => setIsRawAiResponseOpen(true)}
        onUseRawResponse={() => {
          if (!activeAiTask?.rawResponse) {
            return;
          }

          markRawResponseForRetry(activeAiTask.section, {
            rawResponse: activeAiTask.rawResponse,
            rawProvider: activeAiTask.rawProvider,
            rawResponseFormat: activeAiTask.rawResponseFormat,
            sourceErrorMessage: activeAiTask.errorMessage,
          });
          toast.toast('Сырой ответ будет добавлен в следующий ручной запрос этого раздела.', 'success');
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            OA
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">OncoAssistant</h1>
            <p className="text-xs text-slate-500 font-medium">Система поддержки принятия врачебных решений</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".json"
            title="Import patient data from JSON file"
            aria-label="Import patient data"
          />
          
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Справка"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors mr-2"
            title="Настройки ИИ"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button 
              onClick={resetData}
              className={cn(actionButtonBaseClass, "border-red-200 bg-red-50 text-red-700 hover:bg-red-100")}
              title="Сбросить все данные и начать нового пациента"
            >
              <RefreshCw className="w-4 h-4" />
              Новый пациент
            </button>

            <button 
              onClick={() => setIsLoadPatientOpen(true)}
              className={cn(actionButtonBaseClass, "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100")}
              title="Загрузить пациента из базы данных"
            >
              <Database className="w-4 h-4" />
              База пациентов
            </button>

            <div
              className={cn(
                actionButtonBaseClass,
                "cursor-default",
                saveStatus === 'saving' && "border-sky-200 bg-sky-50 text-sky-700",
                saveStatus === 'saved' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                saveStatus === 'error' && "border-amber-200 bg-amber-50 text-amber-700",
                saveStatus !== 'saving' && saveStatus !== 'saved' && saveStatus !== 'error' && "border-slate-200 bg-slate-50 text-slate-600"
              )}
              title="Статус автосохранения"
            >
              {saveStatus === 'saving' && (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              )}
              {saveStatus === 'saved' && lastSaved && (
                <>
                  <Save className="w-4 h-4" />
                  Сохранено {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <Save className="w-4 h-4" />
                  Ошибка сохранения
                </>
              )}
              {saveStatus !== 'saving' && saveStatus !== 'saved' && saveStatus !== 'error' && (
                <>
                  <Save className="w-4 h-4" />
                  Нет сохранения
                </>
              )}
            </div>

            <button 
              onClick={async () => {
                const result = await saveToServer();
                toast.toast(result.message, result.type);
              }}
              disabled={saveStatus === 'saving'}
              className={cn(
                actionButtonBaseClass,
                saveStatus === 'saving'
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : saveStatus === 'error'
                    ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                    : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              )}
              title="Сохранить текущего пациента в базу данных"
            >
              {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить
            </button>

            <button 
              onClick={() => setIsReportOpen(true)}
              className={cn(actionButtonBaseClass, "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100")}
              title="Просмотр и копирование всех данных"
            >
              <FileOutput className="w-4 h-4" />
              Отчет
            </button>

            <button 
              onClick={handleExport}
              className={cn(actionButtonBaseClass, "border-slate-200 bg-slate-900 text-white hover:bg-slate-800")}
              title="Экспорт данных в JSON файл"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 print:block">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white no-print">
          <div className="sticky top-[73px] p-4">
            <div className="mb-8">
              <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Основное</div>
              <nav className="space-y-1">
                {primaryTabs.map((tab) => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div>
              <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Заключение</div>
              <nav className="space-y-1">
                {summaryTabs.map((tab) => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 print:p-0">
          <div className="mx-auto w-full max-w-7xl">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] p-6 print:border-none print:shadow-none print:p-0">
              <Outlet key={consultationId} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
