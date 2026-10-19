import assert from 'node:assert/strict';
import test from 'node:test';
import { activeExam, buildClinicalContext, chronological, formatClinicalHistory, getImagingStudies, validatePastedDocument } from '../src/lib/clinicalHistory';
import { serializeEmbeddedJson } from '../src/lib/embeddedHtmlState';

test('brief report excludes raw historical details but keeps treatment distinction', () => {
  const entry = { id: '1', date: '2025-01-03', full_text: 'SECRET_RAW_NOTE',
    summary: 'Улучшение', diagnosis: 'Диагноз', prescribed_treatment: 'Назначение', performed_treatment: 'Проведено' };
  const report = formatClinicalHistory([entry]);
  assert.ok(!report.includes('SECRET_RAW_NOTE'));
  assert.ok(report.includes('Назначено: Назначение'));
  assert.ok(report.includes('Проведено: Проведено'));
  assert.equal(buildClinicalContext({ anamnesis: { history: [entry] } }).anamnesis.history[0].full_text, 'SECRET_RAW_NOTE');
});

test('chronology retains unknown dates and does not mutate stored data', () => {
  const entries = [{ date: '' }, { date: '2025-09-02' }, { date: '2025-01-01' }];
  assert.deepEqual(chronological(entries).map((item) => item.date), ['2025-01-01', '2025-09-02', '']);
  assert.equal(entries[0].date, '');
});

test('bilateral projection hides separate findings without deleting original data', () => {
  const exam = { mammary_mode: 'both' as const, mammary_right_desc: 'Right', mammary_left_sign: true, mammary_both_desc: 'Both' };
  assert.equal(activeExam(exam).mammary_right_desc, undefined);
  assert.equal(activeExam(exam).mammary_left_sign, undefined);
  assert.equal(activeExam(exam).mammary_both_desc, 'Both');
  assert.equal(exam.mammary_right_desc, 'Right');
  assert.equal(activeExam({ ...exam, mammary_mode: 'separate' }).mammary_both_desc, undefined);
});

test('legacy and repeated imaging stay available with original dates', () => {
  const studies = getImagingStudies({
    imaging_methods: ['УЗИ'], 'imaging_desc_УЗИ': 'Legacy',
    imaging_studies: [
      { id: '1', method: 'УЗИ', date: '2025-01-01', region: '', description: 'First', findings: [] },
      { id: '2', method: 'УЗИ', date: '2025-02-01', region: '', description: 'Second', findings: [] },
    ],
  });
  assert.deepEqual(studies.map((item) => item.description), ['First', 'Second', 'Legacy']);
  assert.equal(studies[2].date, '');
});

test('paste rejects eleventh document, blank text and oversize without truncation', () => {
  assert.doesNotThrow(() => validatePastedDocument('Document', 'Text', 9));
  assert.throws(() => validatePastedDocument('Document', 'Text', 10));
  assert.throws(() => validatePastedDocument('Document', ' ', 0));
  assert.throws(() => validatePastedDocument('Document', 'x'.repeat(200001), 0));
});

test('embedded state escapes script termination and round-trips exact data', () => {
  const state = { name: '</script><script>alert(1)</script>' };
  const encoded = serializeEmbeddedJson(state);
  assert.ok(!encoded.includes('</script>'));
  assert.deepEqual(JSON.parse(encoded), state);
});
