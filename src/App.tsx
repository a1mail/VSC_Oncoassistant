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
import { ToastProvider } from '@/components/ui/toast';

export default function App() {
  return (
    <ToastProvider>
    <ConsultationProvider>
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
          </Route>
        </Routes>
      </HashRouter>
    </ConsultationProvider>
    </ToastProvider>
  );
}
