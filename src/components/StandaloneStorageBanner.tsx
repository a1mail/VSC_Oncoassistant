import React, { useEffect, useState } from 'react';
import { HardDrive, FolderOpen, Save, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
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
} from '@/lib/portablePatientStorage';

/**
 * Shows storage guidance only in the standalone HTML build.
 * This keeps the regular web app unchanged while allowing flash-drive storage.
 */
export function StandaloneStorageBanner() {
  const toast = useToast();
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
                    : `Выберите папку на флешке или другом носителе. До выбора папки приложение временно использует localStorage браузера.`}
                </p>
                {canSaveHtml && (
                  <p>
                    После добавления или импорта профилей провайдеров нажмите «Сохранить HTML с профилями», чтобы встроить их прямо в `Diagassist_5.html`.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                В этом браузере выбор папки недоступен. Для сохранения базы на флешке используйте Microsoft Edge или Google Chrome.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
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
