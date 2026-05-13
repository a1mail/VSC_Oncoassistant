import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, stringsToOptions } from '@/components/ui/multi-select';
import { useConsultation } from '@/context/ConsultationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const SYSTEMS = [
  { id: 'skin', label: 'Кожные покровы и слизистые' },
  { id: 'lymph', label: 'Лимфатические узлы' },
  { id: 'respiratory', label: 'Органы дыхания' },
  { id: 'chest_organs', label: 'Органы грудной клетки' },
  { id: 'cardio', label: 'Сердечно-сосудистая система' },
  { id: 'abdomen', label: 'Органы брюшной полости' },
  { id: 'musculoskeletal', label: 'Костно-мышечная система' },
  { id: 'endocrine', label: 'Органы эндокринной системы' },
  { id: 'neuro', label: 'Неврологический статус' },
];

const MAMMARY_SIGNS = [
  "Уплотнение", "Втяжение соска", "Выделения из соска",
  "Гиперемия кожи", "Отек (симптом лимонной корки)",
  "Изъязвление", "Деформация", "Асимметрия"
];

const SYSTEM_FINDINGS = {
  skin: ["Бледность", "Желтушность", "Цианоз", "Петехии", "Гиперпигментация", "Гипопигментация", "Отечность", "Сухость кожи", "Сыпь", "Изъязвления"],
  lymph: ["Увеличены шейные", "Увеличены подмышечные", "Увеличены паховые", "Увеличены надключичные", "Плотные", "Безболезненные", "Спаяны с кожей", "Спаяны между собой"],
  respiratory: ["Ослабление дыхания", "Жесткое дыхание", "Хрипы", "Притупление перкуторного звука", "Коробочный звук", "Тимпанит", "Асимметрия дыхания", "Шум трения плевры"],
  chest_organs: ["Тахикардия", "Брадикардия", "Аритмия", "Глухость тонов", "Шумы", "Акцент II тона", "Галоп", "Отеки нижних конечностей", "Асцит"],
  cardio: ["Измененная конфигурация сердца", "Смещение верхушечного толчка", "Расширение границ тупости", "Расширение сосудов шеи", "Отеки", "Потеря пульса"],
  abdomen: ["Напряжение мышц", "Защитное напряжение", "Асимметрия", "Видимая перистальтика", "Видимые вены", "Рубцы", "Грыжи", "Увеличение печени", "Увеличение селезенки", "Пальпируемые массы"],
  musculoskeletal: ["Деформация суставов", "Ограничение подвижности", "Припухлость суставов", "Триггер-пойнты", "Мышечная слабость", "Атрофия мышц", "Спастичность", "Параличи"],
  endocrine: ["Увеличение щитовидной железы", "Узлы щитовидной железы", "Птоз", "Экзофтальм", "Гинекомастия", " Amaranthus"],
  neuro: ["Нарушение сознания", "Ригидность затылочных мышц", "Симптом Кернига", "Симптом Бруджинского", "Асимметрия рефлексов", "Гиперрефлексия", "Гипорефлексия", "Патологические рефлексы", "Нарушение мышечного тонуса"],
};

export function ExamPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  const { register, setValue, reset, watch, getValues } = useForm({
    defaultValues: data.exam || {}
  });

  const height = watch('height');
  const weight = watch('weight');

  const handleSave = useCallback(() => {
    updateData('exam', getValues());
  }, [getValues, updateData]);

  useEffect(() => {
    reset(data.exam || {});
  }, [consultationId, data.exam, reset]);

  useEffect(() => {
    if (height && weight) {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (!isNaN(h) && !isNaN(w) && h > 0) {
        const bmi = (w / ((h / 100) ** 2)).toFixed(2);
        const bsa = (0.007184 * (w ** 0.425) * (h ** 0.725)).toFixed(2);
        setValue('bmi', bmi);
        setValue('bsa', bsa);
        handleSave(); // Auto-save calculated values
      }
    }
  }, [height, weight, setValue, handleSave]);

  const handleBlur = () => {
    handleSave();
  };

  const registerCheckbox = (fieldName: string) => {
    const { onChange, ...field } = register(fieldName);

    return {
      ...field,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event);
        handleSave();
      },
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Физикальный осмотр</h2>
        <Button onClick={() => navigate('../diagnostics')} className="gap-2">
          Далее: Обследования <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <form className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Антропометрия и Общее состояние</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Рост (см)</Label>
                <Input 
                  type="number" 
                  {...register("height")} 
                  placeholder="см" 
                  onBlur={handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label>Вес (кг)</Label>
                <Input 
                  type="number" 
                  {...register("weight")} 
                  placeholder="кг" 
                  onBlur={handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label>ИМТ (кг/м²)</Label>
                <Input {...register("bmi")} readOnly className="bg-slate-100" />
              </div>
              <div className="space-y-2">
                <Label>BSA (м²)</Label>
                <Input {...register("bsa")} readOnly className="bg-slate-100" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-2">
                <Label>Общее состояние (ECOG)</Label>
                <Select 
                  onValueChange={(val) => {
                    setValue("ecog", val);
                    handleSave();
                  }} 
                  defaultValue={data.exam?.ecog}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус ECOG" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Активен, способен к нормальной деятельности</SelectItem>
                    <SelectItem value="1">1 - Ограничен в физических нагрузках</SelectItem>
                    <SelectItem value="2">2 - Способен к самообслуживанию, но не к работе</SelectItem>
                    <SelectItem value="3">3 - Ограниченная способность к самообслуживанию</SelectItem>
                    <SelectItem value="4">4 - Полная инвалидность</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Телосложение</Label>
                <Select 
                  onValueChange={(val) => {
                    setValue("constitution", val);
                    handleSave();
                  }} 
                  defaultValue={data.exam?.constitution}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normosthenic">Нормостеническое</SelectItem>
                    <SelectItem value="asthenic">Астеническое</SelectItem>
                    <SelectItem value="hypersthenic">Гиперстеническое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Молочные железы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold">Правая молочная железа</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MAMMARY_SIGNS.map((sign) => (
                    <label key={`right_${sign}`} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="checkbox" 
                        {...registerCheckbox(`mammary_right_${sign}`)}
                        className="w-4 h-4 rounded border-slate-300" 
                      />
                      {sign}
                    </label>
                  ))}
                </div>
                <Textarea 
                  {...register("mammary_right_desc")} 
                  placeholder="Дополнительное описание (локализация, размер)..." 
                  className="mt-2" 
                  onBlur={handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Левая молочная железа</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MAMMARY_SIGNS.map((sign) => (
                    <label key={`left_${sign}`} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="checkbox" 
                        {...registerCheckbox(`mammary_left_${sign}`)}
                        className="w-4 h-4 rounded border-slate-300" 
                      />
                      {sign}
                    </label>
                  ))}
                </div>
                <Textarea 
                  {...register("mammary_left_desc")} 
                  placeholder="Дополнительное описание (локализация, размер)..." 
                  className="mt-2" 
                  onBlur={handleBlur}
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <Label>Регионарные лимфоузлы</Label>
              <Textarea 
                {...register("mammary_lymph_nodes")} 
                placeholder="Подмышечные, над/подключичные..." 
                className="mt-2" 
                onBlur={handleBlur}
              />
            </div>
          </CardContent>
        </Card>

        {SYSTEMS.map((system) => {
          const selectedFindings = (watch(`${system.id}_findings`) as string[] | undefined) || [];
          return (
            <Card key={system.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{system.label}</CardTitle>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      {...registerCheckbox(`${system.id}_norm`)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    Без патологии
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Типичные находки</Label>
                  <MultiSelect
                    options={stringsToOptions(SYSTEM_FINDINGS[system.id as keyof typeof SYSTEM_FINDINGS] || [])}
                    selected={selectedFindings}
                    onChange={(newSelected) => {
                      setValue(`${system.id}_findings`, newSelected);
                      handleSave();
                    }}
                    placeholder="Выберите находки..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Подробное описание</Label>
                  <Textarea 
                    {...register(`${system.id}_description`)}
                    placeholder={`Описание (${system.label.toLowerCase()})...`}
                    className="min-h-[80px]"
                    onBlur={handleBlur}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </form>
    </div>
  );
}
