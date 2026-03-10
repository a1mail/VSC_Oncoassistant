import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useConsultation } from '@/context/ConsultationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const patientSchema = z.object({
  full_name: z.string().min(2, "ФИО должно быть длиннее 2 символов"),
  birth_date: z.string().min(1, "Дата рождения обязательна"),
  gender: z.enum(["male", "female"], { message: "Выберите пол" }),
  snils: z.string().optional(),
  policy_number: z.string().optional(),
  contact_info: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export function PatientPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  
  const { register, getValues, reset, formState: { errors }, setValue, watch } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: data.patient || {
      full_name: '',
      birth_date: '',
      gender: undefined,
      snils: '',
      policy_number: '',
      contact_info: ''
    }
  });

  const gender = watch("gender");

  // Sync from context to form only when consultationId changes (reset)
  useEffect(() => {
    // Always reset if data.patient changes (including when it becomes undefined/null on reset)
    reset(data.patient || {
      full_name: '',
      birth_date: '',
      gender: undefined,
      snils: '',
      policy_number: '',
      contact_info: ''
    });
  }, [consultationId, reset]);

  const handleSave = () => {
    const values = getValues();
    updateData('patient', values);
  };

  const handleBlur = () => {
    handleSave();
  };

  // Custom handler for radio buttons to ensure both RHF and our auto-save work
  const handleGenderChange = (value: "male" | "female") => {
    setValue("gender", value, { shouldValidate: true, shouldDirty: true });
    // Small delay to ensure state is updated before saving
    setTimeout(() => {
      handleSave();
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Паспортная часть</h2>
        <Button onClick={() => navigate('/anamnesis')} className="gap-2">
          Далее: Анамнез <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Данные пациента</CardTitle>
          <CardDescription>
            Введите основные данные пациента. Изменения сохраняются автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">ФИО</Label>
                <Input 
                  id="full_name" 
                  placeholder="Иванов Иван Иванович" 
                  {...register("full_name")} 
                  onBlur={handleBlur}
                />
                {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date">Дата рождения</Label>
                <Input 
                  id="birth_date" 
                  type="date" 
                  {...register("birth_date")} 
                  onBlur={handleBlur}
                />
                {errors.birth_date && <p className="text-sm text-red-500">{errors.birth_date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Пол</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="male" 
                      checked={gender === "male"}
                      onChange={() => handleGenderChange("male")}
                      className="w-4 h-4 text-blue-600" 
                    />
                    Мужской
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="female" 
                      checked={gender === "female"}
                      onChange={() => handleGenderChange("female")}
                      className="w-4 h-4 text-blue-600" 
                    />
                    Женский
                  </label>
                </div>
                {errors.gender && <p className="text-sm text-red-500">{errors.gender.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="snils">СНИЛС</Label>
                <Input 
                  id="snils" 
                  placeholder="000-000-000 00" 
                  {...register("snils")} 
                  onBlur={handleBlur}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy_number">Полис ОМС</Label>
                <Input 
                  id="policy_number" 
                  placeholder="0000 0000 0000 0000" 
                  {...register("policy_number")} 
                  onBlur={handleBlur}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_info">Контакты</Label>
                <Input 
                  id="contact_info" 
                  placeholder="Телефон, адрес" 
                  {...register("contact_info")} 
                  onBlur={handleBlur}
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
