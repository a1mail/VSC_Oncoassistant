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
  menopause_mode: z.enum(["auto", "manual"]).optional(),
  menopause_status_manual: z.enum(["premenopause", "perimenopause", "postmenopause", "unknown"]).optional(),
  last_menstruation_date: z.string().optional(),
  bilateral_oophorectomy: z.boolean().optional(),
  menopause_status: z.string().optional(),
  menopause_basis: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const calculateMenopauseStatus = (values: Partial<PatientFormValues>) => {
  if (values.gender !== 'female') {
    return {
      status: 'not_applicable',
      basis: 'Неприменимо для мужского пола.',
    };
  }

  if (values.menopause_mode === 'manual' && values.menopause_status_manual) {
    const statusMap: Record<string, string> = {
      premenopause: 'premenopause',
      perimenopause: 'perimenopause',
      postmenopause: 'postmenopause',
      unknown: 'unknown',
    };
    const basisMap: Record<string, string> = {
      premenopause: 'Статус установлен врачом вручную: пременопауза.',
      perimenopause: 'Статус установлен врачом вручную: перименопауза.',
      postmenopause: 'Статус установлен врачом вручную: постменопауза.',
      unknown: 'Статус установлен врачом вручную: требуется уточнение.',
    };
    return {
      status: statusMap[values.menopause_status_manual] || 'unknown',
      basis: basisMap[values.menopause_status_manual] || 'Статус установлен врачом вручную.',
    };
  }

  if (values.bilateral_oophorectomy) {
    return {
      status: 'postmenopause',
      basis: 'Авторасчет: двусторонняя овариоэктомия.',
    };
  }

  const age = calculateAge(values.birth_date);
  if (age !== null && age >= 60) {
    return {
      status: 'postmenopause',
      basis: 'Авторасчет: возраст ≥ 60 лет.',
    };
  }

  if (!values.last_menstruation_date) {
    return {
      status: 'unknown',
      basis: 'Авторасчет: нет даты последней менструации для оценки аменореи.',
    };
  }

  const lastMenstruation = new Date(values.last_menstruation_date);
  if (Number.isNaN(lastMenstruation.getTime())) {
    return {
      status: 'unknown',
      basis: 'Авторасчет: некорректная дата последней менструации.',
    };
  }

  const now = new Date();
  const monthsSinceLastMenstruation =
    (now.getFullYear() - lastMenstruation.getFullYear()) * 12 +
    (now.getMonth() - lastMenstruation.getMonth());

  if (monthsSinceLastMenstruation >= 12 && age !== null && age >= 45) {
    return {
      status: 'postmenopause',
      basis: 'Авторасчет: аменорея ≥ 12 месяцев при возрасте ≥ 45 лет.',
    };
  }

  if (monthsSinceLastMenstruation >= 6) {
    return {
      status: 'perimenopause',
      basis: 'Авторасчет: аменорея 6–11 месяцев (перименопауза).',
    };
  }

  return {
    status: 'premenopause',
    basis: 'Авторасчет: критерии постменопаузы не выполнены.',
  };
};

const menopauseStatusLabel: Record<string, string> = {
  premenopause: 'Пременопауза',
  perimenopause: 'Перименопауза',
  postmenopause: 'Постменопауза',
  unknown: 'Требуется уточнение',
  not_applicable: 'Неприменимо',
};

const emptyPatient: PatientFormValues = {
  full_name: '',
  birth_date: '',
  gender: undefined as unknown as 'male' | 'female',
  snils: '',
  policy_number: '',
  contact_info: '',
  menopause_mode: 'auto',
  menopause_status_manual: 'unknown',
  last_menstruation_date: '',
  bilateral_oophorectomy: false,
  menopause_status: '',
  menopause_basis: '',
};

const normalizePatientValues = (source?: any): PatientFormValues => ({
  ...emptyPatient,
  ...(source || {}),
  bilateral_oophorectomy: !!source?.bilateral_oophorectomy,
});

export function PatientPage() {
  const { updateData, data, consultationId } = useConsultation();
  const navigate = useNavigate();
  
  const { register, getValues, reset, formState: { errors }, setValue, watch } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: normalizePatientValues(data.patient),
  });

  const gender = watch("gender");
  const birthDate = watch("birth_date");
  const menopauseMode = watch("menopause_mode");
  const lastMenstruationDate = watch("last_menstruation_date");
  const bilateralOophorectomy = watch("bilateral_oophorectomy");
  const menopauseStatusManual = watch("menopause_status_manual");

  // Sync from context to form only when consultationId changes (reset)
  useEffect(() => {
    reset(normalizePatientValues(data.patient));
  }, [consultationId, data.patient, reset]);

  const handleSave = () => {
    const values = normalizePatientValues(getValues());
    updateData('patient', values);
  };

  const handleBlur = () => {
    handleSave();
  };

  useEffect(() => {
    const values = normalizePatientValues(getValues());
    const calculated = calculateMenopauseStatus(values);
    setValue("menopause_status", calculated.status, { shouldDirty: false });
    setValue("menopause_basis", calculated.basis, { shouldDirty: false });
    updateData('patient', {
      ...values,
      menopause_status: calculated.status,
      menopause_basis: calculated.basis,
    });
  }, [
    gender,
    birthDate,
    menopauseMode,
    lastMenstruationDate,
    bilateralOophorectomy,
    menopauseStatusManual,
    getValues,
    setValue,
    updateData,
  ]);

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
        <Button onClick={() => navigate('../anamnesis')} className="gap-2">
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

            {gender === "female" && (
              <div className="pt-4 border-t space-y-4">
                <h3 className="text-lg font-semibold">Менопаузальный статус</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Режим определения</Label>
                    <select
                      className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      {...register("menopause_mode")}
                      onChange={handleBlur}
                    >
                      <option value="auto">Автоматический расчет (по КР РМЖ)</option>
                      <option value="manual">Ручной выбор врачом</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_menstruation_date">Дата последней менструации</Label>
                    <Input
                      id="last_menstruation_date"
                      type="date"
                      {...register("last_menstruation_date")}
                      onBlur={handleBlur}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="block">Двусторонняя овариоэктомия</Label>
                    <label className="flex items-center gap-2 cursor-pointer h-10">
                      <input
                        type="checkbox"
                        {...register("bilateral_oophorectomy")}
                        onChange={handleBlur}
                        className="w-4 h-4 text-blue-600"
                      />
                      Да
                    </label>
                  </div>

                  {menopauseMode === "manual" && (
                    <div className="space-y-2">
                      <Label>Ручной статус</Label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        {...register("menopause_status_manual")}
                        onChange={handleBlur}
                      >
                        <option value="premenopause">Пременопауза</option>
                        <option value="perimenopause">Перименопауза</option>
                        <option value="postmenopause">Постменопауза</option>
                        <option value="unknown">Требуется уточнение</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label>Итоговый статус</Label>
                    <Input
                      value={menopauseStatusLabel[watch("menopause_status") || "unknown"] || menopauseStatusLabel.unknown}
                      readOnly
                      className="bg-slate-100"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Основание расчета</Label>
                    <Input
                      value={watch("menopause_basis") || ""}
                      readOnly
                      className="bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
