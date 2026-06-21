// Тесты логики программ: типы, шаблоны, валидация.
import { eq } from "./_assert.mjs";
import { liftsForType, blankProgram, fromTemplate, normReps, validSet, validProgram } from "../js/programs.js";
import { TEMPLATE_BY_ID } from "../js/templates.js";

console.log("programs:");
eq(liftsForType("triathlon"), ["squat", "bench", "deadlift"], "троеборье = 3 упражнения");
eq(liftsForType("duathlon"), ["bench", "deadlift"], "двоеборье = жим+тяга");
eq(liftsForType("single", "bench"), ["bench"], "одно движение = выбранное");
eq(liftsForType("single"), ["squat"], "одно движение по умолчанию — присед");

const blank = blankProgram();
eq([blank.type, blank.weeks.length, blank.weeks[0].sets.length], ["triathlon", 1, 1], "пустая программа: троеборье, 1 неделя, 1 подход");

// fromTemplate — глубокая копия (правка копии не трогает шаблон)
const copy = fromTemplate(TEMPLATE_BY_ID.ours, "p1");
const before = TEMPLATE_BY_ID.ours.weeks[0].sets[0].pct;
copy.weeks[0].sets[0].pct = 999;
eq(TEMPLATE_BY_ID.ours.weeks[0].sets[0].pct, before, "fromTemplate не мутирует шаблон");
eq(copy.id, "p1", "копии присвоен id");

eq(normReps("макс"), "макс", "normReps макс");
eq(normReps("8"), 8, "normReps число");
eq(normReps("0"), "", "normReps 0 → пусто");
eq(normReps("abc"), "", "normReps мусор → пусто");

eq(validSet({ pct: 100, reps: 5 }), true, "100%×5 валиден");
eq(validSet({ pct: 105, reps: 5 }), false, "105% невалиден (проходка)");
eq(validSet({ pct: 80, reps: "макс" }), true, "80%×макс валиден");
eq(validSet({ pct: 0, reps: 5 }), false, "0% невалиден");
eq(validSet({ pct: 80, reps: 0 }), false, "0 повторов невалиден");

eq(validProgram({ name: "", weeks: [{ sets: [{ pct: 80, reps: 5 }] }] }), false, "без названия невалидна");
eq(validProgram({ name: "Моя", weeks: [{ sets: [{ pct: 80, reps: 5 }] }] }), true, "валидная программа");
eq(validProgram({ name: "Моя", weeks: [{ sets: [{ pct: 120, reps: 5 }] }] }), false, "120% делает невалидной");
