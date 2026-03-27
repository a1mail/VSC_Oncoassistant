import React from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Printer, AlertCircle } from 'lucide-react';

type NormalizedPrescription = {
  type: string;
  name: string;
  details: string;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join('; ');
  }
  return '';
};

const normalizePrescriptionItem = (item: any): NormalizedPrescription | null => {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return { type: 'Препарат', name: text, details: text };
  }

  if (!item || typeof item !== 'object') return null;

  const type = toText(item.type || item.category || item.kind || item.classification) || 'Препарат';
  const name =
    toText(item.name || item.drug || item.medication || item.medicine || item.title) || 'Без названия';
  const details = toText(
    item.details ||
      item.instructions ||
      item.dosage ||
      item.dose ||
      item.regimen ||
      item.route ||
      item.frequency ||
      item.duration ||
      item.note
  );

  if (!type && !name && !details) return null;
  return { type, name, details: details || name };
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
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
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

export function PrescriptionsPage() {
  const { data } = useConsultation();
  const treatment = data.treatment;
  const prescriptions = normalizePrescriptions(treatment?.prescriptions);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Лист назначений - ${data.patient?.full_name || 'Пациент'}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 24px; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .patient-info { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f2f2f2; }
              .type-badge { font-size: 0.8em; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #3730a3; }
              .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Лист назначений</h1>
            
            <div class="patient-info">
              <div><strong>Пациент:</strong> ${data.patient?.full_name || 'Не указано'}</div>
              <div><strong>Дата рождения:</strong> ${data.patient?.birth_date ? new Date(data.patient.birth_date).toLocaleDateString('ru-RU') : 'Не указано'}</div>
              <div><strong>Диагноз:</strong> ${data.diagnosis?.working_diagnosis || 'Не указан'}</div>
            </div>

            ${prescriptions.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Наименование</th>
                    <th>Подробности (Доза, режим, путь введения)</th>
                  </tr>
                </thead>
                <tbody>
                  ${prescriptions.map((p: NormalizedPrescription) => `
                    <tr>
                      <td><span class="type-badge">${p.type}</span></td>
                      <td><strong>${p.name}</strong></td>
                      <td>${p.details}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>Нет сформированных назначений. Перейдите на вкладку "Лечение" и сформируйте план.</p>'}

            <div class="footer">
              Врач: ________________________ / ________________________ <br><br>
              Дата: ${new Date().toLocaleDateString('ru-RU')}
            </div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (!treatment) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mb-4 opacity-20" />
          <p>План лечения еще не сформирован.</p>
          <p className="text-sm mt-2">Перейдите на вкладку "Лечение" и нажмите "Сформировать план лечения".</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-3xl font-bold tracking-tight">Лист назначений</h2>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Печать листа назначений
        </Button>
      </div>

      {prescriptions.length === 0 ? (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="flex items-center gap-4 py-6 text-amber-800">
            <AlertCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">Детальные назначения отсутствуют</p>
              <p className="text-sm">Попробуйте обновить план лечения на вкладке "Лечение", чтобы ИИ сгенерировал список препаратов.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Назначения</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-6 py-3">Тип</th>
                    <th className="px-6 py-3">Наименование</th>
                    <th className="px-6 py-3">Подробности</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((item: NormalizedPrescription, index: number) => (
                    <tr key={index} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
