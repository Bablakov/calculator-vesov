// Раздел «Журнал»: ПЛАН (просмотр) + ФАКТ (дневник) + история тренировок.
// ФАКТ: упражнения листаются плашечками/стрелками (по одному), блоки «Основной»/«Подсобка».
// У каждого подхода — таймер (старт/стоп): время под нагрузкой и отдыха → статистика и отчёты.
// Автопрогрессия; вес тела и тайминг — в тренировке; пустые вес/повт = план.
import { get, set, KEYS } from "./store.js";
import { LIFT_BY_KEY, QUALITY } from "./config.js";
import { getErrors } from "./contentstore.js";
import { getPrograms } from "./programs.js";
import { fmtDuration, addWeightEntry } from "./profile.js";
import { parseNum, fmt, plateOptions, fmtDateTime, escapeAttr, escapeHtml } from "./util.js";

/* ───── Чистая логика (покрыта тестами) ───── */

export function planForDay(program, maxes, weekIndex, dayIndex){
  const week = program.weeks[weekIndex];
  if (!week || !Array.isArray(week.days)) return [];
  const day = week.days[dayIndex];
  if (!day) return [];
  return day.exercises.map((ex) => {
    const lift = LIFT_BY_KEY[ex.key];
    const max = Number(maxes[ex.key]) || 0;
    return {
      key: ex.key, name: lift ? lift.name : ex.key, accent: lift ? lift.accent : "#8891a6",
      sets: ex.sets.map((s, si) => {
        const raw = max * s.pct / 100;
        return { si, pct: s.pct, reps: s.reps, exact: max > 0 ? Math.round(raw * 10) / 10 : 0, plate: max > 0 ? Math.round(raw / 2.5) * 2.5 : 0 };
      }),
      acc: (ex.acc || []).map((a) => ({ name: a.name, sets: a.sets, reps: a.reps })),
    };
  });
}

// «Рабочие элементы» дня: основные движения + подсобки (как отдельные упражнения).
export function buildDayItems(program, maxes, weekIndex, dayIndex){
  const plan = planForDay(program, maxes, weekIndex, dayIndex);
  const items = [];
  plan.forEach((ex) => {
    items.push({
      kind: "main", key: ex.key, name: ex.name, accent: ex.accent,
      sets: ex.sets.map((s) => ({ planPct: s.pct, planExact: s.exact, planPlate: s.plate, planReps: s.reps, w: "", reps: "", q: "", err: "", note: "" })),
    });
    (ex.acc || []).forEach((a) => {
      const n = Math.max(1, Number(a.sets) || 1);
      items.push({
        kind: "acc", name: a.name, accent: ex.accent,
        sets: Array.from({ length: n }, () => ({ planReps: a.reps, w: "", reps: "", q: "", note: "" })),
      });
    });
  });
  return items;
}

export function itemsVolume(items){
  let kg = 0;
  (items || []).forEach((it) => (it.sets || []).forEach((s) => {
    const w = Number(s.w), r = Number(s.reps);
    if (Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0) kg += w * r;
  }));
  return Math.round(kg);
}

export function finalizeItems(items){
  return (items || []).map((it) => ({
    ...it,
    sets: it.sets.map((s) => {
      const w = (s.w !== "" && s.w != null) ? s.w
        : (it.kind === "main" && Number(s.planPlate) > 0 ? String(s.planPlate) : s.w);
      const reps = (s.reps !== "" && s.reps != null) ? s.reps
        : (typeof s.planReps === "number" ? String(s.planReps) : s.reps);
      return { ...s, w, reps };
    }),
  }));
}

// Статистика таймера: время под нагрузкой и отдыха (сек) по меткам st/et подходов.
export function restWorkStats(items){
  const timed = [];
  (items || []).forEach((it) => (it.sets || []).forEach((s) => {
    const st = Number(s.st), et = Number(s.et);
    if (Number.isFinite(st) && Number.isFinite(et) && et >= st) timed.push({ st, et });
  }));
  timed.sort((a, b) => a.st - b.st);
  let work = 0, rest = 0;
  timed.forEach((t, i) => {
    work += t.et - t.st;
    if (i > 0){ const r = t.st - timed[i - 1].et; if (r > 0) rest += r; }
  });
  return { setsTimed: timed.length, workSec: Math.round(work / 1000), restSec: Math.round(rest / 1000) };
}

export function flattenSlots(program){
  const slots = [];
  (program.weeks || []).forEach((w, wi) => (w.days || []).forEach((d, di) => slots.push({ week: wi, day: di })));
  return slots;
}

export function nextSlot(program, sessions){
  const slots = flattenSlots(program);
  if (!slots.length) return { week: 0, day: 0, index: 0, total: 0, cycle: 0 };
  const done = (sessions || []).filter((s) => s.programId === program.id).length;
  const pos = done % slots.length;
  return { week: slots[pos].week, day: slots[pos].day, index: done, total: slots.length, cycle: Math.floor(done / slots.length) };
}

export function durationMin(startTs, endTs){
  if (!startTs || !endTs) return null;
  const m = Math.round((endTs - startTs) / 60000);
  return m >= 0 ? m : null;
}

export function sessionVolume(entries){
  let kg = 0;
  for (const id in entries){
    const e = entries[id] || {};
    const w = Number(e.w), r = Number(e.reps);
    if (Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0) kg += w * r;
  }
  return Math.round(kg);
}

/* ───── Время / формат ───── */
function tsToHHMM(ts){ const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function hhmmToTs(hhmm, baseTs){
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(baseTs || Date.now()); d.setHours(h, m, 0, 0);
  let ts = d.getTime();
  if (baseTs && ts < baseTs) ts += 24 * 3600 * 1000;
  return ts;
}
function clock(sec){ sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + String(s).padStart(2, "0"); }
function plSets(n){ const a = n % 100, b = n % 10; if (a > 10 && a < 20) return "подходов"; if (b === 1) return "подход"; if (b >= 2 && b <= 4) return "подхода"; return "подходов"; }

/* ───── Хранение ───── */
function getSessions(){ return get(KEYS.sessions, []); }
function saveSessions(list){ set(KEYS.sessions, list); }
function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }

function lastBodyweight(){
  const w = get(KEYS.weight, []);
  if (w.length) return w[0].kg;
  const s = getSessions().find((x) => x.bw);
  return s ? s.bw : "";
}

/* ───── Состояние UI ───── */
let tab = "plan";
let weekIdx = 0;
let dayIdx = 0;
let autoApplied = false;
let draft = null;          // активная/редактируемая тренировка (+ exIdx — текущее упражнение)
let openSession = null;
let timerInt = null;       // интервал «живого» таймера активного подхода

export function initJournal(root){
  autoApplied = false;
  root.addEventListener("click", (e) => onClick(e, root));
  root.addEventListener("change", (e) => onChange(e, root));
  root.addEventListener("input", (e) => onInput(e, root));
  renderJournal(root);
}

function activeProgram(){
  const programs = getPrograms();
  if (!programs.length) return null;
  let id = get(KEYS.active, null);
  let p = programs.find((x) => x.id === id);
  if (!p){ p = programs[0]; set(KEYS.active, p.id); }
  return p;
}

function maxesNow(){
  const raw = get(KEYS.maxes, {});
  const m = {};
  for (const k in raw) m[k] = parseNum(raw[k]);
  return m;
}

function dayName(program, wi, di){
  const w = program.weeks[wi];
  const d = w && w.days ? w.days[di] : null;
  return d && d.name ? d.name : "День " + (di + 1);
}

export function renderJournal(root){
  const program = activeProgram();
  if (!program){
    root.innerHTML = '<div class="placeholder"><p>Сначала создайте программу в разделе «Программы».</p>' +
      '<a class="btn-link" href="#programs">→ К программам</a></div>';
    return;
  }
  if (!autoApplied){
    const ns = nextSlot(program, getSessions());
    weekIdx = ns.week; dayIdx = ns.day; autoApplied = true;
  }
  if (weekIdx >= program.weeks.length) weekIdx = 0;
  const days = program.weeks[weekIdx] && program.weeks[weekIdx].days ? program.weeks[weekIdx].days.length : 0;
  if (dayIdx >= days) dayIdx = 0;

  const programs = getPrograms();
  const sel = '<label class="pf"><span>Программа</span><select data-act="setactive">' +
    programs.map((p) => '<option value="' + p.id + '"' + (p.id === program.id ? " selected" : "") + '>' + escapeHtml(p.name) + '</option>').join("") +
    '</select></label>';

  const tabs = '<div class="jtabs">' + tabBtn("plan", "План") + tabBtn("fact", "Факт") + tabBtn("history", "История") + '</div>';

  let body = "";
  if (tab === "plan")    body = planBody(program);
  if (tab === "fact")    body = factBody(program);
  if (tab === "history") body = historyBody();

  root.innerHTML = sel + tabs + body;
  manageTick(root);
}

function tabBtn(id, label){
  return '<button type="button" class="jtab' + (tab === id ? " is-active" : "") + '" data-act="tab" data-tab="' + id + '">' + label + '</button>';
}

function weekPills(program){
  return '<div class="pills">' + program.weeks.map((w, i) =>
    '<button type="button" class="pill' + (i === weekIdx ? " is-active" : "") + '" data-act="week" data-wi="' + i + '">' +
      '<span class="pill__n">Неделя ' + (i + 1) + '</span>' + (w.kind ? '<span class="pill__sub">' + escapeHtml(w.kind) + '</span>' : '') +
    '</button>').join("") + '</div>';
}

function dayPills(program){
  const week = program.weeks[weekIdx];
  if (!week || !week.days) return "";
  return '<div class="pills pills--day">' + week.days.map((d, i) =>
    '<button type="button" class="pill' + (i === dayIdx ? " is-active" : "") + '" data-act="day" data-di="' + i + '">' +
      '<span class="pill__n">' + escapeHtml(d.name || ("День " + (i + 1))) + '</span></button>').join("") + '</div>';
}

function accList(acc){
  if (!acc || !acc.length) return "";
  return '<div class="exacc">Подсобки: ' + acc.map((a) =>
    escapeHtml(a.name) + ' ' + escapeHtml(String(a.sets)) + '×' + escapeHtml(String(a.reps))).join("; ") + '</div>';
}

/* ───── ПЛАН ───── */
function planBody(program){
  const plan = planForDay(program, maxesNow(), weekIdx, dayIdx);
  const body = plan.map((ex) =>
    '<div class="progex" style="--accent:' + ex.accent + '">' +
      '<div class="progex__name">' + escapeHtml(ex.name) + '</div>' +
      '<ol class="psets">' + ex.sets.map((s) =>
        '<li class="pset">' +
          '<span class="pset__pct">' + s.pct + '%</span>' +
          '<span class="pset__kg">' + (s.exact ? fmt(s.exact) + ' кг' : '—') + '</span>' +
          (s.exact && s.plate !== s.exact ? '<span class="pset__plate">≈ ' + fmt(s.plate) + '</span>' : '<span class="pset__plate"></span>') +
          '<span class="pset__reps">' + (s.reps === "макс" ? "макс" : s.reps + " раз") + '</span>' +
        '</li>').join("") + '</ol>' +
      accList(ex.acc) +
    '</div>').join("");
  return weekPills(program) + dayPills(program) +
    '<div class="prog">' + (body || '<p class="muted">В этом дне нет упражнений.</p>') + '</div>';
}

/* ───── ФАКТ ───── */
function factBody(program){
  if (!draft) return startBox(program);
  return editorBox();
}

function startBox(program){
  const ns = nextSlot(program, getSessions());
  return weekPills(program) + dayPills(program) +
    '<div class="startbox">' +
      '<p class="nexttrain">Следующая тренировка: <b>#' + (ns.index + 1) + '</b> · неделя ' + (weekIdx + 1) + ' · ' + escapeHtml(dayName(program, weekIdx, dayIdx)) + (ns.cycle ? ' <span class="muted">(круг ' + (ns.cycle + 1) + ')</span>' : '') + '</p>' +
      '<p class="muted">Выбрать другую — переключите неделю/день выше.</p>' +
      '<button class="primary" data-act="start">▶ Начать тренировку</button>' +
    '</div>';
}

function exPills(items, group){
  const idxs = items.map((it, i) => i).filter((i) => items[i].kind === group);
  if (!idxs.length) return "";
  const lbl = group === "main" ? "Основной блок" : "Подсобка";
  return '<div class="exgroup__lbl' + (group === "acc" ? " exgroup__lbl--acc" : "") + '">' + lbl + '</div>' +
    '<div class="expills">' + idxs.map((i) =>
      '<button type="button" class="expill' + (i === draft.exIdx ? " is-active" : "") + '" data-act="goex" data-it="' + i + '" style="--accent:' + (items[i].accent || "#8891a6") + '">' +
        escapeHtml(items[i].name) + '</button>').join("") + '</div>';
}

function editorBox(){
  const items = draft.items;
  if (draft.exIdx >= items.length) draft.exIdx = 0;
  const endTs = draft.endHHMM ? hhmmToTs(draft.endHHMM, draft.start) : Date.now();
  const title = draft.editId ? "Редактирование тренировки" : "неделя " + (draft.week + 1) + " · день " + (draft.day + 1);
  const st = restWorkStats(items);

  let exBlock = '<p class="muted">Нет упражнений.</p>';
  if (items.length){
    const ex = items[draft.exIdx];
    exBlock = '<div class="exblock" style="--accent:' + (ex.accent || "#8891a6") + '">' +
      '<div class="exblock__name">' + escapeHtml(ex.name) + ' <span class="exblock__pos">' + (draft.exIdx + 1) + '/' + items.length + ' · ' + (ex.kind === "main" ? "основное" : "подсобка") + '</span></div>' +
      ex.sets.map((s, si) => setRow(ex, draft.exIdx, s, si)).join("") +
    '</div>' +
    '<div class="expager">' +
      '<button class="hbtn" data-act="exprev"' + (draft.exIdx <= 0 ? " disabled" : "") + '>← пред</button>' +
      '<button class="hbtn" data-act="exnext"' + (draft.exIdx >= items.length - 1 ? " disabled" : "") + '>след →</button>' +
    '</div>';
  }

  return '<div class="factbar">' + escapeHtml(draft.programName || "программа") + ' · ' + title + '</div>' +
    '<section class="wsess">' +
      '<div class="wsess__row">' +
        '<label class="ff"><span>Вес тела, кг</span><input type="number" inputmode="decimal" step="0.1" min="0" data-bw value="' + escapeAttr(draft.bw) + '" placeholder="' + escapeAttr(lastBodyweight()) + '"></label>' +
        '<label class="ff"><span>Начало</span><input type="time" data-starttime value="' + (draft.start ? tsToHHMM(draft.start) : "") + '"></label>' +
        '<label class="ff"><span>Конец</span><input type="time" data-endtime value="' + escapeAttr(draft.endHHMM || "") + '"></label>' +
      '</div>' +
      '<div class="wdur muted">Длит.: <b id="factDur">' + fmtDuration(durationMin(draft.start, endTs)) + '</b> · под нагрузкой <b>' + clock(st.workSec) + '</b> · отдых <b>' + clock(st.restSec) + '</b></div>' +
    '</section>' +
    exPills(items, "main") + exPills(items, "acc") +
    exBlock +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="finish">' + (draft.editId ? "✓ Сохранить изменения" : "✓ Завершить тренировку") + '</button>' +
      '<button data-act="cancelfact">' + (draft.editId ? "Отмена" : "Отменить") + '</button>' +
    '</div>';
}

function qOptions(sel){
  return '<option value="">оценка</option>' + QUALITY.map((q, i) => {
    const v = i + 1;
    return '<option value="' + v + '"' + (String(sel) === String(v) ? " selected" : "") + '>' + v + ' — ' + q + '</option>';
  }).join("");
}
function errOptions(key, sel){
  const errors = getErrors();
  return '<option value="">ошибка…</option>' + (errors[key] || []).map((er) =>
    '<option value="' + er.id + '"' + (sel === er.id ? " selected" : "") + '>' + escapeHtml(er.name) + '</option>').join("");
}

function timerCtl(it, si, s){
  if (!s.st) return '<button type="button" class="hbtn rtbtn" data-act="timerstart" data-it="' + it + '" data-si="' + si + '">▶ Старт подхода</button>';
  if (!s.et) return '<button type="button" class="hbtn rtbtn rtbtn--stop" data-act="timerstop" data-it="' + it + '" data-si="' + si + '">■ Стоп</button>' +
    ' <span class="rt rt--run" id="rt_' + it + '_' + si + '">' + clock((Date.now() - s.st) / 1000) + '</span>';
  return '<span class="rt rt--done">⏱ ' + clock((s.et - s.st) / 1000) + '</span>' +
    ' <button type="button" class="hbtn rtbtn" data-act="timerreset" data-it="' + it + '" data-si="' + si + '" aria-label="Сбросить">⟳</button>';
}

function setRow(it, idx, s, si){
  const planLine = it.kind === "main"
    ? 'Подход ' + (si + 1) + ' · <b>' + s.planPct + '%</b> · план ' + (s.planExact ? fmt(s.planExact) + ' кг' : '—') + ' · ' + (s.planReps === "макс" ? "макс" : s.planReps + " раз")
    : 'Подход ' + (si + 1) + ' · план ' + (s.planReps != null ? (s.planReps === "макс" ? "макс" : s.planReps + " раз") : "—");
  const wPlaceholder = it.kind === "main" && s.planPlate ? fmt(s.planPlate) : "";
  const repsPlaceholder = s.planReps === "макс" ? "макс" : (s.planReps != null ? s.planReps : "");
  const chips = (it.kind === "main" && s.planExact)
    ? '<div class="chips">' + plateOptions(s.planExact).map((v) => '<button type="button" class="chip" data-chip="' + idx + '_' + si + '" data-w="' + v + '">' + fmt(v) + '</button>').join("") + '</div>'
    : "";
  const row2 = it.kind === "main"
    ? '<div class="fset__row2"><select data-it="' + idx + '" data-si="' + si + '" data-field="err">' + errOptions(it.key, s.err) + '</select>' +
      '<input data-it="' + idx + '" data-si="' + si + '" data-field="note" value="' + escapeAttr(s.note) + '" placeholder="заметка"></div>'
    : '<div class="fset__row2 fset__row2--acc"><input data-it="' + idx + '" data-si="' + si + '" data-field="note" value="' + escapeAttr(s.note) + '" placeholder="заметка"></div>';
  return '<div class="fset">' +
    '<div class="fset__plan">' + planLine + '</div>' +
    '<div class="fset__row">' +
      '<label class="ff"><span>Вес</span><input type="number" inputmode="decimal" step="0.5" min="0" data-it="' + idx + '" data-si="' + si + '" data-field="w" value="' + escapeAttr(s.w) + '" placeholder="' + wPlaceholder + '"></label>' +
      '<label class="ff"><span>Повт</span><input type="number" inputmode="numeric" min="0" data-it="' + idx + '" data-si="' + si + '" data-field="reps" value="' + escapeAttr(s.reps) + '" placeholder="' + repsPlaceholder + '"></label>' +
      '<label class="ff"><span>Качество</span><select data-it="' + idx + '" data-si="' + si + '" data-field="q">' + qOptions(s.q) + '</select></label>' +
    '</div>' + chips + row2 +
    '<div class="rtrow">' + timerCtl(idx, si, s) + '</div>' +
  '</div>';
}

/* ───── История ───── */
function historyBody(){
  const list = getSessions();
  if (!list.length) return '<p class="muted">Пока нет завершённых тренировок.</p>';
  return list.map((s) => {
    const open = openSession === s.id;
    const where = 'неделя ' + (s.week + 1) + (s.day != null ? ' · день ' + (s.day + 1) : '');
    const extra = (s.durationMin != null ? ' · ' + fmtDuration(s.durationMin) : '') +
      (s.setsTimed ? ' · ⏱ ' + clock(s.workSec) + '/' + clock(s.restSec) : '') +
      (s.bw ? ' · вес ' + fmt(Number(s.bw)) + ' кг' : '');
    const canEdit = Array.isArray(s.items);
    return '<div class="srow">' +
      '<div class="srow__head" data-act="opensession" data-id="' + s.id + '">' +
        '<div><b>' + escapeHtml(s.programName) + '</b> · ' + where + '</div>' +
        '<div class="srow__meta">' + fmtDateTime(s.ts) + ' · Σ ' + fmt(s.volume) + ' кг' + extra + '</div>' +
      '</div>' + (open ? sessionDetail(s) : "") +
      '<div class="srow__act">' +
        (canEdit ? '<button class="hbtn" data-act="editsession" data-id="' + s.id + '">Изменить</button>' : '') +
        '<button class="hbtn hbtn--del" data-act="delsession" data-id="' + s.id + '">Удалить</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function sessionDetail(s){
  if (Array.isArray(s.items)){
    return '<div class="sdetail">' + s.items.map((it) =>
      '<div class="sline"><b>' + escapeHtml(it.name) + '</b>: ' + it.sets.map((st) =>
        (st.w ? fmt(Number(st.w)) + " кг" : "—") + "×" + (st.reps || "—") + (st.q ? " (" + QUALITY[Number(st.q) - 1] + ")" : "") +
        (st.st && st.et ? " ⏱" + clock((st.et - st.st) / 1000) : "")).join(", ") + '</div>').join("") + '</div>';
  }
  const errors = getErrors();
  const e = s.entries || {};
  return '<div class="sdetail">' + Object.keys(e).map((id) => {
    const rec = e[id]; const key = id.split(".")[0];
    const er = (errors[key] || []).find((x) => x.id === rec.err);
    return '<div class="sline">' + (LIFT_BY_KEY[key] ? LIFT_BY_KEY[key].short : key) + ': ' +
      (rec.w ? fmt(Number(rec.w)) + " кг" : "—") + " × " + (rec.reps || "—") +
      (rec.q ? " · " + QUALITY[Number(rec.q) - 1] : "") + (er ? " · " + escapeHtml(er.name) : "") +
      (rec.note ? " · «" + escapeHtml(rec.note) + "»" : "") + '</div>';
  }).join("") + '</div>';
}

/* ───── Загрузка тренировки в редактор ───── */
function sessionToDraft(s){
  return {
    editId: s.id, programId: s.programId, programName: s.programName,
    week: s.week, day: s.day, bw: s.bw != null ? s.bw : "",
    start: s.start || null, endHHMM: s.end ? tsToHHMM(s.end) : "",
    items: deepCopy(s.items || []), exIdx: 0,
  };
}

/* ───── Живой таймер активного подхода ───── */
function manageTick(root){
  if (timerInt){ clearInterval(timerInt); timerInt = null; }
  if (tab !== "fact" || !draft || !draft.items) return;
  const ex = draft.items[draft.exIdx];
  if (!ex || !ex.sets.some((s) => s.st && !s.et)) return;
  timerInt = setInterval(() => {
    ex.sets.forEach((s, si) => {
      if (s.st && !s.et){ const el = root.querySelector("#rt_" + draft.exIdx + "_" + si); if (el) el.textContent = clock((Date.now() - s.st) / 1000); }
    });
  }, 1000);
}

/* ───── События ───── */
function onClick(e, root){
  const btn = e.target.closest("[data-act], .chip");
  if (!btn) return;

  if (btn.classList.contains("chip")){
    if (!draft) return;
    const [it, si] = btn.dataset.chip.split("_").map(Number);
    if (draft.items[it] && draft.items[it].sets[si]){
      draft.items[it].sets[si].w = btn.dataset.w;
      const inp = root.querySelector('input[data-it="' + it + '"][data-si="' + si + '"][data-field="w"]');
      if (inp) inp.value = btn.dataset.w;
    }
    return;
  }
  const act = btn.dataset.act;
  if (act === "tab"){ tab = btn.dataset.tab; renderJournal(root); return; }
  if (act === "week"){ weekIdx = Number(btn.dataset.wi); dayIdx = 0; renderJournal(root); return; }
  if (act === "day"){ dayIdx = Number(btn.dataset.di); renderJournal(root); return; }
  if (act === "goex"){ draft.exIdx = Number(btn.dataset.it); renderJournal(root); return; }
  if (act === "exprev"){ if (draft.exIdx > 0) draft.exIdx--; renderJournal(root); return; }
  if (act === "exnext"){ if (draft.exIdx < draft.items.length - 1) draft.exIdx++; renderJournal(root); return; }
  if (act === "timerstart"){ const s = draft.items[Number(btn.dataset.it)].sets[Number(btn.dataset.si)]; s.st = Date.now(); s.et = null; renderJournal(root); return; }
  if (act === "timerstop"){ draft.items[Number(btn.dataset.it)].sets[Number(btn.dataset.si)].et = Date.now(); renderJournal(root); return; }
  if (act === "timerreset"){ const s = draft.items[Number(btn.dataset.it)].sets[Number(btn.dataset.si)]; delete s.st; delete s.et; renderJournal(root); return; }
  if (act === "start"){
    const p = activeProgram();
    const items = buildDayItems(p, maxesNow(), weekIdx, dayIdx);
    draft = { programId: p.id, programName: p.name, week: weekIdx, day: dayIdx, bw: lastBodyweight(), start: Date.now(), endHHMM: "", items, exIdx: 0 };
    renderJournal(root); return;
  }
  if (act === "cancelfact"){ if (confirm(draft && draft.editId ? "Отменить правки?" : "Отменить тренировку без сохранения?")){ draft = null; renderJournal(root); } return; }
  if (act === "finish"){ finishSession(); renderJournal(root); return; }
  if (act === "opensession"){ openSession = openSession === btn.dataset.id ? null : btn.dataset.id; renderJournal(root); return; }
  if (act === "editsession"){
    const s = getSessions().find((x) => x.id === btn.dataset.id);
    if (s && Array.isArray(s.items)){ draft = sessionToDraft(s); tab = "fact"; renderJournal(root); }
    return;
  }
  if (act === "delsession"){ saveSessions(getSessions().filter((s) => s.id !== btn.dataset.id)); renderJournal(root); return; }
}

function onChange(e, root){
  const t = e.target;
  if (t.dataset.act === "setactive"){ set(KEYS.active, t.value); weekIdx = 0; dayIdx = 0; autoApplied = false; draft = null; renderJournal(root); return; }
  if (t.dataset.it != null && draft){ setItemField(t); }
}
function onInput(e, root){
  const t = e.target;
  if (!draft) return;
  if (t.dataset.bw != null){ draft.bw = t.value; return; }
  if (t.dataset.starttime != null){ const ts = hhmmToTs(t.value, draft.start || Date.now()); if (ts) draft.start = ts; liveDur(root); return; }
  if (t.dataset.endtime != null){ draft.endHHMM = t.value; liveDur(root); return; }
  if (t.dataset.it != null){ setItemField(t); }
}

function setItemField(t){
  const it = Number(t.dataset.it), si = Number(t.dataset.si);
  if (draft.items[it] && draft.items[it].sets[si]) draft.items[it].sets[si][t.dataset.field] = t.value;
}

function liveDur(root){
  if (!draft) return;
  const el = root.querySelector("#factDur"); if (!el) return;
  const end = draft.endHHMM ? hhmmToTs(draft.endHHMM, draft.start) : Date.now();
  el.textContent = fmtDuration(durationMin(draft.start, end));
}

function finishSession(){
  if (!draft) return;
  const items = finalizeItems(draft.items);
  const end = draft.endHHMM ? hhmmToTs(draft.endHHMM, draft.start) : Date.now();
  const bw = parseNum(draft.bw);
  const stats = restWorkStats(items);
  const base = {
    programId: draft.programId, programName: draft.programName,
    week: draft.week, day: draft.day,
    bw: bw > 0 ? bw : null,
    start: draft.start || null, end: end || null, durationMin: durationMin(draft.start, end),
    items, volume: itemsVolume(items),
    workSec: stats.workSec, restSec: stats.restSec, setsTimed: stats.setsTimed,
  };
  const list = getSessions();
  if (draft.editId){
    const i = list.findIndex((s) => s.id === draft.editId);
    if (i >= 0) list[i] = { ...list[i], ...base };
    saveSessions(list);
  } else {
    list.unshift({ id: "s" + Date.now(), ts: Date.now(), ...base });
    if (list.length > 200) list.length = 200;
    saveSessions(list);
    if (bw > 0) set(KEYS.weight, addWeightEntry(get(KEYS.weight, []), bw, end || Date.now()));
  }
  draft = null;
  autoApplied = false;
  tab = "history";
}
