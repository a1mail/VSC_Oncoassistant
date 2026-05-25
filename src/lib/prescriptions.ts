export type NormalizedPrescription = {
  type: string;
  name: string;
  details: string;
};

const normalizeKeyToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');

export function toPrescriptionText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (Array.isArray(value)) {
    return value.map(toPrescriptionText).filter(Boolean).join('; ');
  }
  return '';
}

/**
 * Normalizes heterogeneous AI prescription payloads into a stable table/report shape.
 * This preserves clinically important fields even when different models use different keys.
 */
export function normalizePrescriptionItem(item: unknown): NormalizedPrescription | null {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return { type: 'Препарат', name: text, details: text };
  }

  if (!item || typeof item !== 'object') return null;

  const prescription = item as Record<string, unknown>;
  const keyMap = new Map<string, unknown>(
    Object.entries(prescription).map(([key, value]) => [normalizeKeyToken(key), value]),
  );

  const pickValue = (aliases: string[]): unknown => {
    for (const alias of aliases) {
      if (prescription[alias] !== undefined) {
        return prescription[alias];
      }
      const normalizedAlias = normalizeKeyToken(alias);
      if (keyMap.has(normalizedAlias)) {
        return keyMap.get(normalizedAlias);
      }
    }
    return undefined;
  };

  const type =
    toPrescriptionText(
      pickValue(['type', 'category', 'kind', 'classification', 'тип', 'категория', 'класс']),
    ) || 'Препарат';
  const name =
    toPrescriptionText(
      pickValue([
        'name',
        'drug',
        'medication',
        'medicine',
        'title',
        'препарат',
        'наименование',
        'название',
        'лекарство',
        'мнн',
        'international_nonproprietary_name',
      ]),
    ) || 'Без названия';

  const detailFields = [
    ['Показание', pickValue(['indication', 'показание'])],
    ['Дозировка', pickValue(['dosage', 'dose', 'доза', 'дозировка'])],
    ['Форма', pickValue(['form', 'форма'])],
    ['Путь введения', pickValue(['route', 'путьвведения'])],
    ['Кратность', pickValue(['frequency', 'кратность'])],
    ['Длительность', pickValue(['duration', 'длительность', 'курс'])],
    ['Режим', pickValue(['regimen', 'scheme', 'protocol', 'режим', 'схема'])],
    ['Инструкция', pickValue(['instructions', 'details', 'описание', 'инструкция'])],
    ['Противопоказания', pickValue(['contraindications', 'противопоказания'])],
    ['Предостережения', pickValue(['warnings', 'warning', 'предупреждения'])],
    ['Примечание', pickValue(['note', 'notes', 'примечание'])],
  ] as const;

  const details = detailFields
    .map(([label, value]) => {
      const text = toPrescriptionText(value);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean)
    .join('; ');

  return { type, name, details: details || name };
}

/**
 * Converts arbitrary model output for treatment prescriptions into a predictable array.
 * Supports arrays of objects, plain strings, and object maps.
 */
export function normalizePrescriptions(value: unknown): NormalizedPrescription[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizePrescriptionItem)
      .filter((item): item is NormalizedPrescription => !!item);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: 'Препарат', name: line, details: line }));
  }

  if (value && typeof value === 'object') {
    const single = normalizePrescriptionItem(value);
    if (single && single.name !== 'Без названия') {
      return [single];
    }

    return Object.entries(value as Record<string, unknown>)
      .map(([name, details]) => {
        const normalizedName = name.trim() || 'Без названия';
        const normalizedDetails = toPrescriptionText(details) || normalizedName;
        return {
          type: 'Препарат',
          name: normalizedName,
          details: normalizedDetails,
        };
      })
      .filter((item) => Boolean(item.name || item.details));
  }

  return [];
}
