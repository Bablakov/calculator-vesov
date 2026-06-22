// Раздел «Программы»: список, мастер выбора (уровень → дисциплина → упор) и конструктор.
// Конструктор и превью — с навигацией неделя+день (по одному дню за раз), как в журнале.
import { get, set, KEYS } from "./store.js";
import { LIFTS, LIFT_BY_KEY } from "./config.js";
import { escapeAttr, escapeHtml } from "./util.js";
import {
  LEVELS, LEVEL_BY_KEY, DISCIPLINES, DISCIPLINE_BY_KEY,
  focusesFor, focusByKey, buildTemplate,
} from "./templates.js";
import { getAccDefaults } from "./contentstore.js";

/* ───── Чистая логика (покрыта тестами) ───── */

export function liftsForDiscipline(disciplineKey){
  const d = DISCIPLINE_BY_KEY[disciplineKey];
  return d ? d.lifts.slice() : ["squat", "bench", "deadlift"];
}

export function normReps(v){
  if (/макс/i.test(String(v))) return "макс";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : "";
}

export function validSet(s){
  const pctOk = Number.isFinite(Number(s.pct)) && Number(s.pct) > 0 && Number(s.pct) <= 100;
  const repsOk = s.reps === "макс" || (Number.isFinite(Number(s.reps)) && Number(s.reps) > 0);
  return pctOk && repsOk;
}

export function validProgram(p){
  if (!p || !p.name || !p.name.trim()) return false;
  if (!Array.isArray(p.weeks) || !p.weeks.length) return false;
  return p.weeks.every((w) =>
    Array.isArray(w.days) && w.days.length &&
    w.days.every((d) =>
      Array.isArray(d.exercises) && d.exercises.length &&
      d.exercises.every((ex) =>
        ex.key && Array.isArray(ex.sets) && ex.sets.length && ex.sets.every(validSet) &&
        (!ex.acc || ex.acc.every((a) => a && a.name && String(a.name).trim()))
      )
    )
  );
}

// Заготовки конструктора. Новые упражнения сразу с базовыми подсобками.
function defaultAcc(key){ return (getAccDefaults()[key] || []).map((a) => ({ ...a })); }
function newExercise(disciplineKey){
  const d = DISCIPLINE_BY_KEY[disciplineKey];
  const key = d && d.lifts[0] ? d.lifts[0] : "squat";
  return { key, sets: [ { pct: 70, reps: 5 } ], acc: defaultAcc(key) };
}
function newDay(i, disciplineKey){ return { name: "День " + (i + 1), exercises: [ newExercise(disciplineKey) ] }; }
// Новая неделя — по умолчанию 3 дня по сплиту дисциплины (движение на день).
function newWeek(disciplineKey){
  const d = DISCIPLINE_BY_KEY[disciplineKey];
  const layout = (d && d.days && d.days.length) ? d.days : ["squat"];
  return { kind: "", days: layout.map((key, i) => {
    const short = LIFT_BY_KEY[key] ? LIFT_BY_KEY[key].short : key;
    return { name: "День " + (i + 1) + " · " + short, exercises: [ { key, sets: [ { pct: 70, reps: 5 } ], acc: defaultAcc(key) } ] };
  }) };
}

// Пустая программа «с нуля»: 1 неделя × 3 дня (троеборье-сплит).
export function blankProgram(){
  return { id: null, name: "", level: "amateur", discipline: "pl", focus: "base", weeks: [ newWeek("pl") ] };
}

/* ───── Миграция старого формата (type/lift, weeks[{sets}]) → новый (weeks[{days}]) ───── */
function oldLifts(type, lift){
  if (type === "duathlon") return ["bench", "deadlift"];
  if (type === "single")   return [lift || "squat"];
  return ["squat", "bench", "deadlift"];
}
export function migrateProgram(p){
  if (!p || !Array.isArray(p.weeks)) return p;
  if (p.weeks.every((w) => w && Array.isArray(w.days))) {
    return { ...p, level: p.level || "amateur", discipline: p.discipline || "pl", focus: p.focus || "base" };
  }
  const lifts = oldLifts(p.type, p.lift);
  const discipline = p.type === "duathlon" ? "bp_dl"
    : p.type === "single" ? (p.lift === "bench" ? "bench" : p.lift === "deadlift" ? "deadlift" : "pl")
    : "pl";
  return {
    id: p.id, name: p.name || "Программа",
    level: "amateur", discipline, focus: "base",
    weeks: (p.weeks || []).map((w) => ({
      kind: w.kind || "",
      days: [ { name: "День 1", exercises: lifts.map((key) => ({ key, sets: (w.sets || []).map((s) => ({ pct: s.pct, reps: s.reps })), acc: [] })) } ],
    })),
  };
}

/* ───── Хранение ───── */
export function getPrograms(){ return get(KEYS.programs, []).map(migrateProgram); }
function savePrograms(list){ set(KEYS.programs, list); }
export function upsertProgram(prog){
  const list = getPrograms();
  const i = list.findIndex((p) => p.id === prog.id);
  if (i >= 0) list[i] = prog; else list.unshift(prog);
  savePrograms(list);
}
export function deleteProgram(id){
  savePrograms(getPrograms().filter((p) => p.id !== id));
  if (get(KEYS.active, null) === id) set(KEYS.active, null);
}

/* ───── UI ───── */
let mode = "list";   // list | wizard | edit
let wiz = null;      // { step, level, discipline, focus }
let draft = null;    // редактируемая программа
let error = "";
let cw = 0, cd = 0;  // текущие неделя/день в конструкторе
let pw = 0, pd = 0;  // текущие неделя/день в превью мастера

export function initPrograms(root){
  root.addEventListener("click", (e) => onClick(e, root));
  renderPrograms(root);
}

export function renderPrograms(root){
  if (mode === "wizard")    root.innerHTML = wizardHtml();
  else if (mode === "edit") root.innerHTML = formHtml();
  else                      root.innerHTML = listHtml();
}

/* ─── Список «Мои программы» ─── */
function metaLine(p){
  const disc  = DISCIPLINE_BY_KEY[p.discipline];
  const focus = focusByKey(p.discipline, p.focus);
  const lvl   = LEVEL_BY_KEY[p.level];
  const days  = p.weeks[0] && p.weeks[0].days ? p.weeks[0].days.length : 0;
  return [disc ? disc.name : "", focus ? focus.name : "", lvl ? lvl.name : "",
    p.weeks.length + " нед.", days ? days + " дн/нед" : ""].filter(Boolean).join(" · ");
}

function listHtml(){
  const mine = getPrograms();
  const mineHtml = mine.length
    ? mine.map((p) =>
        '<div class="prow">' +
          '<div class="prow__main"><b>' + escapeHtml(p.name) + '</b>' +
            '<span class="prow__meta">' + escapeHtml(metaLine(p)) + '</span></div>' +
          '<div class="prow__act">' +
            '<button class="hbtn" data-act="edit" data-id="' + p.id + '">Изменить</button>' +
            '<button class="hbtn hbtn--del" data-act="del" data-id="' + p.id + '" aria-label="Удалить">✕</button>' +
          '</div>' +
        '</div>').join("")
    : '<p class="muted">Пока нет программ. Создайте по шаблону — выберите уровень, дисциплину и упор.</p>';

  return '<div class="phead"><h2 class="section-title" style="margin:0">Мои программы</h2>' +
    '<button class="primary" data-act="wizard">+ Создать программу</button></div>' +
    mineHtml +
    '<button class="hbtn" data-act="blank" style="margin-top:6px">Создать с нуля</button>';
}

/* ─── Мастер выбора ─── */
function wizardHtml(){
  const crumbs = [];
  if (wiz.level)      crumbs.push(LEVEL_BY_KEY[wiz.level].name);
  if (wiz.discipline) crumbs.push(DISCIPLINE_BY_KEY[wiz.discipline].name);
  if (wiz.focus)      crumbs.push(focusByKey(wiz.discipline, wiz.focus).name);

  const head = '<div class="phead"><h2 class="section-title" style="margin:0">Новая программа</h2>' +
    '<button data-act="wizcancel">Отмена</button></div>' +
    (crumbs.length ? '<div class="wcrumb">' + crumbs.map((c) => '<span>' + escapeHtml(c) + '</span>').join("") + '</div>' : '');

  if (wiz.step === 1){
    return head + '<p class="muted wlbl">Шаг 1 — уровень подготовки</p>' +
      '<div class="wopts">' + LEVELS.map((l) =>
        '<button class="wopt" data-act="wlevel" data-key="' + l.key + '"><b>' + escapeHtml(l.name) + '</b><span>' + escapeHtml(l.note) + '</span></button>').join("") + '</div>';
  }
  if (wiz.step === 2){
    return head + '<p class="muted wlbl">Шаг 2 — дисциплина</p>' +
      '<div class="wopts">' + DISCIPLINES.map((d) =>
        '<button class="wopt" data-act="wdisc" data-key="' + d.key + '"><b>' + escapeHtml(d.name) + '</b><span>' +
          d.lifts.map((k) => LIFT_BY_KEY[k] ? LIFT_BY_KEY[k].short : k).join(" · ") + '</span></button>').join("") + '</div>' +
      '<button class="hbtn" data-act="wback" data-to="1">← Назад</button>';
  }
  if (wiz.step === 3){
    return head + '<p class="muted wlbl">Шаг 3 — упор цикла</p>' +
      '<div class="wopts">' + focusesFor(wiz.discipline).map((f) =>
        '<button class="wopt" data-act="wfocus" data-key="' + f.key + '"><b>' + escapeHtml(f.name) + '</b><span>' + escapeHtml(f.note || "") + '</span></button>').join("") + '</div>' +
      '<button class="hbtn" data-act="wback" data-to="2">← Назад</button>';
  }
  const prog = buildTemplate(wiz.level, wiz.discipline, wiz.focus);
  return head + '<p class="muted wlbl">Готовая программа — листайте недели/дни; возьмите за основу и отредактируйте</p>' +
    previewHtml(prog) +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="wtake">Взять за основу</button>' +
      '<button data-act="wback" data-to="3">← Назад</button>' +
    '</div>';
}

function previewHtml(prog){
  if (pw >= prog.weeks.length) pw = 0;
  const week = prog.weeks[pw];
  if (pd >= week.days.length) pd = 0;
  const day = week.days[pd];

  const wp = prog.weeks.map((w, wi) =>
    '<button type="button" class="pill' + (wi === pw ? " is-active" : "") + '" data-act="pvweek" data-wi="' + wi + '">' +
      '<span class="pill__n">Неделя ' + (wi + 1) + '</span>' + (w.kind ? '<span class="pill__sub">' + escapeHtml(w.kind) + '</span>' : '') + '</button>').join("");
  const dp = week.days.map((d, di) =>
    '<button type="button" class="pill' + (di === pd ? " is-active" : "") + '" data-act="pvday" data-di="' + di + '">' +
      '<span class="pill__n">' + escapeHtml(d.name || ("День " + (di + 1))) + '</span></button>').join("");

  const exs = day.exercises.map((ex) => {
    const lift = LIFT_BY_KEY[ex.key];
    return '<div class="ppex" style="--accent:' + (lift ? lift.accent : "#888") + '">' +
      '<div class="ppex__name">' + escapeHtml(lift ? lift.name : ex.key) + '</div>' +
      '<div class="ppsets">' + ex.sets.map((s) => '<span class="ppset">' + s.pct + '% × ' + (s.reps === "макс" ? "макс" : s.reps) + '</span>').join("") + '</div>' +
      ((ex.acc && ex.acc.length) ? '<div class="ppacc">Подсобки: ' + ex.acc.map((a) => escapeHtml(a.name) + ' ' + a.sets + '×' + a.reps).join("; ") + '</div>' : '') +
    '</div>';
  }).join("");

  return '<div class="pills">' + wp + '</div><div class="pills pills--day">' + dp + '</div><div class="ppday__box">' + exs + '</div>';
}

/* ─── Конструктор ─── */
function exEditor(disc, ex, ei){
  const lifts = disc ? disc.lifts : LIFTS.map((l) => l.key);
  const liftSel = '<select data-f="exkey" data-ei="' + ei + '">' +
    lifts.map((k) => '<option value="' + k + '"' + (ex.key === k ? " selected" : "") + '>' + (LIFT_BY_KEY[k] ? LIFT_BY_KEY[k].name : k) + '</option>').join("") + '</select>';
  const sets = ex.sets.map((s, si) =>
    '<div class="stp">' +
      '<input type="number" inputmode="numeric" min="1" max="100" data-f="pct" data-ei="' + ei + '" data-si="' + si + '" value="' + escapeAttr(s.pct) + '" placeholder="%">' +
      '<span class="stp__x">% ×</span>' +
      '<input data-f="reps" data-ei="' + ei + '" data-si="' + si + '" value="' + escapeAttr(s.reps) + '" placeholder="повт / макс">' +
      '<button class="hbtn hbtn--del" data-act="delset" data-ei="' + ei + '" data-si="' + si + '" aria-label="Удалить подход">✕</button>' +
    '</div>').join("");
  const accs = (ex.acc || []).map((a, ai) =>
    '<div class="accr">' +
      '<input class="accr__name" data-f="accname" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.name) + '" placeholder="название подсобки">' +
      '<input class="accr__n" type="number" inputmode="numeric" min="1" data-f="accsets" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.sets) + '" placeholder="подх">' +
      '<span class="stp__x">×</span>' +
      '<input class="accr__n" data-f="accreps" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.reps) + '" placeholder="повт">' +
      '<button class="hbtn hbtn--del" data-act="delacc" data-ei="' + ei + '" data-ai="' + ai + '" aria-label="Удалить подсобку">✕</button>' +
    '</div>').join("");
  return '<div class="ex">' +
    '<div class="ex__head">' + liftSel + '<button class="hbtn hbtn--del" data-act="delex" data-ei="' + ei + '" aria-label="Удалить упражнение">✕</button></div>' +
    '<div class="ex__sets">' + sets + '<button class="hbtn" data-act="addset" data-ei="' + ei + '">+ подход</button></div>' +
    '<div class="ex__acc"><div class="ex__acclbl">Подсобки</div>' + accs + '<button class="hbtn" data-act="addacc" data-ei="' + ei + '">+ подсобка</button></div>' +
  '</div>';
}

function formHtml(){
  const disc = DISCIPLINE_BY_KEY[draft.discipline];
  const focus = focusByKey(draft.discipline, draft.focus);
  const lvl = LEVEL_BY_KEY[draft.level];
  const metaInfo = [disc ? disc.name : "", focus ? focus.name : "", lvl ? lvl.name : ""].filter(Boolean).join(" · ");

  if (cw >= draft.weeks.length) cw = 0;
  const week = draft.weeks[cw];
  if (cd >= week.days.length) cd = 0;
  const day = week.days[cd];

  const weekPills = draft.weeks.map((w, wi) =>
    '<button type="button" class="pill' + (wi === cw ? " is-active" : "") + '" data-act="cweek" data-wi="' + wi + '">' +
      '<span class="pill__n">Неделя ' + (wi + 1) + '</span>' + (w.kind ? '<span class="pill__sub">' + escapeHtml(w.kind) + '</span>' : '') + '</button>').join("") +
    '<button type="button" class="pill pill--add" data-act="addweek">+ неделя</button>';
  const dayPills = week.days.map((d, di) =>
    '<button type="button" class="pill' + (di === cd ? " is-active" : "") + '" data-act="cday" data-di="' + di + '">' +
      '<span class="pill__n">' + escapeHtml(d.name || ("День " + (di + 1))) + '</span></button>').join("") +
    '<button type="button" class="pill pill--add" data-act="addday">+ день</button>';

  return '<div class="constructor">' +
    '<div class="phead"><h2 class="section-title" style="margin:0">' + (draft.id ? "Изменить программу" : "Новая программа") + '</h2></div>' +
    (error ? '<p class="form-err">' + escapeHtml(error) + '</p>' : '') +
    '<label class="pf"><span>Название</span><input data-f="name" value="' + escapeAttr(draft.name) + '" placeholder="Моя программа"></label>' +
    (metaInfo ? '<p class="cmeta">' + escapeHtml(metaInfo) + '</p>' : '') +
    '<div class="pills">' + weekPills + '</div>' +
    '<div class="wk__head">' +
      '<input class="wk__kind" data-f="kind" value="' + escapeAttr(week.kind) + '" placeholder="характер недели (средняя / тяжёлая…)">' +
      (draft.weeks.length > 1 ? '<button class="hbtn hbtn--del" data-act="delweek" aria-label="Удалить неделю">✕ неделя</button>' : '') +
    '</div>' +
    '<div class="pills pills--day">' + dayPills + '</div>' +
    '<div class="day">' +
      '<div class="day__head">' +
        '<input class="day__name" data-f="dayname" value="' + escapeAttr(day.name) + '" placeholder="название дня">' +
        (week.days.length > 1 ? '<button class="hbtn hbtn--del" data-act="delday" aria-label="Удалить день">✕ день</button>' : '') +
      '</div>' +
      day.exercises.map((ex, ei) => exEditor(disc, ex, ei)).join("") +
      '<button class="hbtn" data-act="addex">+ упражнение</button>' +
    '</div>' +
    '<p class="muted" style="margin:10px 0 0">Максимум 100% (105% — проходка, в программе не используется).</p>' +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="save">Сохранить</button>' +
      '<button data-act="cancel">Отмена</button>' +
    '</div>' +
  '</div>';
}

/* ─── Чтение текущего дня конструктора в draft ─── */
function syncForm(root){
  if (!draft) return;
  const nameEl = root.querySelector('[data-f="name"]'); if (nameEl) draft.name = nameEl.value;
  const week = draft.weeks[cw]; if (!week) return;
  const kindEl = root.querySelector('[data-f="kind"]'); if (kindEl) week.kind = kindEl.value;
  const day = week.days[cd]; if (!day) return;
  const dn = root.querySelector('[data-f="dayname"]'); if (dn) day.name = dn.value;
  day.exercises.forEach((ex, ei) => {
    const base = '[data-ei="' + ei + '"]';
    const ek = root.querySelector('[data-f="exkey"]' + base); if (ek) ex.key = ek.value;
    ex.sets.forEach((s, si) => {
      const p = root.querySelector('[data-f="pct"]' + base + '[data-si="' + si + '"]'); if (p) s.pct = Number(p.value);
      const r = root.querySelector('[data-f="reps"]' + base + '[data-si="' + si + '"]'); if (r) s.reps = normReps(r.value);
    });
    (ex.acc || []).forEach((a, ai) => {
      const an = root.querySelector('[data-f="accname"]' + base + '[data-ai="' + ai + '"]'); if (an) a.name = an.value;
      const as = root.querySelector('[data-f="accsets"]' + base + '[data-ai="' + ai + '"]'); if (as) a.sets = as.value;
      const ar = root.querySelector('[data-f="accreps"]' + base + '[data-ai="' + ai + '"]'); if (ar) a.reps = ar.value;
    });
  });
}

/* ─── События ─── */
function onClick(e, root){
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const ei = Number(btn.dataset.ei), si = Number(btn.dataset.si), ai = Number(btn.dataset.ai);

  // список
  if (act === "wizard"){ wiz = { step: 1, level: null, discipline: null, focus: null }; pw = 0; pd = 0; mode = "wizard"; error = ""; renderPrograms(root); return; }
  if (act === "blank"){ draft = blankProgram(); cw = 0; cd = 0; mode = "edit"; error = ""; renderPrograms(root); return; }
  if (act === "edit"){ const p = getPrograms().find((x) => x.id === btn.dataset.id); if (p){ draft = JSON.parse(JSON.stringify(p)); cw = 0; cd = 0; mode = "edit"; error = ""; renderPrograms(root); } return; }
  if (act === "del"){ if (confirm("Удалить программу?")){ deleteProgram(btn.dataset.id); renderPrograms(root); } return; }

  // мастер
  if (act === "wizcancel"){ wiz = null; mode = "list"; renderPrograms(root); return; }
  if (act === "wback"){ wiz.step = Number(btn.dataset.to); renderPrograms(root); return; }
  if (act === "wlevel"){ wiz.level = btn.dataset.key; wiz.step = 2; renderPrograms(root); return; }
  if (act === "wdisc"){ wiz.discipline = btn.dataset.key; wiz.focus = null; wiz.step = 3; renderPrograms(root); return; }
  if (act === "wfocus"){ wiz.focus = btn.dataset.key; pw = 0; pd = 0; wiz.step = 4; renderPrograms(root); return; }
  if (act === "pvweek"){ pw = Number(btn.dataset.wi); pd = 0; renderPrograms(root); return; }
  if (act === "pvday"){ pd = Number(btn.dataset.di); renderPrograms(root); return; }
  if (act === "wtake"){
    const prog = buildTemplate(wiz.level, wiz.discipline, wiz.focus, "p" + Date.now());
    upsertProgram(prog);
    wiz = null; draft = JSON.parse(JSON.stringify(prog)); cw = 0; cd = 0; mode = "edit"; error = "";
    renderPrograms(root); return;
  }

  // конструктор
  if (!draft) return;
  if (act === "cancel"){ mode = "list"; draft = null; error = ""; renderPrograms(root); return; }
  if (act === "cweek"){ syncForm(root); cw = Number(btn.dataset.wi); cd = 0; renderPrograms(root); return; }
  if (act === "cday"){ syncForm(root); cd = Number(btn.dataset.di); renderPrograms(root); return; }
  if (act === "addweek"){ syncForm(root); draft.weeks.push(newWeek(draft.discipline)); cw = draft.weeks.length - 1; cd = 0; renderPrograms(root); return; }
  if (act === "delweek"){ syncForm(root); if (draft.weeks.length > 1){ draft.weeks.splice(cw, 1); if (cw >= draft.weeks.length) cw = draft.weeks.length - 1; cd = 0; } renderPrograms(root); return; }
  if (act === "addday"){ syncForm(root); const wk = draft.weeks[cw]; wk.days.push(newDay(wk.days.length, draft.discipline)); cd = wk.days.length - 1; renderPrograms(root); return; }
  if (act === "delday"){ syncForm(root); const wk = draft.weeks[cw]; if (wk.days.length > 1){ wk.days.splice(cd, 1); if (cd >= wk.days.length) cd = wk.days.length - 1; } renderPrograms(root); return; }
  if (act === "addex"){ syncForm(root); draft.weeks[cw].days[cd].exercises.push(newExercise(draft.discipline)); renderPrograms(root); return; }
  if (act === "delex"){ syncForm(root); const ex = draft.weeks[cw].days[cd].exercises; if (ex.length > 1) ex.splice(ei, 1); renderPrograms(root); return; }
  if (act === "addset"){ syncForm(root); draft.weeks[cw].days[cd].exercises[ei].sets.push({ pct: 70, reps: 5 }); renderPrograms(root); return; }
  if (act === "delset"){ syncForm(root); const st = draft.weeks[cw].days[cd].exercises[ei].sets; if (st.length > 1) st.splice(si, 1); renderPrograms(root); return; }
  if (act === "addacc"){ syncForm(root); const ex = draft.weeks[cw].days[cd].exercises[ei]; (ex.acc || (ex.acc = [])).push({ name: "", sets: 3, reps: 8 }); renderPrograms(root); return; }
  if (act === "delacc"){ syncForm(root); const ac = draft.weeks[cw].days[cd].exercises[ei].acc; if (ac) ac.splice(ai, 1); renderPrograms(root); return; }
  if (act === "save"){
    syncForm(root);
    if (!validProgram(draft)){
      error = "Проверьте: есть название; в каждой неделе есть дни; в каждом дне — упражнения с подходами; % от 1 до 100; повторы — число или «макс»; у подсобок есть название.";
      renderPrograms(root); return;
    }
    if (!draft.id) draft.id = "p" + Date.now();
    upsertProgram(draft);
    mode = "list"; draft = null; error = "";
    renderPrograms(root);
  }
}
