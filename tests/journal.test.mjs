// Тесты логики журнала: план на день, объём тренировки, id подхода.
import { eq } from "./_assert.mjs";
import { planForDay, sessionVolume, factId } from "../js/journal.js";

console.log("journal:");

const prog = {
  discipline: "pl",
  weeks: [ { kind: "x", days: [
    { name: "День 1", exercises: [ { key: "squat", sets: [ { pct: 50, reps: 5 }, { pct: 100, reps: 1 } ], acc: [ { name: "Гиперэкстензии", sets: 3, reps: 12 } ] } ] },
    { name: "День 2", exercises: [ { key: "bench", sets: [ { pct: 80, reps: 3 } ], acc: [] } ] },
  ] } ],
};

const d0 = planForDay(prog, { squat: 200, bench: 100, deadlift: 300 }, 0, 0);
eq(d0.length, 1, "день 1 → 1 упражнение (присед)");
eq(d0[0].key, "squat", "день 1 — присед");
eq([d0[0].sets[0].exact, d0[0].sets[1].exact], [100, 200], "присед 50%/100% от 200 = 100/200");
eq(d0[0].sets[0].plate, 100, "на снарядах кратно 2,5");
eq(d0[0].acc[0].name, "Гиперэкстензии", "подсобки прокинуты в план дня");

const d1 = planForDay(prog, { squat: 200, bench: 100, deadlift: 300 }, 0, 1);
eq([d1[0].key, d1[0].sets[0].exact], ["bench", 80], "день 2 — жим 80% от 100 = 80");

eq(planForDay(prog, {}, 0, 5), [], "несуществующий день → пусто");
eq(planForDay(prog, {}, 9, 0), [], "несуществующая неделя → пусто");
eq(planForDay({ weeks: [{ days: [{ exercises: [{ key: "squat", sets: [{ pct: 50, reps: 5 }] }] }] }] }, {}, 0, 0)[0].sets[0].exact, 0, "нет 1ПМ → вес 0 (покажем «—»)");

eq(sessionVolume({ "squat.0": { w: "100", reps: "5" }, "bench.0": { w: "60", reps: "3" } }), 680, "объём = 100×5 + 60×3 = 680");
eq(sessionVolume({ "x": { w: "100" } }), 0, "без повторов — не считается");
eq(sessionVolume({}), 0, "пусто → 0");

eq(factId("squat", 2), "squat.2", "factId");
