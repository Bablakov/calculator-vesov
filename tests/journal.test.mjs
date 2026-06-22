// Тесты логики журнала: план на день, объём тренировки, id подхода.
import { eq } from "./_assert.mjs";
import { planForDay, sessionVolume, flattenSlots, nextSlot, durationMin, buildDayItems, itemsVolume, finalizeItems, restWorkStats } from "../js/journal.js";

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

// автопрогрессия: плоский список слотов и «следующая тренировка»
const p2 = { id: "pp", weeks: [ { days: [{}, {}] }, { days: [{}, {}] } ] }; // 2 недели × 2 дня = 4 слота
eq(flattenSlots(p2).length, 4, "flattenSlots: 4 слота");
eq(flattenSlots(p2)[2], { week: 1, day: 0 }, "слот #3 = неделя 2, день 1");
eq(nextSlot(p2, []), { week: 0, day: 0, index: 0, total: 4, cycle: 0 }, "0 завершённых → первая тренировка");
const sess2 = [{ programId: "pp" }, { programId: "pp" }];
eq([nextSlot(p2, sess2).week, nextSlot(p2, sess2).day, nextSlot(p2, sess2).index], [1, 0, 2], "2 завершено → слот #3 (неделя 2, день 1)");
const sess4 = Array.from({ length: 4 }, () => ({ programId: "pp" }));
eq([nextSlot(p2, sess4).week, nextSlot(p2, sess4).day, nextSlot(p2, sess4).cycle], [0, 0, 1], "пройден круг → снова слот #1, cycle=1");
eq(nextSlot(p2, [{ programId: "other" }]).index, 0, "чужие программы не считаются");

// длительность тренировки из меток времени
eq(durationMin(0, 1000), null, "нет начала (0) → null");
eq(durationMin(600000, 2400000), 30, "10:00→40:00 = 30 минут");
eq(durationMin(2400000, 600000), null, "конец раньше начала → null");

// рабочие элементы дня (основные + подсобки как отдельные упражнения)
const progAcc = { discipline: "pl", weeks: [ { kind: "x", days: [
  { name: "Д1", exercises: [ { key: "squat", sets: [ { pct: 50, reps: 5 }, { pct: 100, reps: 1 } ], acc: [ { name: "Гиперэкстензии", sets: 3, reps: 12 } ] } ] },
] } ] };
const items = buildDayItems(progAcc, { squat: 200 }, 0, 0);
eq(items.length, 2, "buildDayItems: 1 основное + 1 подсобка = 2 элемента");
eq([items[0].kind, items[1].kind], ["main", "acc"], "порядок: основное, затем подсобка");
eq([items[0].sets.length, items[1].sets.length], [2, 3], "подходы: основное 2, подсобка 3 (из sets)");
eq([items[0].sets[1].planExact, items[0].sets[1].planPlate], [200, 200], "план основного: 100% от 200 = 200");
eq(items[1].sets[0].planReps, 12, "план подсобки: повторы 12");

// объём по элементам
eq(itemsVolume([{ kind: "main", sets: [ { w: "100", reps: "5" }, { w: "200", reps: "1" } ] }, { kind: "acc", sets: [ { w: "", reps: "" } ] }]), 700, "объём: 100×5 + 200×1 = 700");
eq(itemsVolume([]), 0, "объём пусто → 0");

// подстановка плана вместо пустых вес/повт; качество не трогаем
const fin = finalizeItems([
  { kind: "main", sets: [ { planPlate: 150, planReps: 5, w: "", reps: "", q: "", note: "" }, { planPlate: 160, planReps: 3, w: "165", reps: "2", q: "4", note: "тяжело" } ] },
  { kind: "acc", sets: [ { planReps: 12, w: "", reps: "", q: "" } ] },
]);
eq([fin[0].sets[0].w, fin[0].sets[0].reps], ["150", "5"], "main пустые → план («на снарядах» 150, повт 5)");
eq([fin[0].sets[1].w, fin[0].sets[1].reps], ["165", "2"], "введённые значения сохраняются");
eq(fin[0].sets[0].q, "", "качество по умолчанию не подставляется");
eq([fin[1].sets[0].w, fin[1].sets[0].reps], ["", "12"], "acc: веса нет (пусто), повт ← план 12");

// таймер: время под нагрузкой и отдыха из меток st/et
const tItems = [{ kind: "main", sets: [
  { st: 1000, et: 31000 },        // работа 30 с
  { st: 91000, et: 111000 },      // отдых 60 с (91-31), работа 20 с
] }];
eq(restWorkStats(tItems), { setsTimed: 2, workSec: 50, restSec: 60 }, "таймер: работа 50 с, отдых 60 с");
eq(restWorkStats([{ kind: "main", sets: [ { w: "100", reps: "5" } ] }]), { setsTimed: 0, workSec: 0, restSec: 0 }, "без меток таймера → нули");
