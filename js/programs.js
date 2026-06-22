// Раздел «Программы»: список, мастер выбора (уровень → дисциплина → упор) и конструктор.
import { get, set, KEYS } from "./store.js";
import { LIFTS, LIFT_BY_KEY } from "./config.js";
import { escapeAttr, escapeHtml } from "./util.js";
import {
  LEVELS, LEVEL_BY_KEY, DISCIPLINES, DISCIPLINE_BY_KEY,
  focusesFor, focusByKey, buildTemplate,
} from "./templates.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// Соревновательные движения дисциплины.
export function liftsForDiscipline(disciplineKey){
  const d = DISCIPLINE_BY_KEY[disciplineKey];
  return d ? d.lifts.slice() : ["squat", "bench", "deadlift"];
}

// Нормализация повторов: "макс" / число / "".
export function normReps(v){
  if (/макс/i.test(String(v))) return "макс";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : "";
}

// Подход основного движения: % в (0;100], повторы — "макс" или > 0.
export function validSet(s){
  const pctOk = Number.isFinite(Number(s.pct)) && Number(s.pct) > 0 && Number(s.pct) <= 100;
  const repsOk = s.reps === "макс" || (Number.isFinite(Number(s.reps)) && Number(s.reps) > 0);
  return pctOk && repsOk;
}

// Валидность программы нового формата: неделя → дни → упражнения → подходы (+ подсобки).
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

// Пустая программа «с нуля»: 1 неделя, 1 день, 1 движение, 1 подход.
export function blankProgram(){
  return {
    id: null, name: "", level: "amateur", discipline: "pl", focus: "base",
    weeks: [ { kind: "", days: [ { name: "День 1", exercises: [ { key: "squat", sets: [ { pct: 70, reps: 5 } ], acc: [] } ] } ] } ],
  };
}

/* ───── Миграция старого формата (type/lift, weeks[{sets}]) → новый (weeks[{days}]) ───── */
function oldLifts(type, lift){
  if (type === "duathlon") return ["bench", "deadlift"];
  if (type === "single")   return [lift || "squat"];
  return ["squat", "bench", "deadlift"];
}
export function migrateProgram(p){
  if (!p || !Array.isArray(p.weeks)) return p;
  // уже новый формат (в неделях есть дни) — только дополним недостающие поля
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

/* ─── Мастер выбора (уровень → дисциплина → упор → превью) ─── */
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
  // step 4 — превью готовой программы
  const prog = buildTemplate(wiz.level, wiz.discipline, wiz.focus);
  return head + '<p class="muted wlbl">Готовая программа — возьмите за основу и отредактируйте под себя</p>' +
    previewHtml(prog) +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="wtake">Взять за основу</button>' +
      '<button data-act="wback" data-to="3">← Назад</button>' +
    '</div>';
}

function previewHtml(prog){
  return '<div class="ppreview">' + prog.weeks.map((w, wi) =>
    '<div class="ppweek"><div class="ppweek__h">Неделя ' + (wi + 1) + (w.kind ? ' · ' + escapeHtml(w.kind) : '') + '</div>' +
      w.days.map((d) =>
        '<div class="ppday"><div class="ppday__h">' + escapeHtml(d.name) + '</div>' +
          d.exercises.map((ex) => {
            const lift = LIFT_BY_KEY[ex.key];
            return '<div class="ppex" style="--accent:' + (lift ? lift.accent : '#888') + '">' +
              '<div class="ppex__name">' + escapeHtml(lift ? lift.name : ex.key) + '</div>' +
              '<div class="ppsets">' + ex.sets.map((s) => '<span class="ppset">' + s.pct + '% × ' + (s.reps === "макс" ? "макс" : s.reps) + '</span>').join("") + '</div>' +
              ((ex.acc && ex.acc.length) ? '<div class="ppacc">Подсобки: ' + ex.acc.map((a) => escapeHtml(a.name) + ' ' + a.sets + '×' + a.reps).join("; ") + '</div>' : '') +
            '</div>';
          }).join("") +
        '</div>').join("") +
    '</div>').join("") + '</div>';
}

/* ─── Конструктор ─── */
function liftSelect(disc, ex, wi, di, ei){
  const lifts = disc ? disc.lifts : LIFTS.map((l) => l.key);
  return '<select data-f="exkey" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '">' +
    lifts.map((k) => '<option value="' + k + '"' + (ex.key === k ? " selected" : "") + '>' + (LIFT_BY_KEY[k] ? LIFT_BY_KEY[k].name : k) + '</option>').join("") +
    '</select>';
}

function formHtml(){
  const disc  = DISCIPLINE_BY_KEY[draft.discipline];
  const focus = focusByKey(draft.discipline, draft.focus);
  const lvl   = LEVEL_BY_KEY[draft.level];
  const metaInfo = [disc ? disc.name : "", focus ? focus.name : "", lvl ? lvl.name : ""].filter(Boolean).join(" · ");

  const weeks = draft.weeks.map((w, wi) =>
    '<div class="wk">' +
      '<div class="wk__head">' +
        '<span class="wk__no">Неделя ' + (wi + 1) + '</span>' +
        '<input class="wk__kind" data-f="kind" data-wi="' + wi + '" value="' + escapeAttr(w.kind) + '" placeholder="характер (средняя / тяжёлая…)">' +
        '<button class="hbtn hbtn--del" data-act="delweek" data-wi="' + wi + '" aria-label="Удалить неделю">✕</button>' +
      '</div>' +
      w.days.map((d, di) =>
        '<div class="day">' +
          '<div class="day__head">' +
            '<input class="day__name" data-f="dayname" data-wi="' + wi + '" data-di="' + di + '" value="' + escapeAttr(d.name) + '" placeholder="название дня">' +
            '<button class="hbtn hbtn--del" data-act="delday" data-wi="' + wi + '" data-di="' + di + '" aria-label="Удалить день">✕</button>' +
          '</div>' +
          d.exercises.map((ex, ei) =>
            '<div class="ex">' +
              '<div class="ex__head">' + liftSelect(disc, ex, wi, di, ei) +
                '<button class="hbtn hbtn--del" data-act="delex" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" aria-label="Удалить упражнение">✕</button>' +
              '</div>' +
              '<div class="ex__sets">' +
                ex.sets.map((s, si) =>
                  '<div class="stp">' +
                    '<input type="number" inputmode="numeric" min="1" max="100" data-f="pct" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-si="' + si + '" value="' + escapeAttr(s.pct) + '" placeholder="%">' +
                    '<span class="stp__x">% ×</span>' +
                    '<input data-f="reps" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-si="' + si + '" value="' + escapeAttr(s.reps) + '" placeholder="повт / макс">' +
                    '<button class="hbtn hbtn--del" data-act="delset" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-si="' + si + '" aria-label="Удалить подход">✕</button>' +
                  '</div>').join("") +
                '<button class="hbtn" data-act="addset" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '">+ подход</button>' +
              '</div>' +
              '<div class="ex__acc">' +
                '<div class="ex__acclbl">Подсобки</div>' +
                (ex.acc || []).map((a, ai) =>
                  '<div class="accr">' +
                    '<input class="accr__name" data-f="accname" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.name) + '" placeholder="название подсобки">' +
                    '<input class="accr__n" type="number" inputmode="numeric" min="1" data-f="accsets" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.sets) + '" placeholder="подх">' +
                    '<span class="stp__x">×</span>' +
                    '<input class="accr__n" data-f="accreps" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-ai="' + ai + '" value="' + escapeAttr(a.reps) + '" placeholder="повт">' +
                    '<button class="hbtn hbtn--del" data-act="delacc" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '" data-ai="' + ai + '" aria-label="Удалить подсобку">✕</button>' +
                  '</div>').join("") +
                '<button class="hbtn" data-act="addacc" data-wi="' + wi + '" data-di="' + di + '" data-ei="' + ei + '">+ подсобка</button>' +
              '</div>' +
            '</div>').join("") +
          '<button class="hbtn" data-act="addex" data-wi="' + wi + '" data-di="' + di + '">+ упражнение</button>' +
        '</div>').join("") +
      '<button class="hbtn" data-act="addday" data-wi="' + wi + '">+ день</button>' +
    '</div>').join("");

  return '<div class="constructor">' +
    '<div class="phead"><h2 class="section-title" style="margin:0">' + (draft.id ? "Изменить программу" : "Новая программа") + '</h2></div>' +
    (error ? '<p class="form-err">' + escapeHtml(error) + '</p>' : '') +
    '<label class="pf"><span>Название</span><input data-f="name" value="' + escapeAttr(draft.name) + '" placeholder="Моя программа"></label>' +
    (metaInfo ? '<p class="cmeta">' + escapeHtml(metaInfo) + '</p>' : '') +
    '<div class="wks">' + weeks + '</div>' +
    '<button class="hbtn" data-act="addweek">+ неделя</button>' +
    '<p class="muted" style="margin:10px 0 0">Максимум 100% (105% — проходка, в программе не используется).</p>' +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="save">Сохранить</button>' +
      '<button data-act="cancel">Отмена</button>' +
    '</div>' +
  '</div>';
}

/* ─── Чтение полей конструктора в draft ─── */
function syncDraft(root){
  if (!draft) return;
  const q = (s) => root.querySelector(s);
  const nameEl = q('[data-f="name"]'); if (nameEl) draft.name = nameEl.value;
  draft.weeks.forEach((w, wi) => {
    const k = q('[data-f="kind"][data-wi="' + wi + '"]'); if (k) w.kind = k.value;
    w.days.forEach((d, di) => {
      const dn = q('[data-f="dayname"][data-wi="' + wi + '"][data-di="' + di + '"]'); if (dn) d.name = dn.value;
      d.exercises.forEach((ex, ei) => {
        const base = '[data-wi="' + wi + '"][data-di="' + di + '"][data-ei="' + ei + '"]';
        const ek = q('[data-f="exkey"]' + base); if (ek) ex.key = ek.value;
        ex.sets.forEach((s, si) => {
          const p = q('[data-f="pct"]' + base + '[data-si="' + si + '"]'); if (p) s.pct = Number(p.value);
          const r = q('[data-f="reps"]' + base + '[data-si="' + si + '"]'); if (r) s.reps = normReps(r.value);
        });
        (ex.acc || []).forEach((a, ai) => {
          const an = q('[data-f="accname"]' + base + '[data-ai="' + ai + '"]'); if (an) a.name = an.value;
          const as = q('[data-f="accsets"]' + base + '[data-ai="' + ai + '"]'); if (as) a.sets = as.value;
          const ar = q('[data-f="accreps"]' + base + '[data-ai="' + ai + '"]'); if (ar) a.reps = ar.value;
        });
      });
    });
  });
}

/* ─── Заготовки для конструктора ─── */
function newExercise(disciplineKey){
  const d = DISCIPLINE_BY_KEY[disciplineKey];
  const key = d && d.lifts[0] ? d.lifts[0] : "squat";
  return { key, sets: [ { pct: 70, reps: 5 } ], acc: [] };
}
function newDay(i, disciplineKey){ return { name: "День " + (i + 1), exercises: [ newExercise(disciplineKey) ] }; }
function newWeek(disciplineKey){ return { kind: "", days: [ newDay(0, disciplineKey) ] }; }

/* ─── События ─── */
function onClick(e, root){
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const wi = Number(btn.dataset.wi), di = Number(btn.dataset.di), ei = Number(btn.dataset.ei),
        si = Number(btn.dataset.si), ai = Number(btn.dataset.ai);

  // список
  if (act === "wizard"){ wiz = { step: 1, level: null, discipline: null, focus: null }; mode = "wizard"; error = ""; renderPrograms(root); return; }
  if (act === "blank"){ draft = blankProgram(); mode = "edit"; error = ""; renderPrograms(root); return; }
  if (act === "edit"){ const p = getPrograms().find((x) => x.id === btn.dataset.id); if (p){ draft = JSON.parse(JSON.stringify(p)); mode = "edit"; error = ""; renderPrograms(root); } return; }
  if (act === "del"){ if (confirm("Удалить программу?")){ deleteProgram(btn.dataset.id); renderPrograms(root); } return; }

  // мастер
  if (act === "wizcancel"){ wiz = null; mode = "list"; renderPrograms(root); return; }
  if (act === "wback"){ wiz.step = Number(btn.dataset.to); renderPrograms(root); return; }
  if (act === "wlevel"){ wiz.level = btn.dataset.key; wiz.step = 2; renderPrograms(root); return; }
  if (act === "wdisc"){ wiz.discipline = btn.dataset.key; wiz.focus = null; wiz.step = 3; renderPrograms(root); return; }
  if (act === "wfocus"){ wiz.focus = btn.dataset.key; wiz.step = 4; renderPrograms(root); return; }
  if (act === "wtake"){
    const prog = buildTemplate(wiz.level, wiz.discipline, wiz.focus, "p" + Date.now());
    upsertProgram(prog);
    wiz = null; draft = JSON.parse(JSON.stringify(prog)); mode = "edit"; error = "";
    renderPrograms(root); return;
  }

  // конструктор
  if (!draft) return;
  if (act === "cancel"){ mode = "list"; draft = null; error = ""; renderPrograms(root); return; }
  if (act === "addweek"){ syncDraft(root); draft.weeks.push(newWeek(draft.discipline)); renderPrograms(root); return; }
  if (act === "delweek"){ syncDraft(root); if (draft.weeks.length > 1) draft.weeks.splice(wi, 1); renderPrograms(root); return; }
  if (act === "addday"){ syncDraft(root); draft.weeks[wi].days.push(newDay(draft.weeks[wi].days.length, draft.discipline)); renderPrograms(root); return; }
  if (act === "delday"){ syncDraft(root); if (draft.weeks[wi].days.length > 1) draft.weeks[wi].days.splice(di, 1); renderPrograms(root); return; }
  if (act === "addex"){ syncDraft(root); draft.weeks[wi].days[di].exercises.push(newExercise(draft.discipline)); renderPrograms(root); return; }
  if (act === "delex"){ syncDraft(root); const ex = draft.weeks[wi].days[di].exercises; if (ex.length > 1) ex.splice(ei, 1); renderPrograms(root); return; }
  if (act === "addset"){ syncDraft(root); draft.weeks[wi].days[di].exercises[ei].sets.push({ pct: 70, reps: 5 }); renderPrograms(root); return; }
  if (act === "delset"){ syncDraft(root); const st = draft.weeks[wi].days[di].exercises[ei].sets; if (st.length > 1) st.splice(si, 1); renderPrograms(root); return; }
  if (act === "addacc"){ syncDraft(root); const ex = draft.weeks[wi].days[di].exercises[ei]; (ex.acc || (ex.acc = [])).push({ name: "", sets: 3, reps: 8 }); renderPrograms(root); return; }
  if (act === "delacc"){ syncDraft(root); const ac = draft.weeks[wi].days[di].exercises[ei].acc; if (ac) ac.splice(ai, 1); renderPrograms(root); return; }
  if (act === "save"){
    syncDraft(root);
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
