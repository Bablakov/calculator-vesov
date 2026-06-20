// Общие утилиты: парсинг ввода, округления, форматирование, даты.

// "82,5" / "82.5 кг" → 82.5 ; мусор и неположительные → 0
export function parseNum(v){
  const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Округление до десятых килограмма
export function round1(kg){ return Math.round(kg * 10) / 10; }

// Формат веса: до 0,1 кг, целые — без ".0"
export function fmt(kg){
  const r = round1(kg);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Ближайшее кратное 2,5 кг («как на снарядах»)
export function round2_5(kg){ return Math.round(kg / 2.5) * 2.5; }

// Две ближайшие «стороны» кратно 2,5 (для выбора фактического веса в дневнике).
// 113 → [112.5, 115]; если значение уже кратно 2,5 — одна опция.
export function plateOptions(kg){
  const lo = Math.floor(kg / 2.5) * 2.5;
  const hi = Math.ceil(kg / 2.5) * 2.5;
  return lo === hi ? [lo] : [lo, hi];
}

// Дата + время по-русски
export function fmtDateTime(ts){
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU") + " " +
         d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// Экранирование текста для вставки в HTML (заметки пользователя)
export function escapeHtml(s){
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// Экранирование для значения HTML-атрибута (value="...")
export function escapeAttr(s){
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
