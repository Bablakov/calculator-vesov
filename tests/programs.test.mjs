// Тесты логики программ: дисциплины, генератор шаблонов, валидация, миграция.
import { eq } from "./_assert.mjs";
import { liftsForDiscipline, blankProgram, normReps, validSet, validProgram, migrateProgram } from "../js/programs.js";
import { buildTemplate } from "../js/templates.js";

console.log("programs:");

// дисциплины → соревновательные движения
eq(liftsForDiscipline("pl"), ["squat", "bench", "deadlift"], "троеборье = 3 движения");
eq(liftsForDiscipline("bp_dl"), ["bench", "deadlift"], "двоеборье = жим+тяга");
eq(liftsForDiscipline("bench"), ["bench"], "жим = только жим");
eq(liftsForDiscipline("deadlift"), ["deadlift"], "становая = только тяга");

// генератор: структура неделя → дни → упражнения
const pl = buildTemplate("amateur", "pl", "base", "t1");
eq(pl.weeks.length, 4, "4 недели (матрица)");
eq(pl.weeks[0].days.length, 3, "троеборье → 3 дня");
eq(pl.weeks[0].days.map((d) => d.exercises[0].key), ["squat", "bench", "deadlift"], "сплит: движение на день");
eq([pl.discipline, pl.level, pl.focus], ["pl", "amateur", "base"], "метаданные сохранены");

// уровень меняет объём основного движения
const nov = buildTemplate("novice", "pl", "base", "t2");
const pro = buildTemplate("pro", "pl", "base", "t3");
eq(nov.weeks[0].days[0].exercises[0].sets.length, 2, "новичок: 2 подхода");
eq(pl.weeks[0].days[0].exercises[0].sets.length, 3, "любитель: 3 подхода");
eq(pro.weeks[0].days[0].exercises[0].sets.length, 4, "профи: +1 подход");

// упор добавляет акцентную подсобку на целевой день
const sqFocus = buildTemplate("amateur", "pl", "squat", "t4");
const squatDay = sqFocus.weeks[0].days.find((d) => d.exercises[0].key === "squat");
eq(squatDay.exercises[0].acc.length >= 3, true, "упор присед → акцентные подсобки добавлены к базовым");

// генерация каждый раз свежая (нет общего состояния, матрица недель не мутируется)
const a = buildTemplate("amateur", "pl", "base", "ta");
a.weeks[0].days[0].exercises[0].sets[0].pct = 999;
const b = buildTemplate("amateur", "pl", "base", "tb");
eq(b.weeks[0].days[0].exercises[0].sets[0].pct !== 999, true, "buildTemplate не делит состояние между вызовами");

// повторы и подходы
eq(normReps("макс"), "макс", "normReps макс");
eq(normReps("8"), 8, "normReps число");
eq(normReps("0"), "", "normReps 0 → пусто");
eq(normReps("abc"), "", "normReps мусор → пусто");

eq(validSet({ pct: 100, reps: 5 }), true, "100%×5 валиден");
eq(validSet({ pct: 105, reps: 5 }), false, "105% невалиден (проходка)");
eq(validSet({ pct: 80, reps: "макс" }), true, "80%×макс валиден");
eq(validSet({ pct: 0, reps: 5 }), false, "0% невалиден");
eq(validSet({ pct: 80, reps: 0 }), false, "0 повторов невалиден");

// валидность нового формата
const good = buildTemplate("amateur", "pl", "base", "tg");
eq(validProgram(good), true, "сгенерированная программа валидна");
good.name = "";
eq(validProgram(good), false, "без названия невалидна");
eq(validProgram({ name: "X", weeks: [] }), false, "без недель невалидна");
eq(validProgram({ name: "X", weeks: [{ kind: "", days: [] }] }), false, "неделя без дней невалидна");
eq(validProgram({ name: "X", weeks: [{ days: [{ name: "Д1", exercises: [] }] }] }), false, "день без упражнений невалиден");

// пустая программа «с нуля»
const bl = blankProgram();
eq([bl.discipline, bl.weeks.length, bl.weeks[0].days.length, bl.weeks[0].days[0].exercises.length],
   ["pl", 1, 1, 1], "пустая: pl, 1 нед, 1 день, 1 упр");

// миграция старого формата (type/lift, weeks[{sets}]) → новый
const oldProg = { id: "old1", name: "Старая", type: "triathlon", lift: null, weeks: [ { kind: "средняя", sets: [ { pct: 70, reps: 5 }, { pct: 80, reps: 3 } ] } ] };
const mig = migrateProgram(oldProg);
eq(Array.isArray(mig.weeks[0].days), true, "миграция: появились дни");
eq(mig.weeks[0].days[0].exercises.map((e) => e.key), ["squat", "bench", "deadlift"], "миграция троеборья: 3 движения в дне");
eq(mig.weeks[0].days[0].exercises[0].sets.length, 2, "миграция: подходы сохранены");
eq(mig.discipline, "pl", "миграция: дисциплина pl");

// миграция идемпотентна (повторный прогон не ломает)
const mig2 = migrateProgram(mig);
eq(Array.isArray(mig2.weeks[0].days), true, "миграция идемпотентна (дни на месте)");
eq(mig2.weeks[0].days[0].exercises.length, 3, "повторная миграция не дублирует/не теряет упражнения");

// миграция двоеборья и одного движения
eq(migrateProgram({ name: "d", type: "duathlon", weeks: [{ kind: "", sets: [{ pct: 70, reps: 5 }] }] }).discipline, "bp_dl", "миграция duathlon → bp_dl");
eq(migrateProgram({ name: "s", type: "single", lift: "deadlift", weeks: [{ kind: "", sets: [{ pct: 70, reps: 5 }] }] }).discipline, "deadlift", "миграция single deadlift → deadlift");
eq(migrateProgram({ name: "s", type: "single", lift: "bench", weeks: [{ kind: "", sets: [{ pct: 70, reps: 5 }] }] }).weeks[0].days[0].exercises.map((e) => e.key), ["bench"], "миграция single bench → одно движение жим");
