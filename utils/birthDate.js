// Utility functions for birth date parsing/formatting and metadata.

/**
 * Validate and normalize a birth date string in format DD.MM.YYYY.
 * @param {string} value
 * @returns {string|null}
 */
function normalizeBirthDate(value) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValidDate) return null;

  const today = new Date();
  if (date > today) return null;

  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/**
 * Parse a normalized birth date into Date or null.
 * @param {string} value
 * @returns {Date|null}
 */
function parseBirthDate(value) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  ) {
    return d;
  }
  return null;
}

/**
 * Default birth date is 25 years ago from today.
 * @returns {Date}
 */
function defaultBirthDate() {
  const today = new Date();
  return new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
}

/**
 * Extract day/month numbers from a normalized date string.
 * @param {string|null} normalized
 * @returns {{birthDay: number|null, birthMonth: number|null}}
 */
function getBirthDayMonth(normalized) {
  if (!normalized) return { birthDay: null, birthMonth: null };
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(normalized);
  if (!match) return { birthDay: null, birthMonth: null };
  return { birthDay: Number(match[1]), birthMonth: Number(match[2]) };
}

module.exports = {
  normalizeBirthDate,
  parseBirthDate,
  defaultBirthDate,
  getBirthDayMonth,
};
