import React from 'react';
import { Button } from '@/components/ui/button';
import { useConsultation } from '@/context/ConsultationContext';
import { Copy, Printer, X } from 'lucide-react';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const sectionLabels: Record<string, Record<string, string>> = {
  anamnesis: {
    complaints: 'Жалобы',
    complaints_detail: 'Детализация жалоб',
    anamnesis_morbi: 'Anamnesis Morbi',
    heredity: 'Наследственность',
    allergies: 'Аллергический анамнез',
    smoking: 'Курение',
    alcohol: 'Алкоголь',
    comorbidities: 'Сопутствующие заболевания',
    current_medications: 'Постоянная терапия',
    occupation_desc: 'Профессиональная деятельность',
    harmful_factors: 'Вредные факторы',
    harmful_factors_desc: 'Описание вредных факторов',
  },
  exam: {
    height: 'Рост',
    weight: 'Вес',
    bmi: 'ИМТ',
    bsa: 'BSA',
    ecog: 'ECOG',
    constitution: 'Телосложение',
    mammary_right_desc: 'Правая молочная железа',
    mammary_left_desc: 'Левая молочная железа',
    mammary_lymph_nodes: 'Регионарные лимфоузлы',
    skin_description: 'Кожа и слизистые',
    lymph_description: 'Лимфоузлы',
    respiratory_description: 'Органы дыхания',
    chest_organs_description: 'Органы грудной клетки',
    cardio_description: 'Сердечно-сосудистая система',
    abdomen_description: 'Органы брюшной полости',
    musculoskeletal_description: 'Костно-мышечная система',
    endocrine_description: 'Эндокринная система',
    neuro_description: 'Неврологический статус',
  },
  diagnostics: {
    lab_hb: 'Гемоглобин',
    lab_wbc: 'Лейкоциты',
    lab_plt: 'Тромбоциты',
    lab_esr: 'СОЭ',
    lab_other: 'Прочие лабораторные показатели',
    imaging_desc: 'Инструментальная диагностика',
    histology_desc: 'Патоморфология',
    ihc_desc: 'ИГХ и молекулярная генетика',
  },
  diagnosis: {
    working_diagnosis: 'Рабочий диагноз',
    icd10: 'МКБ-10',
    tnm: 'TNM',
    reasoning: 'Обоснование',
    confidence: 'Уверенность модели',
    missing_data: 'Недостающие данные',
    is_final: 'Финальный диагноз',
  },
};

const menopauseStatusLabel: Record<string, string> = {
  premenopause: 'Пременопауза',
  perimenopause: 'Перименопауза',
  postmenopause: 'Постменопауза',
  unknown: 'Требуется уточнение',
  not_applicable: 'Неприменимо',
};

const yesNo = (value: boolean) => (value ? 'Да' : 'Нет');
const isEmpty = (value: unknown) => value === null || value === undefined || value === '';
const toText = (value: unknown): string => {
  if (isEmpty(value)) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Да' : '';
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join('; ');
  return '';
};

const safe = (value: unknown) => toText(value) || 'Не указано';
const technicalKeys = new Set(['id', 'created_at', 'updated_at']);

const formatDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleDateString('ru-RU');
};

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());

const formatPrimitive = (key: string, value: unknown) => {
  if (key === 'gender') return value === 'male' ? 'Мужской' : value === 'female' ? 'Женский' : '';
  if (key === 'birth_date' || key === 'last_menstruation_date') return formatDate(value);
  if (key === 'menopause_status' || key === 'menopause_status_manual') return menopauseStatusLabel[String(value)] || safe(value);
  if (key === 'bilateral_oophorectomy' || typeof value === 'boolean') return value ? yesNo(true) : '';
  return safe(value);
};

const shouldSkipField = (key: string, value: unknown, source: any) => {
  if (technicalKeys.has(key) || isEmpty(value)) return true;
  if (typeof value === 'boolean' && value === false) return true;
  if (key === 'menopause_mode') return true;
  if (key === 'menopause_status_manual' && String(value) === 'unknown') return true;
  if (key === 'menopause_status' && ['unknown', 'not_applicable'].includes(String(value))) return true;
  if (key === 'menopause_basis' && toText(value).toLowerCase().includes('неприменимо')) return true;
  if (source?.gender === 'male' && key.startsWith('menopause')) return true;
  return false;
};

const appendGenericSection = (parts: string[], title: string, source: any, labels: Record<string, string> = {}) => {
  if (!source || typeof source !== 'object') return;
  const lines: string[] = [];
  Object.entries(source).forEach(([key, value]) => {
    if (shouldSkipField(key, value, source)) return;
    const label = labels[key] || humanizeKey(key);
    if (Array.isArray(value)) {
      const values = value
        .map((item) => (typeof item === 'object' ? '' : safe(item)))
        .filter(Boolean);
      if (values.length === 0) return;
      lines.push(`${label}:`);
      values.forEach((item) => lines.push(`- ${item}`));
      return;
    }
    if (typeof value === 'object') return;
    const formatted = formatPrimitive(key, value);
    if (!formatted) return;
    lines.push(`${label}: ${formatted}`);
  });
  if (lines.length === 0) return;
  parts.push(title, ...lines, '');
};

const appendPatientSection = (parts: string[], patient: any) => {
  if (!patient) return;
  const lines: string[] = [];
  const pushLine = (label: string, value: string) => {
    if (!value) return;
    lines.push(`${label}: ${value}`);
  };

  pushLine('ФИО', safe(patient.full_name));
  pushLine('Дата рождения', formatDate(patient.birth_date));
  pushLine('Пол', formatPrimitive('gender', patient.gender));
  pushLine('СНИЛС', toText(patient.snils));
  pushLine('Полис ОМС', toText(patient.policy_number));
  pushLine('Контактные данные', toText(patient.contact_info));

  if (patient.gender === 'female') {
    pushLine('Дата последней менструации', formatDate(patient.last_menstruation_date));
    pushLine('Двусторонняя овариоэктомия', formatPrimitive('bilateral_oophorectomy', patient.bilateral_oophorectomy));
    pushLine('Менопаузальный статус', formatPrimitive('menopause_status', patient.menopause_status));
    if (!toText(patient.menopause_basis).toLowerCase().includes('неприменимо')) {
      pushLine('Основание менопаузального статуса', toText(patient.menopause_basis));
    }
  }

  if (lines.length === 0) return;
  parts.push('1. Паспортная часть', ...lines, '');
};

const appendExamSection = (parts: string[], exam: any) => {
  if (!exam || typeof exam !== 'object') return;
  const lines: string[] = [];
  const pushLine = (label: string, value: unknown) => {
    const text = toText(value);
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  pushLine('Рост (см)', exam.height);
  pushLine('Вес (кг)', exam.weight);
  pushLine('ИМТ', exam.bmi);
  pushLine('Площадь поверхности тела (BSA)', exam.bsa);
  pushLine('ECOG', exam.ecog);
  pushLine('Телосложение', exam.constitution);
  pushLine('Правая молочная железа', exam.mammary_right_desc);
  pushLine('Левая молочная железа', exam.mammary_left_desc);
  pushLine('Регионарные лимфоузлы', exam.mammary_lymph_nodes);
  pushLine('Кожные покровы и слизистые', exam.skin_description);
  pushLine('Лимфатические узлы', exam.lymph_description);
  pushLine('Органы дыхания', exam.respiratory_description);
  pushLine('Органы грудной клетки', exam.chest_organs_description);
  pushLine('Сердечно-сосудистая система', exam.cardio_description);
  pushLine('Органы брюшной полости', exam.abdomen_description);
  pushLine('Костно-мышечная система', exam.musculoskeletal_description);
  pushLine('Органы эндокринной системы', exam.endocrine_description);
  pushLine('Неврологический статус', exam.neuro_description);

  const rightSigns = Object.entries(exam)
    .filter(([key, value]) => key.startsWith('mammary_right_') && !key.endsWith('_desc') && typeof value === 'boolean' && value)
    .map(([key]) => key.replace('mammary_right_', '').replace(/_/g, ' '));
  const leftSigns = Object.entries(exam)
    .filter(([key, value]) => key.startsWith('mammary_left_') && !key.endsWith('_desc') && typeof value === 'boolean' && value)
    .map(([key]) => key.replace('mammary_left_', '').replace(/_/g, ' '));

  if (rightSigns.length > 0) {
    lines.push(`Правая молочная железа (признаки): ${rightSigns.join(', ')}`);
  }
  if (leftSigns.length > 0) {
    lines.push(`Левая молочная железа (признаки): ${leftSigns.join(', ')}`);
  }

  if (lines.length === 0) return;
  parts.push('3. Объективный осмотр', ...lines, '');
};

type NormalizedPrescription = { type: string; name: string; details: string };

const normalizePrescriptionItem = (item: any): NormalizedPrescription | null => {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return { type: 'Препарат', name: text, details: text };
  }
  if (!item || typeof item !== 'object') return null;

  const type = toText(item.type || item.category || item.kind || item.classification) || 'Препарат';
  const name = toText(item.name || item.drug || item.medication || item.medicine || item.title) || 'Без названия';
  const detailsParts = [
    toText(item.details || item.instructions),
    toText(item.dose || item.dosage),
    toText(item.route),
    toText(item.frequency),
    toText(item.day),
    toText(item.duration),
    toText(item.regimen),
    toText(item.note || item.notes),
  ].filter(Boolean);
  const details = detailsParts.join('; ') || name;
  return { type, name, details };
};

const normalizePrescriptions = (value: unknown): NormalizedPrescription[] => {
  if (Array.isArray(value)) {
    return value.map(normalizePrescriptionItem).filter((item): item is NormalizedPrescription => !!item);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: 'Препарат', name: line, details: line }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([name, details]) => {
        const detailsText = toText(details);
        if (!name.trim() && !detailsText) return null;
        return {
          type: 'Препарат',
          name: name.trim() || 'Без названия',
          details: detailsText || name.trim(),
        };
      })
      .filter((item): item is NormalizedPrescription => !!item);
  }
  return [];
};

const appendTreatmentSection = (parts: string[], treatment: any) => {
  if (!treatment || typeof treatment !== 'object') return;
  const lines: string[] = [];
  const pushLine = (label: string, value: unknown) => {
    const text = toText(value);
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  pushLine('Стратегия лечения', treatment.treatment_strategy);
  pushLine('Основное лечение', treatment.primary_treatment);
  pushLine('Схема', treatment.regimen);
  pushLine('Источник КР', treatment.cr_source);

  const recommendations = Array.isArray(treatment.recommendations)
    ? treatment.recommendations.map((item: unknown) => toText(item)).filter(Boolean)
    : toText(treatment.recommendations)
      ? [toText(treatment.recommendations)]
      : [];
  if (recommendations.length > 0) {
    lines.push('Рекомендации:');
    recommendations.forEach((item) => lines.push(`- ${item}`));
  }

  const warnings = Array.isArray(treatment.warnings)
    ? treatment.warnings.map((item: unknown) => toText(item)).filter(Boolean)
    : toText(treatment.warnings)
      ? [toText(treatment.warnings)]
      : [];
  if (warnings.length > 0) {
    lines.push('Клинические предостережения:');
    warnings.forEach((item) => lines.push(`- ${item}`));
  }

  if (lines.length === 0) return;
  parts.push('6. План лечения', ...lines, '');
};

const appendPrescriptionsSection = (parts: string[], treatment: any) => {
  const prescriptions = normalizePrescriptions(treatment?.prescriptions);
  if (prescriptions.length === 0) return;
  parts.push('7. Лист назначений');
  prescriptions.forEach((item, index) => {
    parts.push(`${index + 1}. ${item.type}: ${item.name}`);
    parts.push(`   Подробности: ${item.details}`);
  });
  parts.push('');
};

export function ReportDialog({ isOpen, onClose }: ReportDialogProps) {
  const { data } = useConsultation();

  const generateReport = () => {
    const parts = [
      'МЕДИЦИНСКИЙ ОТЧЕТ ПО КОНСУЛЬТАЦИИ',
      `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
      ''
    ];

    appendPatientSection(parts, data.patient);
    appendGenericSection(parts, '2. Жалобы и анамнез', data.anamnesis, sectionLabels.anamnesis);
    appendExamSection(parts, data.exam);
    appendGenericSection(parts, '4. Обследования', data.diagnostics, sectionLabels.diagnostics);
    appendGenericSection(parts, '5. Диагноз', data.diagnosis, sectionLabels.diagnosis);
    appendTreatmentSection(parts, data.treatment);
    appendPrescriptionsSection(parts, data.treatment);

    if (data.documents && Array.isArray(data.documents) && data.documents.length > 0) {
      parts.push('8. Вложенные документы');
      data.documents.forEach((doc: any, index: number) => {
        const meta = `Документ ${index + 1}: ${safe(doc.name)} | Тип: ${safe(doc.type)} | Для ИИ: ${yesNo(!!doc.includeInAnalysis)}`;
        parts.push(meta);
        if (doc.type === 'text' && typeof doc.content === 'string' && doc.content.trim()) {
          parts.push(`Фрагмент: ${doc.content.slice(0, 600)}`);
        }
      });
      parts.push('');
    }

    return parts.join('\n');
  };

  const reportText = generateReport();

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    console.log('Текст скопирован в буфер обмена');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Медицинская карта - ${data.patient?.full_name || 'Пациент'}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
              h1 { font-size: 18px; margin-bottom: 20px; }
              pre { white-space: pre-wrap; font-family: monospace; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>Медицинская карта</h1>
            <pre>${reportText}</pre>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
        // Fallback if popup blocked
        const originalContent = document.body.innerHTML;
        const printContent = document.createElement('div');
        printContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">${reportText}</pre>`;
        document.body.innerHTML = '';
        document.body.appendChild(printContent);
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); // Reload to restore state properly
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Текстовый отчет</h2>
          <p className="text-sm text-slate-500 mt-1">
            Скопируйте данные для вставки в медицинскую информационную систему
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 font-mono text-sm whitespace-pre-wrap mx-4 my-4 rounded-md border border-slate-200">
          {reportText || "Нет данных для отображения"}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" />
            Копировать весь текст
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Печать текста
          </Button>
        </div>
      </div>
    </div>
  );
}
