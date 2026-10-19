import { useConsultation } from '@/context/ConsultationContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { ClinicalHistoryEntry } from '@/lib/types/consultation';

const fields: Array<[keyof Omit<ClinicalHistoryEntry, 'id' | 'date'>, string]> = [
  ['full_text', 'Полный текст предыдущего осмотра (контекст ИИ)'],
  ['summary', 'Краткое резюме для отчета'],
  ['diagnosis', 'Диагноз'],
  ['prescribed_treatment', 'Назначенное лечение'],
  ['performed_treatment', 'Фактически проведенное лечение'],
];

/** Separate raw records from editable report summaries without discarding clinical evidence. */
export function ClinicalHistoryEditor() {
  const { data, updateData } = useConsultation();
  const entries = data.anamnesis?.history || [];
  const save = (history: ClinicalHistoryEntry[]) => updateData('anamnesis', { ...data.anamnesis, history });
  const handleAdd = () => save([...entries, {
    id: crypto.randomUUID(), date: '', full_text: '', summary: '', diagnosis: '',
    prescribed_treatment: '', performed_treatment: '',
  }]);
  const handleChange = (id: string, field: keyof ClinicalHistoryEntry, value: string) =>
    save(entries.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry));
  return (
    <Card>
      <CardHeader><CardTitle>Предыдущие осмотры и история заболевания</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">Полный текст передается ИИ. В отчет входит дата и проверенное вами краткое резюме, диагноз и лечение.</p>
        {entries.map((entry, index) => (
          <div key={entry.id} className="space-y-3 border rounded-lg p-4">
            <label className="block text-sm">Дата осмотра {index + 1}
              <Input type="date" value={entry.date} onChange={(event) => handleChange(entry.id, 'date', event.target.value)} />
            </label>
            {fields.map(([field, label]) => (
              <label key={field} className="block text-sm">{label}
                <Textarea value={entry[field]} onChange={(event) => handleChange(entry.id, field, event.target.value)} />
              </label>
            ))}
            <Button type="button" variant="outline" onClick={() => {
              if (confirm('Удалить запись предыдущего осмотра?')) save(entries.filter((item) => item.id !== entry.id));
            }}>Удалить осмотр</Button>
          </div>
        ))}
        <Button type="button" onClick={handleAdd}>Добавить предыдущий осмотр</Button>
      </CardContent>
    </Card>
  );
}
