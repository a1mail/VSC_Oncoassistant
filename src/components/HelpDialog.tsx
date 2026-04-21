import React from 'react';
import { HelpCircle, X, Download, Server, Monitor, Code } from 'lucide-react';

export function HelpDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const handleDownloadSource = () => {
    window.location.href = '/api/download-source';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 relative my-8 h-fit">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800">
          <HelpCircle className="w-6 h-6 text-blue-600" />
          Справка и Установка
        </h2>

        <div className="space-y-6 text-slate-700">
          
          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              Как установить на другой компьютер (без прав администратора)?
            </h3>
            <p className="mb-2">
              Это веб-приложение, которое работает в браузере. Самый простой способ использовать его на другом компьютере — это открыть его через интернет.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Если у вас есть доступ к интернету, просто откройте ссылку на это приложение.</li>
              <li>Если вам нужно работать <strong>оффлайн</strong> или на закрытом контуре:</li>
            </ul>
            <div className="bg-slate-50 p-4 rounded-lg mt-2 border border-slate-200 text-sm">
              <p className="font-medium mb-1">Вариант "Portable" (для продвинутых пользователей):</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Скачайте <strong>Node.js Portable</strong> (версия LTS) на флешку.</li>
                <li>
                  <button 
                    onClick={handleDownloadSource}
                    className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1 mx-1"
                  >
                    <Download className="w-3 h-3" />
                    Скачайте исходный код проекта (ZIP)
                  </button>
                  и распакуйте на флешку.
                </li>
                <li>Запустите <code>npm install</code> (нужен интернет один раз) и <code>npm run build</code>.</li>
                <li>Для запуска используйте скрипт <code>start.bat</code> (нужно создать), который выполняет <code>node server.js</code>.</li>
                <li>Откройте <code>http://localhost:3000</code> в браузере.</li>
              </ol>
              <p className="mt-2 text-xs text-slate-500">
                * Примечание: База данных (SQLite) будет храниться в файле <code>patient_data.db</code> рядом с приложением.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-500" />
              Настройка ИИ (если провайдер недоступен)
            </h3>
            <p className="mb-2">
              Если текущий AI-провайдер недоступен, используйте альтернативные модели через настройки (шестеренка в углу).
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Perplexity AI:</strong> Работает в РФ (иногда нужен VPN). Выберите провайдер "OpenAI Compatible", введите Base URL: <code>https://api.perplexity.ai</code> и ваш API Key. Модель: <code>llama-3-sonar-large-32k-online</code>.
              </li>
              <li>
                <strong>DeepSeek:</strong> Аналогично, Base URL: <code>https://api.deepseek.com</code>.
              </li>
              <li>
                <strong>GigaChat / YandexGPT:</strong> Напрямую пока не поддерживаются в интерфейсе (требуют сложной авторизации), но вы можете использовать их через локальный прокси (например, LM Studio или Ollama), указав адрес <code>http://localhost:1234/v1</code>.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-500" />
              Перенос данных
            </h3>
            <p>
              Чтобы перенести данные пациента на другой компьютер:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Нажмите кнопку <strong>"Экспорт (JSON)"</strong> в шапке приложения.</li>
              <li>Сохраните файл на флешку.</li>
              <li>На другом компьютере откройте приложение и нажмите <strong>"Загрузить"</strong>.</li>
              <li>Выберите сохраненный файл.</li>
            </ol>
          </section>

        </div>

        <div className="mt-8 flex justify-between items-center">
          <button 
            onClick={handleDownloadSource}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            Скачать исходный код
          </button>

          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
