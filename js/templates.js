// Контент программ (ДАННЫЕ) + генератор шаблонов.
// ⚠️ Контент — ЧЕРНОВИК: уровни / дисциплины / упоры / подсобки и схемы правятся
//    позже в админ-панели (TZ §11.8). Логика (генерация от 1ПМ, рендер) — отдельно.
import { LIFT_BY_KEY } from "./config.js";
import { getWeeks, getAccDefaults } from "./contentstore.js";

/* ─── Уровень подготовки (шаг 1 мастера) ─── */
export const LEVELS = [
  { key: "novice",  name: "Начинающий",   note: "Меньше объём, акцент на технике (2 рабочих подхода)." },
  { key: "amateur", name: "Любитель",     note: "Базовый объём — подходы как в матрице цикла." },
  { key: "pro",     name: "Профессионал", note: "Повышенный объём — добавочный подход к основному движению." },
];
export const LEVEL_BY_KEY = Object.fromEntries(LEVELS.map((l) => [l.key, l]));

/* ─── Дисциплина (шаг 2). days — какое соревновательное движение в фокусе каждого дня (сплит). ─── */
export const DISCIPLINES = [
  { key: "pl",       name: "Троеборье", lifts: ["squat", "bench", "deadlift"], days: ["squat", "bench", "deadlift"] },
  { key: "bp_dl",    name: "Двоеборье", lifts: ["bench", "deadlift"],          days: ["bench", "deadlift", "bench"] },
  { key: "bench",    name: "Жим",       lifts: ["bench"],                       days: ["bench", "bench", "bench"] },
  { key: "deadlift", name: "Становая",  lifts: ["deadlift"],                    days: ["deadlift", "deadlift", "deadlift"] },
];
export const DISCIPLINE_BY_KEY = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d]));

/* ─── Упор цикла (шаг 3). target — на какое движение вешать акцентные подсобки. ─── */
const ACC = (name, sets, reps) => ({ name, sets, reps });
export const FOCUSES = {
  pl: [
    { key: "base",     name: "Базовый",       note: "Равномерно все три движения." },
    { key: "squat",    name: "Упор присед",   target: "squat",    note: "Больше объёма на присед.",  acc: [ACC("Фронтальный присед", 4, 6), ACC("Присед с паузой", 3, 3)] },
    { key: "bench",    name: "Упор жим",      target: "bench",    note: "Больше объёма на жим.",     acc: [ACC("Паузный жим", 4, 4), ACC("Жим узким хватом", 3, 8)] },
    { key: "deadlift", name: "Упор становая", target: "deadlift", note: "Больше объёма на тягу.",    acc: [ACC("Тяга с плинтов", 3, 4), ACC("Румынская тяга", 3, 8)] },
  ],
  bp_dl: [
    { key: "base",     name: "Базовый",       note: "Жим и становая поровну." },
    { key: "bench",    name: "Упор жим",      target: "bench",    note: "Акцент на жим.",  acc: [ACC("Паузный жим", 4, 4), ACC("Жим узким хватом", 3, 8)] },
    { key: "deadlift", name: "Упор становая", target: "deadlift", note: "Акцент на тягу.", acc: [ACC("Тяга с плинтов", 3, 4), ACC("Румынская тяга", 3, 8)] },
  ],
  bench: [
    { key: "base",    name: "Базовый",        target: "bench", note: "Общий объём жима." },
    { key: "liftoff", name: "Срыв от груди",  target: "bench", note: "Усиление нижней фазы.",  acc: [ACC("Паузный жим", 5, 3), ACC("Жим с бруска (низко)", 3, 5)] },
    { key: "lockout", name: "Дожим (локаут)", target: "bench", note: "Усиление верхней фазы.", acc: [ACC("Жим узким хватом", 4, 5), ACC("Жим с бруска (высоко)", 3, 4)] },
    { key: "speed",   name: "Скорость",       target: "bench", note: "Взрывной жим.",          acc: [ACC("Скоростной жим", 8, 3), ACC("Отжимания на брусьях", 3, 10)] },
  ],
  deadlift: [
    { key: "base",    name: "Базовый",        target: "deadlift", note: "Общий объём тяги." },
    { key: "floor",   name: "Срыв с пола",    target: "deadlift", note: "Усиление съёма.",        acc: [ACC("Тяга с паузой у пола", 4, 3), ACC("Тяга из ямы", 3, 4)] },
    { key: "lockout", name: "Дожим (локаут)", target: "deadlift", note: "Усиление верхней фазы.", acc: [ACC("Тяга с плинтов", 4, 3), ACC("«Доброе утро»", 3, 8)] },
    { key: "speed",   name: "Скорость",       target: "deadlift", note: "Взрывной срыв.",         acc: [ACC("Скоростная тяга", 8, 2), ACC("Тяга в наклоне", 3, 10)] },
  ],
};
export function focusesFor(disciplineKey){ return FOCUSES[disciplineKey] || FOCUSES.pl; }
export function focusByKey(disciplineKey, focusKey){
  const list = focusesFor(disciplineKey);
  return list.find((f) => f.key === focusKey) || list[0];
}

/* ─── Уровень меняет объём основного движения (черновая логика) ─── */
function applyLevel(sets, levelKey){
  if (levelKey === "novice") return sets.slice(0, 2);
  if (levelKey === "pro")    return [...sets, { pct: sets[0].pct, reps: sets[0].reps }];
  return sets.slice();
}

/* ─── Генератор: уровень + дисциплина + упор → готовая программа.
       Веса считаются от 1ПМ позже (journal.planForDay). ─── */
export function buildTemplate(levelKey, disciplineKey, focusKey, id){
  const lvl   = LEVEL_BY_KEY[levelKey] || LEVELS[1];
  const disc  = DISCIPLINE_BY_KEY[disciplineKey] || DISCIPLINES[0];
  const focus = focusByKey(disc.key, focusKey);

  const accDefaults = getAccDefaults();
  const weeks = getWeeks().map((w) => ({
    kind: w.kind,
    days: disc.days.map((mainKey, di) => {
      const sets = applyLevel(w.sets, lvl.key).map((s) => ({ pct: s.pct, reps: s.reps }));
      const acc  = (accDefaults[mainKey] || []).map((a) => ({ ...a }));
      if (focus.target === mainKey && focus.acc) acc.unshift(...focus.acc.map((a) => ({ ...a })));
      const short = LIFT_BY_KEY[mainKey] ? LIFT_BY_KEY[mainKey].short : mainKey;
      return { name: "День " + (di + 1) + " · " + short, exercises: [ { key: mainKey, sets, acc } ] };
    }),
  }));

  return {
    id: id || null,
    name: disc.name + " · " + focus.name,
    level: lvl.key, discipline: disc.key, focus: focus.key,
    weeks,
  };
}
