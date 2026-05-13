export type RawAiDebugState = {
  rawResponse: string;
  rawResponseFormat?: string;
  rawProvider?: string;
  rawResponseTime?: number;
  wasRepaired?: boolean;
};

export function extractRawAiDebugState(value: unknown): RawAiDebugState | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).rawResponse !== 'string' ||
    !(value as Record<string, unknown>).rawResponse ||
    !(String((value as Record<string, unknown>).rawResponse).trim())
  ) {
    return null;
  }

  const v = value as Record<string, unknown>;
  return {
    rawResponse: v.rawResponse as string,
    rawResponseFormat: v.rawResponseFormat as string | undefined,
    rawProvider: v.rawProvider as string | undefined,
    rawResponseTime: v.rawResponseTime as number | undefined,
    wasRepaired: v.wasRepaired as boolean | undefined,
  };
}
