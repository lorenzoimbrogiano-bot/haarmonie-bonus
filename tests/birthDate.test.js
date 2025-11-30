const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBirthDate,
  parseBirthDate,
  defaultBirthDate,
  getBirthDayMonth,
} = require("../utils/birthDate");

test("normalizeBirthDate returns normalized string for valid date", () => {
  assert.equal(normalizeBirthDate("1.2.2000"), "01.02.2000");
  assert.equal(normalizeBirthDate("01.02.2000"), "01.02.2000");
});

test("normalizeBirthDate rejects invalid or future dates", () => {
  assert.equal(normalizeBirthDate("32.01.2000"), null);
  assert.equal(normalizeBirthDate("29.02.2019"), null); // 2019 not leap year

  const futureYear = new Date().getFullYear() + 1;
  assert.equal(normalizeBirthDate(`01.01.${futureYear}`), null);
});

test("parseBirthDate returns Date for valid normalized value", () => {
  const d = parseBirthDate("05.11.1995");
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 1995);
  assert.equal(d.getMonth(), 10); // zero-based
  assert.equal(d.getDate(), 5);
});

test("parseBirthDate returns null for invalid value", () => {
  assert.equal(parseBirthDate("31.02.2020"), null);
});

test("defaultBirthDate is roughly 25 years ago", () => {
  const d = defaultBirthDate();
  const today = new Date();
  assert.equal(d.getMonth(), today.getMonth());
  assert.equal(d.getDate(), today.getDate());
  assert.equal(d.getFullYear(), today.getFullYear() - 25);
});

test("getBirthDayMonth extracts day and month", () => {
  assert.deepEqual(getBirthDayMonth("09.03.2001"), { birthDay: 9, birthMonth: 3 });
  assert.deepEqual(getBirthDayMonth(null), { birthDay: null, birthMonth: null });
  assert.deepEqual(getBirthDayMonth("invalid"), { birthDay: null, birthMonth: null });
});
