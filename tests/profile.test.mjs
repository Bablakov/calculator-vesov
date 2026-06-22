// Тесты логики профиля: длительность тренировки, история веса, инициалы.
import { eq } from "./_assert.mjs";
import { computeDuration, fmtDuration, addWeightEntry, initials, ageFromBirth } from "../js/profile.js";

console.log("profile:");
eq(computeDuration("10:00", "11:30"), 90, "длительность 1:30 = 90 мин");
eq(computeDuration("23:30", "00:30"), 60, "длительность через полночь = 60 мин");
eq(computeDuration("", "10:00"), null, "нет начала → null");
eq(computeDuration("10:00", "aa:bb"), null, "мусор → null");

eq(fmtDuration(90), "1 ч 30 мин", "формат 1 ч 30 мин");
eq(fmtDuration(45), "45 мин", "формат 45 мин");
eq(fmtDuration(null), "—", "формат null = —");

eq(addWeightEntry([], 85.44, 1000), [{ id: 1000, ts: 1000, kg: 85.4 }], "вес округляется до 0,1");

const many = Array.from({ length: 100 }, (_, i) => ({ id: i, ts: i, kg: 80 }));
const after = addWeightEntry(many, 90, 9999);
eq(after.length, 100, "история веса ограничена 100 записями");
eq(after[0].kg, 90, "новая запись сверху");

eq(initials({ first: "Иван", last: "Петров" }), "ИП", "инициалы ИП");
eq(initials({}), "🏋", "инициалы fallback");

const NOW = new Date(2026, 5, 22).getTime();   // 22 июня 2026, локальное
eq(ageFromBirth("2000-01-01", NOW), 26, "возраст: др был в этом году → 26");
eq(ageFromBirth("2000-12-31", NOW), 25, "возраст: др ещё не наступил → 25");
eq(ageFromBirth("2026-06-22", NOW), 0, "возраст: родился сегодня → 0");
eq(ageFromBirth("", NOW), null, "пустая дата → null");
eq(ageFromBirth("abc", NOW), null, "мусор → null");
