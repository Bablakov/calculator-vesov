// Встроенные шаблоны программ (только просмотр; «Взять за основу» делает копию).
// Все проценты ≤ 100% (105% = проходка/соревнования, в программах не используется).
// ⚠️ 5/3/1, Шейко, Куб даны упрощённо — как стартовая основа для редактирования.
import { WEEKS } from "./config.js";

export const TEMPLATES = [
  {
    id: "ours",
    name: "Наш 4-нед. цикл",
    type: "triathlon",
    note: "Н1–Н2 средние, Н3 тяжёлая, Н4 лёгкая (разгрузка).",
    weeks: WEEKS.map((w) => ({ kind: w.kind, sets: w.sets.map((s) => ({ ...s })) })),
  },
  {
    id: "531",
    name: "5/3/1 (Вендлер)",
    type: "triathlon",
    note: "Три рабочих подхода, последний — на максимум (АМРАП). Считается от 1ПМ.",
    weeks: [
      { kind: "неделя 5", sets: [ { pct: 65, reps: 5 }, { pct: 75, reps: 5 }, { pct: 85, reps: "макс" } ] },
      { kind: "неделя 3", sets: [ { pct: 70, reps: 3 }, { pct: 80, reps: 3 }, { pct: 90, reps: "макс" } ] },
      { kind: "неделя 5/3/1", sets: [ { pct: 75, reps: 5 }, { pct: 85, reps: 3 }, { pct: 95, reps: "макс" } ] },
      { kind: "разгрузка", sets: [ { pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 } ] },
    ],
  },
  {
    id: "sheiko",
    name: "Шейко (базовый объём)",
    type: "triathlon",
    note: "Большой объём, умеренные проценты. Упрощённый блок из 2 недель.",
    weeks: [
      { kind: "объём A", sets: [ { pct: 50, reps: 5 }, { pct: 60, reps: 5 }, { pct: 70, reps: 5 }, { pct: 75, reps: 5 }, { pct: 75, reps: 5 } ] },
      { kind: "объём B", sets: [ { pct: 55, reps: 5 }, { pct: 65, reps: 5 }, { pct: 75, reps: 4 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3 } ] },
    ],
  },
  {
    id: "cube",
    name: "Куб (Cube Method)",
    type: "triathlon",
    note: "Ротация: взрывная / тяжёлая / объёмная. Упрощённо.",
    weeks: [
      { kind: "взрывная", sets: [ { pct: 50, reps: 3 }, { pct: 55, reps: 3 }, { pct: 60, reps: 3 } ] },
      { kind: "тяжёлая", sets: [ { pct: 80, reps: 3 }, { pct: 85, reps: 2 }, { pct: 90, reps: 1 } ] },
      { kind: "объёмная", sets: [ { pct: 65, reps: 5 }, { pct: 70, reps: 5 }, { pct: 75, reps: 5 } ] },
    ],
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
