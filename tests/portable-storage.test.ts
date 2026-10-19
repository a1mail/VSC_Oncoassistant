import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('application storage has an in-memory portable backend', () => {
  assert.match(source('src/main.tsx'), /initializeAppStorage/);
});

test('database save does not swallow flash-drive errors', () => {
  assert.doesNotMatch(source('src/lib/api.ts'), /mirror only/);
});

test('portable file writes preserve a previous database backup', () => {
  assert.match(source('src/lib/portablePatientStorage.ts'), /backup/);
});

test('portable UI supports ending a session', () => {
  assert.match(source('src/components/StandaloneStorageBanner.tsx'), /Завершить сеанс/);
});

test('embedded JSON cannot terminate its script element', () => {
  assert.match(source('src/lib/embeddedHtmlState.ts'), /serializeEmbeddedJson/);
});

test('ending session unmounts clinical forms instead of merely obscuring them', () => {
  assert.match(source('src/App.tsx'), /onco-session-ended/);
});
