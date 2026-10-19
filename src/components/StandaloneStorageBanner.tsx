import React, { useEffect, useState } from 'react';
import { HardDrive, FolderOpen, Save, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useConsultation } from '@/context/ConsultationContext';
import { clearPortableSession } from '@/lib/appStorage';
import { profileService } from '@/lib/providers/profileService';
import { enhancedAIService } from '@/lib/providers';
import {
  exportStandaloneHtmlWithEmbeddedProfiles,
  isStandaloneHtmlFileVariant,
  supportsDirectHtmlSave,
} from '@/lib/embeddedHtmlState';
import {
  choosePortablePatientStorageDirectory,
  getPortablePatientStorageState,
  isDiagassist4Variant,
  subscribePortablePatientStorage,
  type PortablePatientStorageState,
  disconnectPortablePatientStorage,
} from '@/lib/portablePatientStorage';

/**
 * Shows storage guidance only in the standalone HTML build.
 * This keeps the regular web app unchanged while allowing flash-drive storage.
 */
export function StandaloneStorageBanner() {
  const toast = useToast();
  const { resetData, saveToServer, activeAiTask, data } = useConsultation();
  const [ended, setEnded] = useState(false);
  const [state, setState] = useState<PortablePatientStorageState>(getPortablePatientStorageState);
  const canSaveHtml = isStandaloneHtmlFileVariant();
  const canDirectSaveHtml = supportsDirectHtmlSave();

  useEffect(() => {
    return subscribePortablePatientStorage(setState);
  }, []);

  if (!isDiagassist4Variant()) {
    return null;
  }

  const handleChooseFolder = async () => {
    try {
      const nextState = await choosePortablePatientStorageDirectory();
      setState(nextState);
      toast.success(`Папка выбрана: ${nextState.folderName}. База пациентов будет сохраняться в ${nextState.fileName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось выбрать папку для базы пациентов.';
      toast.error(message);
    }
  };

  const handleSaveStandaloneHtml = async () => {
    try {
      if (!confirm('HTML будет содержать API-ключи профилей в открытом виде. Сохраняйте только на своей флешке; не публикуйте этот персонализированный файл. Продолжить?')) return;
      const result = await exportStandaloneHtmlWithEmbeddedProfiles();
      toast.success(
        result === 'saved'
          ? 'HTML-файл обновлен. Профили провайдеров встроены внутрь файла.'
          : 'HTML-файл выгружен через скачивание. Профили провайдеров встроены внутрь файла.',
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : 'Не удалось сохранить HTML-файл.';
      toast.error(message);
    }
  };

  /** Refuse to discard a live AI request or unsaved patient, then release all application session state. */
  const handleEndSession = async () => {
    if (activeAiTask?.status === 'running') {
      toast.error('Дождитесь окончания запроса ИИ перед завершением сеанса.');
      return;
    }
    if (!confirm('Сохранить пациента на флешке и завершить сеанс? Профили сохраните в HTML заранее.')) return;
    if (data.patient?.full_name) {
      const result = await saveToServer();
      if (!result.success) { toast.error(result.message); return; }
    }
    enhancedAIService.stopHealthChecks();
    profileService.clearAll();
    clearPortableSession();
    enhancedAIService.reloadSettings();
    disconnectPortablePatientStorage();
    resetData();
    const embedded = document.getElementById('oncoassistant-embedded-state');
    if (embedded) embedded.textContent = '';
    setEnded(true);
    window.dispatchEvent(new Event('onco-session-ended'));
  };

  if (ended) {
    return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] bg-white p-12">
      <h1 className="text-2xl font-bold">Сеанс завершен</h1>
      <p>Данные приложения в памяти очищены. Закройте вкладку браузера и извлеките флешку.</p>
      <p>История браузера, буфер обмена и следы операционной системы не контролируются приложением.</p>
    </div>;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 no-print">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white p-2 text-amber-700 shadow-sm">
            {state.supported ? <HardDrive className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Standalone HTML: данные пациентов могут храниться на флешке, а профили — внутри файла
            </p>
            {state.supported ? (
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  {state.selected
                    ? `Текущая папка: ${state.folderName}. Данные пациентов и консультаций сохраняются в файл ${state.fileName}.`
                    : `Выберите папку на флешке. До выбора папки данные находятся только в памяти и не сохраняются после закрытия вкладки.`}
                </p>
                {canSaveHtml && (
                  <p>
                    После изменения профилей сохраните персональную копию HTML на флешке. API-ключи в ней доступны для чтения; не публикуйте эту копию.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                Выбор папки недоступен. Данные находятся только в памяти; используйте Edge или Chrome для файловой базы и сохраняйте экспорт вручную на флешку.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <Button onClick={handleEndSession} variant="outline">Завершить сеанс</Button>
          {state.supported && (
            <Button onClick={handleChooseFolder} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              {state.selected ? 'Сменить папку базы' : 'Выбрать папку базы'}
            </Button>
          )}

          {canSaveHtml && (
            <Button onClick={handleSaveStandaloneHtml} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              {canDirectSaveHtml ? 'Сохранить HTML с профилями' : 'Скачать HTML с профилями'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
