import React from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Printer, AlertCircle } from 'lucide-react';
import { normalizePrescriptions, type NormalizedPrescription } from '@/lib/prescriptions';
import { esc, openPrintWindow, buildPatientInfoBlock } from '@/lib/htmlUtils';

export function PrescriptionsPage() {
  const { data } = useConsultation();
  const treatment = data.treatment;
  const prescriptions = normalizePrescriptions(treatment?.prescriptions);

  const handlePrint = () => {
    const diagnosisLine = `<div><strong>Диагноз:</strong> ${esc(data.diagnosis?.working_diagnosis || 'Не указан')}</div>`;
    const tableHtml = prescriptions.length > 0
      ? `<table><thead><tr><th>Тип</th><th>Наименование</th><th>Подробности (Доза, режим, путь введения)</th></tr></thead><tbody>${prescriptions.map((p: NormalizedPrescription) => `<tr><td><span class="type-badge">${esc(p.type)}</span></td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.details)}</td></tr>`).join('')}</tbody></table>`
      : '<p>Нет сформированных назначений. Перейдите на вкладку &quot;Лечение&quot; и сформируйте план.</p>';

    openPrintWindow({
      title: `Лист назначений - ${data.patient?.full_name || 'Пациент'}`,
      extraCss: `
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .type-badge { font-size: 0.8em; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #3730a3; }
      `,
      bodyHtml: `
        <h1>Лист назначений</h1>
        ${buildPatientInfoBlock(data.patient)}
        ${diagnosisLine}
        ${tableHtml}
        <div class="footer">
          Врач: ________________________ / ________________________ <br><br>
          Дата: ${esc(new Date().toLocaleDateString('ru-RU'))}
        </div>`,
    });
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
