import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConsultation } from '@/context/ConsultationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const COMPLAINT_CATEGORIES = {
  "Общие": ["Общая слабость", "Потеря веса", "Повышение температуры", "Потливость", "Снижение аппетита", "Нарушение сна", "Отеки"],
  "Дыхательная система": ["Кашель", "Одышка", "Кровохарканье", "Боли в грудной клетке", "Осиплость голоса", "Чувство нехватки воздуха"],
  "Пищеварительная система": ["Тошнота", "Рвота", "Нарушение глотания (дисфагия)", "Боли в животе", "Нарушение стула (запор/диарея)", "Примесь крови в стуле", "Изжога", "Вздутие живота"],
  "Мочеполовая система": ["Нарушение мочеиспускания", "Примесь крови в моче", "Боли в пояснице", "Выделения из половых путей", "Учащенное мочеиспускание"],
  "Кожа и мягкие ткани": ["Наличие опухолевидного образования", "Изменение цвета кожи", "Зуд", "Изъязвление", "Увеличение лимфоузлов", "Появление родинок"],
  "Неврология": ["Головная боль", "Головокружение", "Нарушение чувствительности", "Слабость в конечностях", "Судороги", "Нарушение зрения"]
};

const HARMFUL_FACTORS = [
  "Ионизирующее излучение (радиация)",
  "Химическое производство (бензол, винилхлорид и др.)",
  "Асбест",
  "Нефтепродукты и продукты сгорания",
  "Тяжелые металлы (свинец, ртуть)",
  "Работа в ночные смены",
  "Длительный стаж курения",
  "Пестициды и гербициды"
];

export function AnamnesisPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  const { register, watch, setValue, getValues, reset } = useForm({
    defaultValues: data.anamnesis || { complaints: [], harmful_factors: [] }
  });
  const selectedComplaints = watch("complaints") || [];

  useEffect(() => {
    reset(data.anamnesis || { complaints: [], harmful_factors: [] });
  }, [consultationId, reset]);

  const handleSave = () => {
    updateData('anamnesis', getValues());
  };

  const toggleComplaint = (complaint: string) => {
    const current = getValues("complaints") || [];
    let newComplaints;
    if (current.includes(complaint)) {
      newComplaints = current.filter((c: string) => c !== complaint);
    } else {
      newComplaints = [...current, complaint];
    }
    setValue("complaints", newComplaints);
    handleSave();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Анамнез</h2>
        <Button onClick={() => navigate('/exam')} className="gap-2">
          Далее: Осмотр <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <form className="space-y-6">
        {/* Complaints */}
        <Card>
          <CardHeader>
            <CardTitle>Жалобы</CardTitle>
            <CardDescription>Выберите из списка или добавьте свои. Изменения сохраняются автоматически.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {Object.entries(COMPLAINT_CATEGORIES).map(([category, complaints]) => (
                <div key={category}>
                  <h4 className="font-semibold text-sm text-slate-500 mb-2">{category}</h4>
                  <div className="flex flex-wrap gap-2">
                    {complaints.map((complaint) => (
                      <button
                        key={complaint}
                        type="button"
                        onClick={() => toggleComplaint(complaint)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                          selectedComplaints.includes(complaint)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                        )}
                      >
                        {complaint}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Детализация жалоб</Label>
              <Textarea 
                placeholder="Опишите подробнее характер жалоб..." 
                className="min-h-[100px]"
                {...register("complaints_detail")}
                onBlur={handleSave}
              />
            </div>
          </CardContent>
        </Card>

        {/* Anamnesis Morbi */}
        <Card>
          <CardHeader>
            <CardTitle>История заболевания (Anamnesis Morbi)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Когда появились первые симптомы? Как развивалось заболевание? Какие обследования уже проводились?" 
              className="min-h-[150px]"
              {...register("anamnesis_morbi")}
              onBlur={handleSave}
            />
          </CardContent>
        </Card>

        {/* Anamnesis Vitae */}
        <Card>
          <CardHeader>
            <CardTitle>История жизни (Anamnesis Vitae)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Наследственность (онкология у родственников)</Label>
                <Textarea 
                  {...register("heredity")} 
                  placeholder="У кого из родственников были онкозаболевания?" 
                  onBlur={handleSave}
                />
              </div>
              <div className="space-y-2">
                <Label>Аллергический анамнез</Label>
                <Textarea 
                  {...register("allergies")} 
                  placeholder="Аллергия на лекарства, продукты..." 
                  onBlur={handleSave}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Вредные привычки</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    {...register("smoking")} 
                    onChange={() => handleSave()}
                    className="w-4 h-4 rounded border-slate-300" 
                  />
                  Курение
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    {...register("alcohol")} 
                    onChange={() => handleSave()}
                    className="w-4 h-4 rounded border-slate-300" 
                  />
                  Алкоголь
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comorbidities */}
        <Card>
          <CardHeader>
            <CardTitle>Сопутствующие заболевания</CardTitle>
            <CardDescription>Укажите хронические заболевания и другие состояния.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Например: Гипертоническая болезнь II ст., Сахарный диабет 2 типа..." 
              className="min-h-[100px]"
              {...register("comorbidities")}
              onBlur={handleSave}
            />
          </CardContent>
        </Card>

        {/* Current Medications */}
        <Card>
          <CardHeader>
            <CardTitle>Принимаемые препараты</CardTitle>
            <CardDescription>Перечислите препараты, которые пациент принимает постоянно.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Например: Эналаприл 10 мг утром, Метформин 500 мг..." 
              className="min-h-[100px]"
              {...register("current_medications")}
              onBlur={handleSave}
            />
          </CardContent>
        </Card>

        {/* Occupational Anamnesis */}
        <Card>
          <CardHeader>
            <CardTitle>Трудовой анамнез и Вредные факторы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Профессиональная деятельность</Label>
              <Textarea 
                {...register("occupation_desc")} 
                placeholder="Кем и где работал пациент, стаж..." 
                onBlur={handleSave}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Воздействие вредных факторов</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {HARMFUL_FACTORS.map((factor) => (
                  <label key={factor} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      {...register("harmful_factors")} 
                      value={factor} 
                      onChange={() => handleSave()}
                      className="w-4 h-4 rounded border-slate-300" 
                    />
                    {factor}
                  </label>
                ))}
              </div>
              <Textarea 
                {...register("harmful_factors_desc")} 
                placeholder="Дополнительные сведения о вредностях..." 
                className="mt-2" 
                onBlur={handleSave}
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
