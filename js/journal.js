// Раздел «Журнал»: ПЛАН (просмотр программы) + ФАКТ (дневник) + история тренировок.
import { get, set, KEYS } from "./store.js";
import { LIFT_BY_KEY, QUALITY } from "./config.js";
import { ERRORS } from "./content.js";
import { liftsForType, getPrograms } from "./programs.js";
import { parseNum, fmt, plateOptions, fmtDateTime, escapeAttr, escapeHtml } from "./util.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// План на неделю: для каждого упражнения программы — подходы с весом от 1ПМ.
export function planForWeek(program, maxes, weekIndex){
  const week = program.weeks[weekIndex];
  if (!week) return [];
  return liftsForType(program.type, program.lift).map((key) => {
    const max = Number(maxes[key]) || 0;
    return {
      key, name: LIFT_BY_KEY[key].name, accent: LIFT_BY_KEY[key].accent,
      sets: week.sets.map((s, si) => {
        const raw = max * s.pct / 100;
        return { si, pct: s.pct, reps: s.reps, exact: max > 0 ? Math.round(raw * 10) / 10 : 0, plate: max > 0 ? Math.round(raw / 2.5) * 2.5 : 0 };
      }),
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
let draft = null;          // активная тренировка: { programId, week, entries }
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

export function renderJournal(root){
  const program = activeProgram();
  if (!program){
    root.innerHTML = '<div class="placeholder"><p>Сначала создайте программу в разделе «Программы».</p>' +
      '<a class="btn-link" href="#programs">→ К программам</a></div>';
    return;
  }
  if (weekIdx >= program.weeks.length) weekIdx = 0;

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

/* ───── ПЛАН ───── */
function planBody(program){
  const plan = planForWeek(program, maxesNow(), weekIdx);
  const body = plan.map((ex) =>
    '<div class="progex" style="--accent:' + ex.accent + '">' +
      '<div class="progex__name">' + ex.name + '</div>' +
      '<ol class="psets">' + ex.sets.map((s) =>
        '<li class="pset">' +
          '<span class="pset__pct">' + s.pct + '%</span>' +
          '<span class="pset__kg">' + (s.exact ? fmt(s.exact) + ' кг' : '—') + '</span>' +
          (s.exact && s.plate !== s.exact ? '<span class="pset__plate">≈ ' + fmt(s.plate) + '</span>' : '<span class="pset__plate"></span>') +
          '<span class="pset__reps">' + (s.reps === "макс" ? "макс" : s.reps + " раз") + '</span>' +
        '</li>').join("") + '</ol>' +
    '</div>').join("");
  return weekPills(program) + '<div class="prog">' + body + '</div>';
}

/* ───── ФАКТ ───── */
function factBody(program){
  const isActive = draft && draft.programId === program.id;
  if (!isActive){
    return weekPills(program) +
      '<div class="startbox">' +
        '<p class="muted">Тренировка по программе «' + escapeHtml(program.name) + '», неделя ' + (weekIdx + 1) + '.</p>' +
        '<button class="primary" data-act="start">▶ Начать тренировку</button>' +
      '</div>';
  }
  const plan = planForWeek(program, maxesNow(), draft.week);
  const errOptsFor = (key) => '<option value="">ошибка…</option>' +
    (ERRORS[key] || []).map((er) => '<option value="' + er.id + '">' + er.name + '</option>').join("");
  const qOpts = '<option value="">оценка</option>' + QUALITY.map((q, i) => '<option value="' + (i + 1) + '">' + (i + 1) + ' — ' + q + '</option>').join("");

  const blocks = plan.map((ex) =>
    '<div class="progex" style="--accent:' + ex.accent + '">' +
      '<div class="progex__name">' + ex.name + '</div>' +
      ex.sets.map((s) => factSet(ex.key, s, qOpts, errOptsFor(ex.key))).join("") +
    '</div>').join("");

  return '<div class="factbar">Неделя ' + (draft.week + 1) + ' · программа «' + escapeHtml(program.name) + '»</div>' +
    '<div class="prog">' + blocks + '</div>' +
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
    return '<div class="srow">' +
      '<div class="srow__head" data-act="opensession" data-id="' + s.id + '">' +
        '<div><b>' + escapeHtml(s.programName) + '</b> · неделя ' + (s.week + 1) + '</div>' +
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
  if (act === "week"){ weekIdx = Number(btn.dataset.wi); renderJournal(root); return; }
  if (act === "start"){
    const p = activeProgram();
    draft = { programId: p.id, week: weekIdx, entries: {} };
    renderJournal(root); return;
  }
  if (act === "cancelfact"){ if (confirm("Отменить тренировку без сохранения?")){ draft = null; renderJournal(root); } return; }
  if (act === "finish"){ finishSession(); renderJournal(root); return; }
  if (act === "opensession"){ openSession = openSession === btn.dataset.id ? null : btn.dataset.id; renderJournal(root); return; }
  if (act === "delsession"){ saveSessions(getSessions().filter((s) => s.id !== btn.dataset.id)); renderJournal(root); return; }
}

function onChange(e, root){
  const t = e.target;
  if (t.dataset.act === "setactive"){ set(KEYS.active, t.value); weekIdx = 0; renderJournal(root); return; }
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
