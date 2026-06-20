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
  maxes:   "pct.maxes.v1",       // текущие 1ПМ — общие для калькулятора и цикла
  history: "pct.history.v1",     // история снимков весов (калькулятор)
  profile: "profile.info.v1",    // личные данные: { first, last, middle, age, avatar }
  weight:  "profile.weight.v1",  // история веса тела: [ { id, ts, kg } ]
  timing:  "profile.timing.v1",  // тренировка: { start, end, day }
};
