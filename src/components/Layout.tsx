import React, { useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { User, FileText, Stethoscope, Activity, Brain, Pill, Save, Upload, Download, Settings, HelpCircle, Database, RefreshCw, FileOutput } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConsultation } from '@/context/ConsultationContext';
import { SettingsDialog } from '@/components/SettingsDialog';
import { HelpDialog } from '@/components/HelpDialog';
import { LoadPatientDialog } from '@/components/LoadPatientDialog';
import { ReportDialog } from '@/components/ReportDialog';
import { useToast } from '@/components/ui/toast';

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

export function Layout() {
  const { data, updateData, saveToServer, resetData, consultationId, saveStatus, lastSaved } = useConsultation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLoadPatientOpen, setIsLoadPatientOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

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

          <div className="h-6 w-px bg-slate-200 mx-2"></div>

          <button 
            onClick={resetData}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium transition-colors"
            title="Сбросить все данные и начать нового пациента"
          >
            <RefreshCw className="w-4 h-4" />
            Новый
          </button>

          <button 
            onClick={() => setIsLoadPatientOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium transition-colors"
            title="Загрузить пациента из базы данных"
          >
            <Database className="w-4 h-4" />
            БД
          </button>

          <div className="flex flex-col items-end justify-center min-w-[70px]">
            {saveStatus === 'saving' && <span className="text-[10px] text-blue-600 font-medium leading-tight animate-pulse">Сохранение...</span>}
            {saveStatus === 'saved' && lastSaved && <span className="text-[10px] text-green-600 font-medium leading-tight whitespace-nowrap">Сохранено {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
            {saveStatus === 'error' && <span className="text-[10px] text-red-600 font-medium leading-tight">Ошибка</span>}
          </div>

          <button 
            onClick={async () => {
              const result = await saveToServer();
              toast.toast(result.message, result.type);
            }}
            disabled={saveStatus === 'saving'}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border",
              saveStatus === 'saving' 
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                : saveStatus === 'error'
                  ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            )}
            title="Сохранить текущего пациента в базу данных"
          >
            {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>

          <div className="h-6 w-px bg-slate-200 mx-2"></div>

          <button 
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            title="Просмотр и копирование всех данных"
          >
            <FileOutput className="w-4 h-4" />
            Отчет
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
            title="Экспорт данных в JSON файл"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200 px-6 sticky top-[73px] z-10 overflow-x-auto no-print">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive 
                  ? "border-blue-600 text-blue-600 bg-blue-50/50" 
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] p-6 print:border-none print:shadow-none print:p-0">
          <Outlet key={consultationId} />
        </div>
      </main>
    </div>
  );
}
