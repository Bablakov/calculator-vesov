// Тесты логики отчётов: длительность, объём, частота, тоннаж, качество.
import { eq } from "./_assert.mjs";
import { durationStats, volumeStats, weeklyFrequency, liftTonnage, qualityAvg } from "../js/reports.js";

console.log("reports:");

const DAY = 864e5;
const S = [
  { ts: 1000,            durationMin: 60, volume: 5000, entries: { "squat.0": { w: "100", reps: "5", q: "4" }, "bench.0": { w: "60", reps: "5", q: "3" } } },
  { ts: 1000 + 7 * DAY,  durationMin: 90, volume: 7000, entries: { "squat.0": { w: "120", reps: "3", q: "5" } } },
];

eq(durationStats(S), { count: 2, avg: 75, min: 60, max: 90 }, "длительность: avg 75, min 60, max 90");
eq(durationStats([]), { count: 0, avg: null, min: null, max: null }, "нет тренировок → нули/null");
eq(durationStats([{ volume: 100 }]), { count: 0, avg: null, min: null, max: null }, "сессии без времени не учитываются");

eq(volumeStats(S), { total: 12000, avg: 6000, count: 2 }, "объём: total 12000, avg 6000");
eq(volumeStats([]), { total: 0, avg: 0, count: 0 }, "объём пусто → 0");

eq(weeklyFrequency(S), 2, "2 тренировки за 1 неделю → 2.0 /нед");
eq(weeklyFrequency([]), 0, "нет тренировок → частота 0");

eq(liftTonnage(S), { squat: 860, bench: 300 }, "тоннаж: присед 100×5+120×3=860, жим 60×5=300");

eq(qualityAvg(S), 4, "качество: (4+3+5)/3 = 4.0");
eq(qualityAvg([{ entries: {} }]), null, "нет оценок → null");
