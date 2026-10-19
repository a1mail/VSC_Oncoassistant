import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { PatientPage } from '@/pages/PatientPage';
import { AnamnesisPage } from '@/pages/AnamnesisPage';
import { ExamPage } from '@/pages/ExamPage';
import { DiagnosticsPage } from '@/pages/DiagnosticsPage';
import { DiagnosisPage } from '@/pages/DiagnosisPage';
import { TreatmentPage } from '@/pages/TreatmentPage';
import { PrescriptionsPage } from '@/pages/PrescriptionsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { ConsultationProvider } from '@/context/ConsultationContext';
import { StandaloneStorageBanner } from '@/components/StandaloneStorageBanner';
import { ToastProvider } from '@/components/ui/toast';

export default function App() {
  const [ended, setEnded] = React.useState(false);
  React.useEffect(() => {
    const handleEnded = () => setEnded(true);
    window.addEventListener('onco-session-ended', handleEnded);
    return () => window.removeEventListener('onco-session-ended', handleEnded);
  }, []);
  if (ended) {
    return <div className="p-12 space-y-4">
      <h1 className="text-2xl font-bold">Сеанс завершен</h1>
      <p>Данные приложения в памяти очищены. Закройте вкладку браузера и извлеките флешку.</p>
      <p>История браузера, буфер обмена и следы операционной системы не контролируются приложением.</p>
    </div>;
  }
  return (
    <ToastProvider>
    <ConsultationProvider>
      <StandaloneStorageBanner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="patient" replace />} />
            <Route path="patient" element={<PatientPage />} />
            <Route path="anamnesis" element={<AnamnesisPage />} />
            <Route path="exam" element={<ExamPage />} />
            <Route path="diagnostics" element={<DiagnosticsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="diagnosis" element={<DiagnosisPage />} />
            <Route path="treatment" element={<TreatmentPage />} />
            <Route path="prescriptions" element={<PrescriptionsPage />} />
            <Route path="*" element={<Navigate to="patient" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConsultationProvider>
    </ToastProvider>
  );
}
