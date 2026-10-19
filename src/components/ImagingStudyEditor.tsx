import { useConsultation } from '@/context/ConsultationContext';
import type { ImagingStudy } from '@/lib/types/consultation';
import { chronological } from '@/lib/clinicalHistory';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/** Store each investigation independently so repeated methods retain their dates and clinical dynamics. */
export function ImagingStudyEditor({ methods }: { methods: string[] }) {
  const { data, updateData } = useConsultation();
  const studies = data.diagnostics?.imaging_studies || [];
  const save = (imaging_studies: ImagingStudy[]) => updateData('diagnostics', { ...data.diagnostics, imaging_studies });
  const handleAdd = (method: string) => save([...studies, {
    id: crypto.randomUUID(), method, date: '', region: '', description: '', findings: [],
  }]);
  const handleChange = (id: string, field: 'date' | 'region' | 'description', value: string) =>
    save(studies.map((study) => study.id === id ? { ...study, [field]: value } : study));
  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="font-semibold">Повторные обследования и динамика</h3>
      <p className="text-sm text-slate-500">Исходные результаты выше сохраняются. Добавляйте отдельную запись для каждого повторного исследования; неизвестную дату оставьте пустой.</p>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => <Button key={method} type="button" variant="outline" onClick={() => handleAdd(method)}>Добавить {method}</Button>)}
      </div>
      {chronological(studies).map((study) => (
        <div key={study.id} className="space-y-3 rounded-lg border p-4">
          <h4 className="font-semibold">{study.method}</h4>
          <label className="block text-sm">Дата исследования
            <Input type="date" value={study.date} onChange={(event) => handleChange(study.id, 'date', event.target.value)} />
          </label>
          <label className="block text-sm">Область исследования
            <Input value={study.region} onChange={(event) => handleChange(study.id, 'region', event.target.value)} />
          </label>
          <label className="block text-sm">Результат / заключение (размеры, показатели и единицы)
            <Textarea value={study.description} onChange={(event) => handleChange(study.id, 'description', event.target.value)} />
          </label>
          <Button type="button" variant="outline" onClick={() => {
            if (confirm('Удалить исследование?')) save(studies.filter((item) => item.id !== study.id));
          }}>Удалить исследование</Button>
        </div>
      ))}
    </div>
  );
}
