// Раздел «Отчёты»: сводка по завершённым тренировкам (журнал).
import { get, KEYS } from "./store.js";
import { LIFTS } from "./config.js";
import { fmt } from "./util.js";
import { fmtDuration } from "./profile.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// Длительность: сколько, среднее, мин, макс (минуты).
export function durationStats(sessions){
  const ds = (sessions || []).map((s) => s.durationMin).filter((n) => Number.isFinite(n) && n > 0);
  if (!ds.length) return { count: 0, avg: null, min: null, max: null };
  const sum = ds.reduce((a, b) => a + b, 0);
  return { count: ds.length, avg: Math.round(sum / ds.length), min: Math.min(...ds), max: Math.max(...ds) };
}

// Объём: суммарный и средний тоннаж за тренировку (кг).
export function volumeStats(sessions){
  const vs = (sessions || []).map((s) => Number(s.volume) || 0);
  const total = vs.reduce((a, b) => a + b, 0);
  return { total, avg: vs.length ? Math.round(total / vs.length) : 0, count: vs.length };
}

// Частота: тренировок в неделю по разбросу дат.
export function weeklyFrequency(sessions){
  const ts = (sessions || []).map((s) => s.ts).filter(Boolean);
  if (!ts.length) return 0;
  const span = Math.max(1, (Math.max(...ts) - Math.min(...ts)) / (7 * 864e5));
  return Math.round(ts.length / span * 10) / 10;
}

// Тоннаж по движениям: Σ (вес × повт) из факт. подходов, ключ — упражнение.
export function liftTonnage(sessions){
  const t = {};
  (sessions || []).forEach((s) => {
    const e = s.entries || {};
    for (const id in e){
      const k = id.split(".")[0];
      const w = Number(e[id].w), r = Number(e[id].reps);
      if (Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0) t[k] = (t[k] || 0) + w * r;
    }
  });
  return t;
}

// Темп: среднее время под нагрузкой/отдыха по тренировкам с таймером.
export function tempoStats(sessions){
  let work = 0, rest = 0, sets = 0, n = 0;
  (sessions || []).forEach((s) => { if (s.setsTimed){ work += s.workSec || 0; rest += s.restSec || 0; sets += s.setsTimed; n++; } });
  const rests = Math.max(0, sets - n);   // отдыхов на 1 меньше, чем подходов, в каждой тренировке
  return { sessions: n, totalWork: work, totalRest: rest, avgWorkPerSet: sets ? Math.round(work / sets) : 0, avgRestPerSet: rests ? Math.round(rest / rests) : 0 };
}

// Среднее качество подходов (1–5), null если оценок нет.
export function qualityAvg(sessions){
  let sum = 0, n = 0;
  (sessions || []).forEach((s) => {
    const e = s.entries || {};
    for (const id in e){ const q = Number(e[id].q); if (Number.isFinite(q) && q > 0){ sum += q; n++; } }
  });
  return n ? Math.round(sum / n * 10) / 10 : null;
}

/* ───── Рендер ───── */
export function initReports(root){ renderReports(root); }

export function renderReports(root){
  const sessions = get(KEYS.sessions, []);
  if (!sessions.length){
    root.innerHTML = '<div class="placeholder"><p>Отчёты появятся после первых завершённых тренировок.</p>' +
      '<a class="btn-link" href="#journal">→ К журналу</a></div>';
    return;
  }
  const d = durationStats(sessions), v = volumeStats(sessions), f = weeklyFrequency(sessions), q = qualityAvg(sessions);
  const ton = liftTonnage(sessions);
  const tp = tempoStats(sessions);

  const cards =
    card("Тренировок", String(v.count), "всего завершено") +
    card("Средняя длительность", fmtDuration(d.avg), d.count ? "от " + fmtDuration(d.min) + " до " + fmtDuration(d.max) : "нет данных о времени") +
    card("Частота", f + " /нед", "в среднем тренировок в неделю") +
    card("Средний объём", fmt(v.avg) + " кг", "за тренировку · всего " + fmt(v.total) + " кг") +
    card("Качество", q == null ? "—" : q + " / 5", "средняя оценка подходов") +
    (tp.sessions ? card("Отдых (сред.)", fmtSec(tp.avgRestPerSet), "между подходами") +
      card("Под нагрузкой", fmtSec(tp.avgWorkPerSet), "в среднем за подход") : "");

  const maxTon = Math.max(1, ...LIFTS.map((l) => ton[l.key] || 0));
  const bars = LIFTS.map((l) => {
    const kg = ton[l.key] || 0;
    const pct = Math.round(kg / maxTon * 100);
    return '<div class="rep-bar">' +
      '<span class="rep-bar__n">' + l.short + '</span>' +
      '<span class="rep-bar__track"><span class="rep-bar__fill" style="width:' + pct + '%;background:' + l.accent + '"></span></span>' +
      '<span class="rep-bar__kg">' + fmt(kg) + ' кг</span>' +
    '</div>';
  }).join("");

  root.innerHTML =
    '<div class="rep-grid">' + cards + '</div>' +
    '<section class="prof-card"><h3 class="prof-h">Тоннаж по движениям</h3>' + bars + '</section>' +
    '<p class="muted" style="margin-top:10px">Данные берутся из завершённых тренировок (вкладка «Факт» в Журнале).</p>';
}

function fmtSec(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? m + ":" + String(s).padStart(2, "0") : s + " с";
}

function card(label, value, sub){
  return '<div class="rep-card">' +
    '<span class="rep-card__l">' + label + '</span>' +
    '<span class="rep-card__v">' + value + '</span>' +
    (sub ? '<span class="rep-card__s">' + sub + '</span>' : '') +
  '</div>';
}
