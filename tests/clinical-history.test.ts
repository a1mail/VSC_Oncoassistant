import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('report projects a brief history instead of full historical records', () => {
  assert.match(source('src/components/ReportDialog.tsx'), /formatClinicalHistory/);
});

test('diagnostics supports repeated dated studies', () => {
  assert.match(source('src/pages/DiagnosticsPage.tsx'), /ImagingStudyEditor/);
});

test('both AI flows receive the active clinical context', () => {
  for (const page of ['DiagnosisPage', 'TreatmentPage']) {
    assert.match(source(`src/pages/${page}.tsx`), /buildClinicalContext/);
  }
});

test('documents supports a dedicated paste editor without removing uploads', () => {
  const documents = source('src/pages/DocumentsPage.tsx');
  assert.match(documents, /PastedDocumentsEditor/);
  assert.match(documents, /handleFileUpload/);
});

test('exam allows bilateral breast description and free findings', () => {
  const exam = source('src/pages/ExamPage.tsx');
  assert.match(exam, /mammary_mode/);
  assert.match(exam, /additional_findings/);
});

test('life history has a free clinical information field', () => {
  assert.match(source('src/pages/AnamnesisPage.tsx'), /vitae_additional/);
});
