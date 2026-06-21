// Тонкая безопасная обёртка над localStorage (бэкенда нет).

export function get(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

export function set(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

export function remove(key){
  try { localStorage.removeItem(key); } catch (e) {}
}

// Ключи хранилища приложения.
export const KEYS = {
  maxes:    "pct.maxes.v1",       // текущие 1ПМ — общие для калькулятора, программ, журнала
  history:  "pct.history.v1",     // история снимков 1ПМ (калькулятор)
  profile:  "profile.info.v1",    // личные данные: { first, last, middle, age, avatar, role }
  weight:   "profile.weight.v1",  // история веса тела: [ { id, ts, kg } ]
  timing:   "profile.timing.v1",  // тренировка: { start, end, day }
  programs: "pct.programs.v1",    // мои программы: [ program ]
  active:   "pct.active.v1",      // id активной программы (для журнала)
  sessions: "pct.sessions.v1",    // история тренировок (ФАКТ): [ session ]
  accCustom:"pct.acc.custom.v1",  // свои подсобки: [ { id, name, cat } ]
};
