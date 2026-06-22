// Раздел «Админ»: правка КОНТЕНТА (тексты ошибок, связи «проблема → подсобки», каталог подсобок).
// Пользователь = админ сайта. Правки сохраняются локально и переопределяют встроенные дефолты
// (через contentstore) — применяются во всех разделах. Логика приложения не меняется.
import { LIFTS } from "./config.js";
import { escapeAttr, escapeHtml } from "./util.js";
import {
  getErrors, saveErrors, resetErrors,
  getProblemFix, saveProblemFix, resetProblemFix,
  getCatalog, saveCatalog, resetCatalog,
  overrides, deepCopy,
} from "./contentstore.js";

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
  '</div>';
  const note = '<p class="adm-note">Правится <b>контент</b> (тексты, связи, каталог) — логика приложения не меняется. Правки сохраняются на этом устройстве и применяются во всех разделах. «Сбросить» вернёт стандартный вариант раздела.</p>';
  root.innerHTML = note + tabs +
    (tab === "errors" ? errorsBody() : tab === "fix" ? fixBody() : catalogBody()) +
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
  else draft = deepCopy(getCatalog());
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

/* ─── Чтение полей в draft ─── */
function sync(root){
  if (!draft) return;
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
}

function saveCurrent(){
  if (tab === "errors") saveErrors(draft);
  else if (tab === "fix") saveProblemFix(draft);
  else saveCatalog(draft);
}
function resetCurrent(){
  if (tab === "errors") resetErrors();
  else if (tab === "fix") resetProblemFix();
  else resetCatalog();
}
