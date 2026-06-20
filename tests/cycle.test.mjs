// Тесты ядра цикла и утилит округления.
import { eq } from "./_assert.mjs";
import { round2_5, plateOptions, parseNum } from "../js/util.js";
import { buildProgram, setId } from "../js/cycle.js";

console.log("cycle / util:");
eq(round2_5(113), 112.5, "round2_5(113)=112.5");
eq(plateOptions(113), [112.5, 115], "plateOptions(113)=[112.5,115]");
eq(plateOptions(100), [100], "plateOptions(100)=[100]");
eq(parseNum("82,5 кг"), 82.5, "parseNum('82,5 кг')=82.5");

const prog = buildProgram({ squat: 200, bench: 140, deadlift: 240 });
eq(prog.length, 4, "4 недели");
eq(prog.map((w) => w.kind), ["средняя", "средняя", "тяжёлая", "лёгкая"], "характер недель");
eq(prog[0].days.length, 3, "3 дня в неделе");
eq(prog[0].days[0].exercises.map((e) => e.key), ["bench", "squat"], "день1 = жим, присед");
eq(prog[0].days.map((d) => d.exercises.some((e) => e.key === "bench")), [true, true, true], "жим во все 3 дня");

const sq = prog[0].days[0].exercises.find((e) => e.key === "squat").sets[2];
eq([sq.pct, sq.reps, sq.exact, sq.plate], [85, "макс", 170, 170], "присед н1 п3: 85%×макс от 200 = 170");

const w3 = prog[2].days[0].exercises.find((e) => e.key === "squat").sets[3];
eq([w3.pct, w3.reps, w3.exact], [105, 1, 210], "присед н3 п4: 105%×1 от 200 = 210");

const b = prog[0].days[0].exercises.find((e) => e.key === "bench").sets[2];
eq([b.exact, b.plate], [119, 120], "жим 85% от 140: точно 119, на снарядах 120");

eq(setId(1, 0, "squat", 2), "1.0.squat.2", "setId");
