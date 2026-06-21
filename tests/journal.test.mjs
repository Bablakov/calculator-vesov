// Тесты логики журнала: план на неделю, объём тренировки.
import { eq } from "./_assert.mjs";
import { planForWeek, sessionVolume, factId } from "../js/journal.js";

console.log("journal:");

const prog = { type: "triathlon", lift: null, weeks: [ { kind: "x", sets: [ { pct: 50, reps: 5 }, { pct: 100, reps: 1 } ] } ] };
const plan = planForWeek(prog, { squat: 200, bench: 100, deadlift: 300 }, 0);
eq(plan.length, 3, "троеборье → 3 упражнения в плане");
eq(plan[0].key, "squat", "первое — присед");
eq([plan[0].sets[0].exact, plan[0].sets[1].exact], [100, 200], "присед 50%/100% от 200 = 100/200");
eq([plan[1].sets[0].exact, plan[1].sets[1].exact], [50, 100], "жим 50%/100% от 100 = 50/100");
eq(plan[2].sets[1].exact, 300, "тяга 100% от 300 = 300");

const duo = planForWeek({ type: "duathlon", weeks: prog.weeks }, { bench: 100, deadlift: 300 }, 0);
eq(duo.map((e) => e.key), ["bench", "deadlift"], "двоеборье → жим, тяга");

const single = planForWeek({ type: "single", lift: "deadlift", weeks: prog.weeks }, { deadlift: 300 }, 0);
eq([single.length, single[0].key], [1, "deadlift"], "одно движение → только тяга");

eq(planForWeek(prog, {}, 5), [], "несуществующая неделя → пусто");

eq(sessionVolume({ "squat.0": { w: "100", reps: "5" }, "bench.0": { w: "60", reps: "3" } }), 680, "объём = 100×5 + 60×3 = 680");
eq(sessionVolume({ "x": { w: "100" } }), 0, "без повторов — не считается");
eq(sessionVolume({}), 0, "пусто → 0");

eq(factId("squat", 2), "squat.2", "factId");
