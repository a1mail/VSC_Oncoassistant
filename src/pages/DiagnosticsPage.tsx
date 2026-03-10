import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConsultation } from '@/context/ConsultationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function DiagnosticsPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  const { register, getValues, reset } = useForm({
    defaultValues: data.diagnostics || {}
  });

  React.useEffect(() => {
    reset(data.diagnostics || {});
  }, [consultationId, reset]);

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
        <Button onClick={() => navigate('/documents')} className="gap-2">
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
            <CardDescription>КТ, МРТ, ПЭТ-КТ, УЗИ, Рентген</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Описание исследований</Label>
              <Textarea 
                {...register("imaging_desc")} 
                placeholder="Скопируйте сюда заключения инструментальных исследований..." 
                className="min-h-[200px] font-mono text-sm"
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
