export function normalizeBirthDate(value: string): string | null;
export function parseBirthDate(value: string): Date | null;
export function defaultBirthDate(): Date;
export function getBirthDayMonth(normalized: string | null): {
  birthDay: number | null;
  birthMonth: number | null;
};
