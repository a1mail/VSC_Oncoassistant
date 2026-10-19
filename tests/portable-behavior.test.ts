import assert from 'node:assert/strict';
import test from 'node:test';
import { appStorage, clearPortableSession, initializeAppStorage } from '../src/lib/appStorage';
import { choosePortablePatientStorageDirectory, disconnectPortablePatientStorage, loadPortablePatientDatabase, savePortablePatientDatabase } from '../src/lib/portablePatientStorage';
import { api } from '../src/lib/api';

const browserData = new Map<string, string>([['onco_patients', 'legacy'], ['unrelated', 'keep']]);
const files = new Map<string, string>();
let denyWrite = false;
const fakeWindow = {
  location: { protocol: 'file:', pathname: '/Diagassist_6.html' },
  localStorage: {
    getItem: (key: string) => browserData.get(key) ?? null,
    setItem: (key: string, value: string) => browserData.set(key, value),
    removeItem: (key: string) => browserData.delete(key),
  },
  showDirectoryPicker: async () => ({
    name: 'TEST_USB',
    getFileHandle: async (name: string) => ({
      getFile: async () => ({ text: async () => files.get(name) || '' }),
      createWritable: async () => {
        if (denyWrite) throw new Error('USB removed');
        let pending = '';
        return {
          write: async (value: string) => { pending = value; },
          close: async () => { files.set(name, pending); },
        };
      },
    }),
  }),
};
Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true });

test('portable session cleans only app legacy storage and persists new data only in memory', () => {
  initializeAppStorage();
  assert.equal(browserData.has('onco_patients'), false);
  assert.equal(browserData.get('unrelated'), 'keep');
  appStorage.setItem('onco_patients', 'memory');
  assert.equal(browserData.has('onco_patients'), false);
  assert.equal(appStorage.getItem('onco_patients'), 'memory');
  clearPortableSession();
  assert.equal(appStorage.getItem('onco_patients'), null);
});

test('missing folder and unplugged drive reject save; backups preserve previous version', async () => {
  disconnectPortablePatientStorage();
  const database = { version: 1 as const, savedAt: '', patients: [], consultations: {} };
  await assert.rejects(savePortablePatientDatabase(database), /Выберите папку/);
  await choosePortablePatientStorageDirectory();
  await savePortablePatientDatabase(database);
  const first = files.get('oncoassistant-patient-db.json');
  await savePortablePatientDatabase(database);
  assert.equal(files.get('oncoassistant-patient-db.json.backup'), first);
  denyWrite = true;
  await assert.rejects(savePortablePatientDatabase(database), /USB removed/);
  denyWrite = false;
  files.set('oncoassistant-patient-db.json', '{"version":1,"patients":[{}]}');
  await assert.rejects(loadPortablePatientDatabase(), /Некорректная структура/);
  files.clear();
});

test('concurrent patient mutations retain both patients in the USB file', async () => {
  await Promise.all([
    api.savePatient({ id: 101, full_name: 'Synthetic A', birth_date: '', gender: 'male' }),
    api.savePatient({ id: 102, full_name: 'Synthetic B', birth_date: '', gender: 'female' }),
  ]);
  const database = await loadPortablePatientDatabase();
  assert.equal(database?.patients.length, 2);
  assert.equal(browserData.has('onco_patients'), false);
});
