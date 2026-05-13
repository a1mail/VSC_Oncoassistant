import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, stringsToOptions } from '@/components/ui/multi-select';
import { useConsultation } from '@/context/ConsultationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const IMAGING_METHODS = [
  "Рентген",
  "ФЛГ (флюорография)",
  "КТ (без контраста)",
  "КТ (с контрастом)",
  "МРТ (без контраста)",
  "МРТ (с контрастом)",
  "УЗИ",
  "ПЭТ-КТ",
  "ФГДС",
  "Колоноскопия",
  "Бронхоскопия",
  "Лапароскопия",
];

const IMAGING_FINDINGS = {
  "Рентген": [
    "Просветление легочных полей",
    "Затемнение легочных полей",
    "Инфильтрат",
    "Очаг",
    "Полость",
    "Плевральный выпот",
    "Расширение средостения",
    "Смещение органов средостения",
  ],
  "ФЛГ (флюорография)": [
    "Изменения легочных корней",
    "Затемнение",
    "Просветление",
    "Полостное образование",
    "Плевральный выпот",
    "Усиление легочного рисунка",
    "Очаговые тени",
  ],
  "КТ (без контраста)": [
    "Очаговое образование",
    "Метастазы в легкие",
    "Лимфаденопатия",
    "Плевральный выпот",
    "Деструкция костей",
    "Инфильтрация мягких тканей",
    "Атектаз",
    "Перикардиальный выпот",
  ],
  "КТ (с контрастом)": [
    "Очаговое образование",
    "Гиперваскуляризация",
    "Гиповаскуляризация",
    "Метастазы в печень",
    "Метастазы в надпочечники",
    "Метастазы в костях",
    "Поражение лимфоузлов",
    "Асцит",
    "Инвазия в соседние органы",
  ],
  "МРТ (без контраста)": [
    "Сигнал T1",
    "Сигнал T2",
    "Отек",
    "Некроз",
    "Кровоизлияние",
    "Очаговое образование",
    "Инфильтрация",
  ],
  "МРТ (с контрастом)": [
    "Накопление контраста",
    "Кольцевое накопление",
    "Центральный некроз",
    "Инвазия в соседние структуры",
    "Метастазы в кости",
    "Поражение спинного мозга",
  ],
  "УЗИ": [
    "Гипоэхогенное образование",
    "Гиперэхогенное образование",
    "Анэхогенное образование",
    "Смешанная эхогенность",
    "Увеличение лимфоузлов",
    "Асцит",
    "Свободная жидкость",
    "Васкуляризация при ДЭ",
  ],
  "ПЭТ-КТ": [
    "Повышенное накопление ФДГ",
    "Нормальное накопление ФДГ",
    "Очаги гиперметаболизма",
    "Метастазы",
    "Очаги воспаления",
  ],
  "ФГДС": [
    "Язва",
    "Полип",
    "Опухоль",
    "Стеноз",
    "Кровоточащий сосуд",
    "Варикозное расширение вен",
    "Эзофагит",
    "Гастрит",
  ],
  "Колоноскопия": [
    "Полип",
    "Опухоль",
    "Язва",
    "Стеноз",
    "Кровоточащий источник",
    "Дивертикулы",
    "Геморрой",
    "Проктит",
  ],
  "Бронхоскопия": [
    "Опухоль бронха",
    "Обструкция бронха",
    "Кровотечение",
    "Ателектаз",
    "Эндобронхиальный рост",
    "Сдавление извне",
  ],
  "Лапароскопия": [
    "Асцит",
    "Перитонеальные метастазы",
    "Поражение печени",
    "Спайки",
    "Геморрагия",
    "Воспаление",
  ],
};

export function DiagnosticsPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  const { register, getValues, reset, setValue, watch } = useForm({
    defaultValues: data.diagnostics || {}
  });

  const selectedMethods = watch("imaging_methods") || [];

  React.useEffect(() => {
    reset(data.diagnostics || {});
  }, [consultationId, data.diagnostics, reset]);

  const handleSave = () => {
    updateData('diagnostics', getValues());
  };

  const handleBlur = () => {
    handleSave();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Обследования</h2>
        <Button onClick={() => navigate('../documents')} className="gap-2">
          Далее: Документы <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <form className="space-y-6">
        {/* Laboratory */}
        <Card>
          <CardHeader>
            <CardTitle>Лабораторная диагностика</CardTitle>
            <CardDescription>Общий анализ крови, биохимия, онкомаркеры</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Гемоглобин (Hb)</Label>
                <Input {...register("lab_hb")} placeholder="г/л" onBlur={handleBlur} />
              </div>
              <div className="space-y-2">
                <Label>Лейкоциты (WBC)</Label>
                <Input {...register("lab_wbc")} placeholder="10^9/л" onBlur={handleBlur} />
              </div>
              <div className="space-y-2">
                <Label>Тромбоциты (PLT)</Label>
                <Input {...register("lab_plt")} placeholder="10^9/л" onBlur={handleBlur} />
              </div>
              <div className="space-y-2">
                <Label>СОЭ</Label>
                <Input {...register("lab_esr")} placeholder="мм/ч" onBlur={handleBlur} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Другие показатели (Биохимия, Онкомаркеры)</Label>
              <Textarea 
                {...register("lab_other")} 
                placeholder="Введите значимые отклонения..." 
                className="min-h-[100px]"
                onBlur={handleBlur}
              />
            </div>
          </CardContent>
        </Card>

        {/* Imaging */}
        <Card>
          <CardHeader>
            <CardTitle>Инструментальная диагностика</CardTitle>
            <CardDescription>КТ, МРТ, ПЭТ-КТ, УЗИ, Рентген и др.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Методы исследования</Label>
              <MultiSelect
                options={stringsToOptions(IMAGING_METHODS)}
                selected={selectedMethods}
                onChange={(newMethods) => {
                  setValue("imaging_methods", newMethods);
                  handleSave();
                }}
                placeholder="Выберите методы..."
                maxDisplayed={2}
              />
            </div>

            {selectedMethods.map((method: string) => (
              <div key={method} className="space-y-3 pt-4 border-t">
                <div className="font-semibold text-sm text-slate-700">{method}</div>
                <div className="space-y-2">
                  <Label>Типичные находки</Label>
                  <MultiSelect
                    options={stringsToOptions(
                      IMAGING_FINDINGS[method as keyof typeof IMAGING_FINDINGS] || []
                    )}
                    selected={(watch(`imaging_findings_${method}`) as string[] | undefined) || []}
                    onChange={(newFindings) => {
                      setValue(`imaging_findings_${method}`, newFindings);
                      handleSave();
                    }}
                    placeholder="Выберите находки..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Подробное описание</Label>
                  <Textarea 
                    {...register(`imaging_desc_${method}`)}
                    placeholder={`Детали исследования ${method}...`}
                    className="min-h-[80px] font-mono text-sm"
                    onBlur={handleBlur}
                  />
                </div>
              </div>
            ))}

            {selectedMethods.length === 0 && (
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                Выберите методы инструментальной диагностики, чтобы добавить находки
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <Label>Общее описание всех исследований</Label>
              <Textarea 
                {...register("imaging_desc")} 
                placeholder="Или скопируйте сюда полное заключение инструментальных исследований..." 
                className="min-h-[120px] font-mono text-sm"
                onBlur={handleBlur}
              />
            </div>
          </CardContent>
        </Card>

        {/* Biopsy/Histology */}
        <Card>
          <CardHeader>
            <CardTitle>Патоморфологическое исследование</CardTitle>
            <CardDescription>Гистология, ИГХ, Генетика</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Заключение патоморфолога</Label>
              <Textarea 
                {...register("histology_desc")} 
                placeholder="Гистологический тип опухоли, степень дифференцировки..." 
                className="min-h-[150px]"
                onBlur={handleBlur}
              />
            </div>
            <div className="space-y-2">
              <Label>Иммуногистохимия (ИГХ) и Молекулярная генетика</Label>
              <Textarea 
                {...register("ihc_desc")} 
                placeholder="ER, PR, Her2/neu, Ki67, мутации (EGFR, BRAF, KRAS)..." 
                className="min-h-[100px]"
                onBlur={handleBlur}
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
