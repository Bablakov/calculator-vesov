// Раздел «Админ»: правка КОНТЕНТА (тексты ошибок, связи «проблема → подсобки», каталог подсобок).
// Пользователь = админ сайта. Правки сохраняются локально и переопределяют встроенные дефолты
// (через contentstore) — применяются во всех разделах. Логика приложения не меняется.
import { LIFTS } from "./config.js";
import { escapeAttr, escapeHtml } from "./util.js";
import {
  getErrors, saveErrors, resetErrors,
  getProblemFix, saveProblemFix, resetProblemFix,
  getCatalog, saveCatalog, resetCatalog,
  getWeeks, saveWeeks, resetWeeks,
  getAccDefaults, saveAccDefaults, resetAccDefaults,
  overrides, deepCopy,
} from "./contentstore.js";

function normReps(v){ if (/макс/i.test(String(v))) return "макс"; const n = Number(v); return Number.isFinite(n) && n > 0 ? n : ""; }

let tab = "errors";   // errors | fix | catalog
let draft = null;

export function initAdmin(root){
  root.addEventListener("click", (e) => onClick(e, root));
  renderAdmin(root);
}

export function renderAdmin(root){
  if (!draft) loadDraft();
  const ov = overrides();
  const tabs = '<div class="jtabs">' +
    atab("errors", "Ошибки", ov.errors) +
    atab("fix", "Связи", ov.fix) +
    atab("catalog", "Подсобки", ov.catalog) +
    atab("template", "Шаблон", ov.template) +
  '</div>';
  const note = '<p class="adm-note">Правится <b>контент</b> (тексты ошибок, связи, каталог подсобок) и <b>базовый шаблон</b> (матрица недель + базовые подсобки) — логика не меняется. Правки сохраняются на этом устройстве и применяются во всех разделах. «Сбросить» вернёт стандартный вариант раздела.</p>';
  root.innerHTML = note + tabs +
    (tab === "errors" ? errorsBody() : tab === "fix" ? fixBody() : tab === "catalog" ? catalogBody() : templateBody()) +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="save">Сохранить</button>' +
      '<button data-act="reset">Сбросить к стандартным</button>' +
    '</div>';
}

function atab(id, label, overridden){
  return '<button type="button" class="jtab' + (tab === id ? " is-active" : "") + '" data-act="tab" data-tab="' + id + '">' +
    label + (overridden ? ' <span class="adm-badge">изм.</span>' : '') + '</button>';
}

function loadDraft(){
  if (tab === "errors") draft = deepCopy(getErrors());
  else if (tab === "fix") draft = deepCopy(getProblemFix());
  else if (tab === "catalog") draft = deepCopy(getCatalog());
  else draft = { weeks: deepCopy(getWeeks()), acc: deepCopy(getAccDefaults()) };
}

/* ─── Ошибки (тексты) ─── */
function errorsBody(){
  return LIFTS.map((l) => {
    const list = draft[l.key] || (draft[l.key] = []);
    const rows = list.map((er, i) =>
      '<div class="adm-sec">' +
        '<div class="adm-row">' +
          '<input data-e="name" data-lift="' + l.key + '" data-i="' + i + '" value="' + escapeAttr(er.name) + '" placeholder="название ошибки">' +
          '<button class="hbtn hbtn--del" data-act="delerr" data-lift="' + l.key + '" data-i="' + i + '" aria-label="Удалить">✕</button>' +
        '</div>' +
        '<div class="adm-row"><textarea data-e="fix" data-lift="' + l.key + '" data-i="' + i + '" placeholder="как исправить">' + escapeHtml(er.fix) + '</textarea></div>' +
      '</div>').join("");
    return '<div class="adm-lift" style="color:' + l.accent + '">' + l.name + '</div>' + rows +
      '<button class="hbtn" data-act="adderr" data-lift="' + l.key + '">+ ошибка</button>';
  }).join("");
}

/* ─── Связи «проблема → подсобки» ─── */
function fixBody(){
  const errors = getErrors();
  return LIFTS.map((l) =>
    '<div class="adm-lift" style="color:' + l.accent + '">' + l.name + '</div>' +
    (errors[l.key] || []).map((er) =>
      '<div class="adm-sec">' +
        '<div class="muted" style="margin-bottom:6px">' + escapeHtml(er.name) + '</div>' +
        '<div class="adm-row"><input data-fix="' + er.id + '" value="' + escapeAttr((draft[er.id] || []).join(", ")) + '" placeholder="подсобки через запятую"></div>' +
      '</div>').join("") || '<p class="muted">Нет ошибок для этого движения.</p>'
  ).join("");
}

/* ─── Каталог подсобок ─── */
function catalogBody(){
  return draft.map((g, gi) =>
    '<div class="adm-lift">' + escapeHtml(g.cat) + '</div>' +
    g.items.map((it, ii) =>
      '<div class="adm-sec">' +
        '<div class="adm-row">' +
          '<input data-c="name" data-gi="' + gi + '" data-ii="' + ii + '" value="' + escapeAttr(it.name) + '" placeholder="название">' +
          '<button class="hbtn hbtn--del" data-act="delitem" data-gi="' + gi + '" data-ii="' + ii + '" aria-label="Удалить">✕</button>' +
        '</div>' +
        '<div class="adm-row"><input data-c="muscles" data-gi="' + gi + '" data-ii="' + ii + '" value="' + escapeAttr(it.muscles) + '" placeholder="мышцы"></div>' +
        '<div class="adm-row"><input data-c="how" data-gi="' + gi + '" data-ii="' + ii + '" value="' + escapeAttr(it.how) + '" placeholder="как выполнять"></div>' +
        '<div class="adm-row"><input data-c="helps" data-gi="' + gi + '" data-ii="' + ii + '" value="' + escapeAttr(it.helps) + '" placeholder="чему помогает"></div>' +
      '</div>').join("") +
    '<button class="hbtn" data-act="additem" data-gi="' + gi + '">+ упражнение</button>'
  ).join("");
}

/* ─── Базовый шаблон: матрица недель + базовые подсобки ─── */
function templateBody(){
  const weeks = draft.weeks.map((w, wi) =>
    '<div class="adm-sec">' +
      '<div class="adm-row"><b style="white-space:nowrap">Неделя ' + (wi + 1) + '</b>' +
        '<input data-tw="kind" data-wi="' + wi + '" value="' + escapeAttr(w.kind) + '" placeholder="характер (средняя/тяжёлая…)">' +
        '<button class="hbtn hbtn--del" data-act="tw-delweek" data-wi="' + wi + '" aria-label="Удалить неделю">✕</button></div>' +
      w.sets.map((s, si) =>
        '<div class="stp"><input type="number" inputmode="numeric" min="1" max="100" data-tw="pct" data-wi="' + wi + '" data-si="' + si + '" value="' + escapeAttr(s.pct) + '" placeholder="%"><span class="stp__x">% ×</span>' +
        '<input data-tw="reps" data-wi="' + wi + '" data-si="' + si + '" value="' + escapeAttr(s.reps) + '" placeholder="повт / макс"><button class="hbtn hbtn--del" data-act="tw-delset" data-wi="' + wi + '" data-si="' + si + '" aria-label="Удалить подход">✕</button></div>').join("") +
      '<button class="hbtn" data-act="tw-addset" data-wi="' + wi + '">+ подход</button>' +
    '</div>').join("");

  const accs = LIFTS.map((l) => {
    const list = draft.acc[l.key] || (draft.acc[l.key] = []);
    return '<div class="adm-lift" style="color:' + l.accent + '">' + l.name + '</div>' +
      list.map((a, ai) =>
        '<div class="accr"><input class="accr__name" data-ta="name" data-lift="' + l.key + '" data-ai="' + ai + '" value="' + escapeAttr(a.name) + '" placeholder="подсобка">' +
        '<input class="accr__n" type="number" inputmode="numeric" min="1" data-ta="sets" data-lift="' + l.key + '" data-ai="' + ai + '" value="' + escapeAttr(a.sets) + '" placeholder="подх"><span class="stp__x">×</span>' +
        '<input class="accr__n" data-ta="reps" data-lift="' + l.key + '" data-ai="' + ai + '" value="' + escapeAttr(a.reps) + '" placeholder="повт">' +
        '<button class="hbtn hbtn--del" data-act="ta-del" data-lift="' + l.key + '" data-ai="' + ai + '" aria-label="Удалить">✕</button></div>').join("") +
      '<button class="hbtn" data-act="ta-add" data-lift="' + l.key + '">+ подсобка</button>';
  }).join("");

  return '<div class="adm-lift">Матрица недель (основа всех шаблонов)</div>' + weeks +
    '<button class="hbtn" data-act="tw-addweek">+ неделя</button>' +
    '<div class="adm-lift" style="margin-top:16px">Базовые подсобки по движениям</div>' + accs +
    '<p class="muted" style="margin-top:8px">Меняет генерацию шаблонов в «Программах» (мастер). Уже сохранённые программы не трогает.</p>';
}

/* ─── Чтение полей в draft ─── */
function sync(root){
  if (!draft) return;
  if (tab === "template"){
    draft.weeks.forEach((w, wi) => {
      const k = root.querySelector('[data-tw="kind"][data-wi="' + wi + '"]'); if (k) w.kind = k.value;
      w.sets.forEach((s, si) => {
        const p = root.querySelector('[data-tw="pct"][data-wi="' + wi + '"][data-si="' + si + '"]'); if (p) s.pct = Number(p.value);
        const r = root.querySelector('[data-tw="reps"][data-wi="' + wi + '"][data-si="' + si + '"]'); if (r) s.reps = normReps(r.value);
      });
    });
    LIFTS.forEach((l) => (draft.acc[l.key] || []).forEach((a, ai) => {
      const n = root.querySelector('[data-ta="name"][data-lift="' + l.key + '"][data-ai="' + ai + '"]'); if (n) a.name = n.value;
      const se = root.querySelector('[data-ta="sets"][data-lift="' + l.key + '"][data-ai="' + ai + '"]'); if (se) a.sets = se.value;
      const re = root.querySelector('[data-ta="reps"][data-lift="' + l.key + '"][data-ai="' + ai + '"]'); if (re) a.reps = re.value;
    }));
    return;
  }
  if (tab === "errors"){
    LIFTS.forEach((l) => (draft[l.key] || []).forEach((er, i) => {
      const n = root.querySelector('[data-e="name"][data-lift="' + l.key + '"][data-i="' + i + '"]'); if (n) er.name = n.value;
      const f = root.querySelector('[data-e="fix"][data-lift="' + l.key + '"][data-i="' + i + '"]'); if (f) er.fix = f.value;
    }));
  } else if (tab === "fix"){
    root.querySelectorAll('[data-fix]').forEach((inp) => {
      const id = inp.dataset.fix;
      const arr = inp.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (arr.length) draft[id] = arr; else delete draft[id];
    });
  } else {
    draft.forEach((g, gi) => g.items.forEach((it, ii) => {
      ["name", "muscles", "how", "helps"].forEach((f) => {
        const el = root.querySelector('[data-c="' + f + '"][data-gi="' + gi + '"][data-ii="' + ii + '"]'); if (el) it[f] = el.value;
      });
    }));
  }
}

/* ─── События ─── */
function onClick(e, root){
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === "tab"){ sync(root); tab = btn.dataset.tab; draft = null; renderAdmin(root); return; }
  if (act === "save"){ sync(root); saveCurrent(); renderAdmin(root); return; }
  if (act === "reset"){ if (confirm("Вернуть стандартный вариант этого раздела?")){ resetCurrent(); draft = null; renderAdmin(root); } return; }

  if (act === "adderr"){ sync(root); const k = btn.dataset.lift; (draft[k] || (draft[k] = [])).push({ id: "e" + Date.now(), name: "", fix: "" }); renderAdmin(root); return; }
  if (act === "delerr"){ sync(root); const k = btn.dataset.lift; if (draft[k]) draft[k].splice(Number(btn.dataset.i), 1); renderAdmin(root); return; }
  if (act === "additem"){ sync(root); draft[Number(btn.dataset.gi)].items.push({ name: "", muscles: "", how: "", helps: "" }); renderAdmin(root); return; }
  if (act === "delitem"){ sync(root); draft[Number(btn.dataset.gi)].items.splice(Number(btn.dataset.ii), 1); renderAdmin(root); return; }

  if (act === "tw-addweek"){ sync(root); draft.weeks.push({ n: draft.weeks.length + 1, kind: "", sets: [ { pct: 70, reps: 5 } ] }); renderAdmin(root); return; }
  if (act === "tw-delweek"){ sync(root); if (draft.weeks.length > 1) draft.weeks.splice(Number(btn.dataset.wi), 1); renderAdmin(root); return; }
  if (act === "tw-addset"){ sync(root); draft.weeks[Number(btn.dataset.wi)].sets.push({ pct: 70, reps: 5 }); renderAdmin(root); return; }
  if (act === "tw-delset"){ sync(root); const st = draft.weeks[Number(btn.dataset.wi)].sets; if (st.length > 1) st.splice(Number(btn.dataset.si), 1); renderAdmin(root); return; }
  if (act === "ta-add"){ sync(root); const k = btn.dataset.lift; (draft.acc[k] || (draft.acc[k] = [])).push({ name: "", sets: 3, reps: 8 }); renderAdmin(root); return; }
  if (act === "ta-del"){ sync(root); const k = btn.dataset.lift; if (draft.acc[k]) draft.acc[k].splice(Number(btn.dataset.ai), 1); renderAdmin(root); return; }
}

function saveCurrent(){
  if (tab === "errors") saveErrors(draft);
  else if (tab === "fix") saveProblemFix(draft);
  else if (tab === "catalog") saveCatalog(draft);
  else { saveWeeks(draft.weeks); saveAccDefaults(draft.acc); }
}
function resetCurrent(){
  if (tab === "errors") resetErrors();
  else if (tab === "fix") resetProblemFix();
  else if (tab === "catalog") resetCatalog();
  else { resetWeeks(); resetAccDefaults(); }
}
