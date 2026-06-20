// Движок цикла: из 1ПМ строит структуру недели → день → упражнение → подходы.
// Чистая логика без DOM (рендер — в diary.js).
import { WEEKS, SPLIT, LIFT_BY_KEY } from "./config.js";
import { round1, round2_5 } from "./util.js";

// maxes — объект { liftKey: число (кг) }.
export function buildProgram(maxes){
  return WEEKS.map((week) => ({
    n: week.n,
    kind: week.kind,
    days: SPLIT.map((day, di) => ({
      abbr: day.abbr,
      day: day.day,
      di,
      exercises: day.lifts.map((key) => {
        const lift = LIFT_BY_KEY[key];
        const max = Number(maxes[key]) || 0;
        return {
          key,
          name: lift.name,
          accent: lift.accent,
          sets: week.sets.map((s, si) => {
            const raw = max * s.pct / 100;
            return {
              si,
              pct: s.pct,
              reps: s.reps,
              exact: max > 0 ? round1(raw) : 0,       // точный вес до 0,1 кг
              plate: max > 0 ? round2_5(raw) : 0,     // ближайшее «на снарядах» (кратно 2,5)
            };
          }),
        };
      }),
    })),
  }));
}

// Стабильный id подхода: неделя.деньИндекс.упражнение.подходИндекс
export function setId(weekN, di, key, si){ return weekN + "." + di + "." + key + "." + si; }

// Ключ упражнения из id подхода
export function liftKeyOf(id){ return id.split(".")[2]; }
