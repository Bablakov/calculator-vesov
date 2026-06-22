// Раздел «Журнал»: ПЛАН (просмотр) + ФАКТ (дневник) + история тренировок.
// Навигация по неделям и дням программы.
import { get, set, KEYS } from "./store.js";
import { LIFT_BY_KEY, QUALITY } from "./config.js";
import { ERRORS } from "./content.js";
import { getPrograms } from "./programs.js";
import { parseNum, round1, round2_5, fmt, plateOptions, fmtDateTime, escapeAttr, escapeHtml } from "./util.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// План на день: для каждого упражнения дня — подходы с весом от 1ПМ + подсобки.
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
        return { si, pct: s.pct, reps: s.reps, exact: max > 0 ? round1(raw) : 0, plate: max > 0 ? round2_5(raw) : 0 };
      }),
      acc: (ex.acc || []).map((a) => ({ name: a.name, sets: a.sets, reps: a.reps })),
    };
  });
}

export function factId(key, si){ return key + "." + si; }

// Объём тренировки: Σ (факт.вес × факт.повторы) по заполненным подходам, кг.
export function sessionVolume(entries){
  let kg = 0;
  for (const id in entries){
    const e = entries[id] || {};
    const w = Number(e.w), r = Number(e.reps);
    if (Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0) kg += w * r;
  }
  return Math.round(kg);
}

/* ───── Хранение ───── */
function getSessions(){ return get(KEYS.sessions, []); }
function saveSessions(list){ set(KEYS.sessions, list); }

/* ───── Состояние UI ───── */
let tab = "plan";          // plan | fact | history
let weekIdx = 0;
let dayIdx = 0;
let draft = null;          // активная тренировка: { programId, week, day, entries }
let openSession = null;    // раскрытая запись истории

export function initJournal(root){
  root.addEventListener("click", (e) => onClick(e, root));
  root.addEventListener("change", (e) => onChange(e, root));
  root.addEventListener("input", (e) => onInput(e));
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
  if (weekIdx >= program.weeks.length) weekIdx = 0;
  const days = program.weeks[weekIdx] && program.weeks[weekIdx].days ? program.weeks[weekIdx].days.length : 0;
  if (dayIdx >= days) dayIdx = 0;

  const programs = getPrograms();
  const sel = '<label class="pf"><span>Программа</span><select data-act="setactive">' +
    programs.map((p) => '<option value="' + p.id + '"' + (p.id === program.id ? " selected" : "") + '>' + escapeHtml(p.name) + '</option>').join("") +
    '</select></label>';

  const tabs = '<div class="jtabs">' +
    tabBtn("plan", "План") + tabBtn("fact", "Факт") + tabBtn("history", "История") + '</div>';

  let body = "";
  if (tab === "plan")    body = planBody(program);
  if (tab === "fact")    body = factBody(program);
  if (tab === "history") body = historyBody();

  root.innerHTML = sel + tabs + body;
}

function tabBtn(id, label){
  return '<button type="button" class="jtab' + (tab === id ? " is-active" : "") + '" data-act="tab" data-tab="' + id + '">' + label + '</button>';
}

function weekPills(program){
  return '<div class="pills">' + program.weeks.map((w, i) =>
    '<button type="button" class="pill' + (i === weekIdx ? " is-active" : "") + '" data-act="week" data-wi="' + i + '">' +
      '<span class="pill__n">Неделя ' + (i + 1) + '</span>' +
      (w.kind ? '<span class="pill__sub">' + escapeHtml(w.kind) + '</span>' : '') +
    '</button>').join("") + '</div>';
}

function dayPills(program){
  const week = program.weeks[weekIdx];
  if (!week || !week.days) return "";
  return '<div class="pills pills--day">' + week.days.map((d, i) =>
    '<button type="button" class="pill' + (i === dayIdx ? " is-active" : "") + '" data-act="day" data-di="' + i + '">' +
      '<span class="pill__n">' + escapeHtml(d.name || ("День " + (i + 1))) + '</span>' +
    '</button>').join("") + '</div>';
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
  const isActive = draft && draft.programId === program.id;
  if (!isActive){
    return weekPills(program) + dayPills(program) +
      '<div class="startbox">' +
        '<p class="muted">«' + escapeHtml(program.name) + '» · неделя ' + (weekIdx + 1) + ' · ' + escapeHtml(dayName(program, weekIdx, dayIdx)) + '.</p>' +
        '<button class="primary" data-act="start">▶ Начать тренировку</button>' +
      '</div>';
  }
  const plan = planForDay(program, maxesNow(), draft.week, draft.day);
  const errOptsFor = (key) => '<option value="">ошибка…</option>' +
    (ERRORS[key] || []).map((er) => '<option value="' + er.id + '">' + er.name + '</option>').join("");
  const qOpts = '<option value="">оценка</option>' + QUALITY.map((q, i) => '<option value="' + (i + 1) + '">' + (i + 1) + ' — ' + q + '</option>').join("");

  const blocks = plan.map((ex) =>
    '<div class="progex" style="--accent:' + ex.accent + '">' +
      '<div class="progex__name">' + escapeHtml(ex.name) + '</div>' +
      ex.sets.map((s) => factSet(ex.key, s, qOpts, errOptsFor(ex.key))).join("") +
      accList(ex.acc) +
    '</div>').join("");

  return '<div class="factbar">Неделя ' + (draft.week + 1) + ' · ' + escapeHtml(dayName(program, draft.week, draft.day)) + ' · «' + escapeHtml(program.name) + '»</div>' +
    '<div class="prog">' + (blocks || '<p class="muted">В этом дне нет упражнений.</p>') + '</div>' +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="finish">✓ Завершить тренировку</button>' +
      '<button data-act="cancelfact">Отменить</button>' +
    '</div>';
}

function factSet(key, s, qOpts, errOpts){
  const id = factId(key, s.si);
  const rec = (draft.entries && draft.entries[id]) || {};
  const chips = plateOptions(s.exact).map((v) => '<button type="button" class="chip" data-chip="' + id + '" data-w="' + v + '">' + fmt(v) + '</button>').join("");
  const qSel = qOpts.replace('value="' + rec.q + '"', 'value="' + rec.q + '" selected');
  const errSel = rec.err ? errOpts.replace('value="' + rec.err + '"', 'value="' + rec.err + '" selected') : errOpts;
  return '<div class="fset">' +
    '<div class="fset__plan">Подход ' + (s.si + 1) + ' · <b>' + s.pct + '%</b> · план ' + (s.exact ? fmt(s.exact) + ' кг' : '—') + ' · ' + (s.reps === "макс" ? "макс" : s.reps + " раз") + '</div>' +
    '<div class="fset__row">' +
      '<label class="ff"><span>Вес</span><input type="number" inputmode="decimal" step="0.5" min="0" data-fact="' + id + '" data-field="w" value="' + escapeAttr(rec.w) + '" placeholder="' + (s.exact ? fmt(s.plate) : "") + '"></label>' +
      '<label class="ff"><span>Повт</span><input type="number" inputmode="numeric" min="0" data-fact="' + id + '" data-field="reps" value="' + escapeAttr(rec.reps) + '" placeholder="' + (s.reps === "макс" ? "макс" : s.reps) + '"></label>' +
      '<label class="ff"><span>Качество</span><select data-fact="' + id + '" data-field="q">' + qSel + '</select></label>' +
    '</div>' +
    '<div class="chips">' + chips + '</div>' +
    '<div class="fset__row2">' +
      '<select data-fact="' + id + '" data-field="err">' + errSel + '</select>' +
      '<input data-fact="' + id + '" data-field="note" value="' + escapeAttr(rec.note) + '" placeholder="заметка (необязательно)">' +
    '</div>' +
  '</div>';
}

/* ───── История ───── */
function historyBody(){
  const list = getSessions();
  if (!list.length) return '<p class="muted">Пока нет завершённых тренировок.</p>';
  return list.map((s) => {
    const open = openSession === s.id;
    let detail = "";
    if (open){
      detail = '<div class="sdetail">' + Object.keys(s.entries).map((id) => {
        const e = s.entries[id]; const key = id.split(".")[0];
        const er = (ERRORS[key] || []).find((x) => x.id === e.err);
        return '<div class="sline">' + (LIFT_BY_KEY[key] ? LIFT_BY_KEY[key].short : key) + ': ' +
          (e.w ? fmt(Number(e.w)) + ' кг' : '—') + ' × ' + (e.reps || '—') +
          (e.q ? ' · ' + QUALITY[Number(e.q) - 1] : '') +
          (er ? ' · ' + escapeHtml(er.name) : '') +
          (e.note ? ' · «' + escapeHtml(e.note) + '»' : '') + '</div>';
      }).join("") + '</div>';
    }
    const where = 'неделя ' + (s.week + 1) + (s.day != null ? ' · день ' + (s.day + 1) : '');
    return '<div class="srow">' +
      '<div class="srow__head" data-act="opensession" data-id="' + s.id + '">' +
        '<div><b>' + escapeHtml(s.programName) + '</b> · ' + where + '</div>' +
        '<div class="srow__meta">' + fmtDateTime(s.ts) + ' · Σ ' + fmt(s.volume) + ' кг</div>' +
      '</div>' + detail +
      '<div class="srow__act"><button class="hbtn hbtn--del" data-act="delsession" data-id="' + s.id + '">Удалить</button></div>' +
    '</div>';
  }).join("");
}

/* ───── События ───── */
function onClick(e, root){
  const btn = e.target.closest("[data-act], .chip");
  if (!btn) return;

  if (btn.classList.contains("chip")){
    const inp = root.querySelector('input[data-fact="' + btn.dataset.chip + '"][data-field="w"]');
    if (inp){ inp.value = btn.dataset.w; setEntry(btn.dataset.chip, "w", btn.dataset.w); }
    return;
  }
  const act = btn.dataset.act;
  if (act === "tab"){ tab = btn.dataset.tab; renderJournal(root); return; }
  if (act === "week"){ weekIdx = Number(btn.dataset.wi); dayIdx = 0; renderJournal(root); return; }
  if (act === "day"){ dayIdx = Number(btn.dataset.di); renderJournal(root); return; }
  if (act === "start"){
    const p = activeProgram();
    draft = { programId: p.id, week: weekIdx, day: dayIdx, entries: {} };
    renderJournal(root); return;
  }
  if (act === "cancelfact"){ if (confirm("Отменить тренировку без сохранения?")){ draft = null; renderJournal(root); } return; }
  if (act === "finish"){ finishSession(); renderJournal(root); return; }
  if (act === "opensession"){ openSession = openSession === btn.dataset.id ? null : btn.dataset.id; renderJournal(root); return; }
  if (act === "delsession"){ saveSessions(getSessions().filter((s) => s.id !== btn.dataset.id)); renderJournal(root); return; }
}

function onChange(e, root){
  const t = e.target;
  if (t.dataset.act === "setactive"){ set(KEYS.active, t.value); weekIdx = 0; dayIdx = 0; renderJournal(root); return; }
  if (t.dataset.fact){ setEntry(t.dataset.fact, t.dataset.field, t.value); }
}
function onInput(e){
  const t = e.target;
  if (t.dataset.fact && (t.dataset.field === "w" || t.dataset.field === "reps" || t.dataset.field === "note")){
    setEntry(t.dataset.fact, t.dataset.field, t.value);
  }
}

function setEntry(id, field, value){
  if (!draft) return;
  const rec = draft.entries[id] || (draft.entries[id] = {});
  if (value === "" || value == null) delete rec[field]; else rec[field] = value;
}

function finishSession(){
  if (!draft) return;
  const program = getPrograms().find((p) => p.id === draft.programId);
  const session = {
    id: "s" + Date.now(), ts: Date.now(),
    programId: draft.programId,
    programName: program ? program.name : "программа",
    week: draft.week,
    day: draft.day,
    entries: draft.entries,
    volume: sessionVolume(draft.entries),
  };
  const list = getSessions();
  list.unshift(session);
  if (list.length > 200) list.length = 200;
  saveSessions(list);
  draft = null;
  tab = "history";
}
