// Раздел «Подсобки»: каталог по категориям + подбор под типовую ошибку + свои.
// Контент (каталог, связи, ошибки) читается через contentstore — с учётом правок админа.
import { get, set, KEYS } from "./store.js";
import { LIFTS } from "./config.js";
import { getCatalog, getProblemFix, getErrors } from "./contentstore.js";
import { escapeAttr, escapeHtml } from "./util.js";

/* ───── Хранение своих подсобок ───── */
function getCustom(){ return get(KEYS.accCustom, []); }
function saveCustom(list){ set(KEYS.accCustom, list); }

/* ───── Состояние ───── */
let tab = "catalog";   // catalog | problems

export function initAccessories(root){
  root.addEventListener("click", (e) => onClick(e, root));
  renderAccessories(root);
}

export function renderAccessories(root){
  const tabs = '<div class="jtabs">' +
    '<button type="button" class="jtab' + (tab === "catalog" ? " is-active" : "") + '" data-act="tab" data-tab="catalog">Каталог</button>' +
    '<button type="button" class="jtab' + (tab === "problems" ? " is-active" : "") + '" data-act="tab" data-tab="problems">Проблема → подсобки</button>' +
  '</div>';
  root.innerHTML = tabs + (tab === "catalog" ? catalogBody() : problemsBody());
}

function catalogBody(){
  const custom = getCustom();
  const cats = getCatalog().map((group) => {
    const mine = custom.filter((c) => c.cat === group.cat);
    const items = group.items.map((it) =>
      '<div class="acard">' +
        '<div class="acard__name">' + escapeHtml(it.name) + '</div>' +
        '<div class="acard__mus">' + escapeHtml(it.muscles) + '</div>' +
        '<div class="acard__how">' + escapeHtml(it.how) + '</div>' +
        '<div class="acard__helps">💡 ' + escapeHtml(it.helps) + '</div>' +
      '</div>').join("") +
      mine.map((c) =>
        '<div class="acard acard--own">' +
          '<div class="acard__name">' + escapeHtml(c.name) + ' <span class="own-tag">своё</span></div>' +
          '<button class="hbtn hbtn--del" data-act="delown" data-id="' + c.id + '" aria-label="Удалить">✕</button>' +
        '</div>').join("");
    return '<section class="acat"><h3 class="prof-h">' + escapeHtml(group.cat) + '</h3>' + items + '</section>';
  }).join("");

  const catOpts = getCatalog().map((g) => '<option value="' + escapeAttr(g.cat) + '">' + escapeHtml(g.cat) + '</option>').join("");
  const addForm = '<section class="acat add-own"><h3 class="prof-h">Добавить своё</h3>' +
    '<div class="bw-add">' +
      '<input id="ownName" placeholder="название упражнения">' +
      '<select id="ownCat">' + catOpts + '</select>' +
      '<button class="primary" data-act="addown">Добавить</button>' +
    '</div></section>';

  return '<div class="acats">' + cats + addForm + '</div>';
}

function problemsBody(){
  const errors = getErrors();
  const fix = getProblemFix();
  return LIFTS.map((lift) =>
    '<section class="acat" style="--accent:' + lift.accent + '">' +
      '<h3 class="prof-h" style="color:' + lift.accent + '">' + lift.name + '</h3>' +
      (errors[lift.key] || []).map((er) => {
        const fixes = fix[er.id] || [];
        return '<div class="prob">' +
          '<div class="prob__name">' + escapeHtml(er.name) + '</div>' +
          '<div class="prob__list">' + (fixes.length ? fixes.map((f) => '<span class="tagacc">' + escapeHtml(f) + '</span>').join("") : '<span class="muted">—</span>') + '</div>' +
        '</div>';
      }).join("") +
    '</section>').join("");
}

/* ───── События ───── */
function onClick(e, root){
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "tab"){ tab = btn.dataset.tab; renderAccessories(root); return; }
  if (act === "addown"){
    const name = (root.querySelector("#ownName").value || "").trim();
    const cat = root.querySelector("#ownCat").value;
    if (name){
      const list = getCustom();
      list.push({ id: "a" + Date.now(), name, cat });
      saveCustom(list);
      renderAccessories(root);
    }
    return;
  }
  if (act === "delown"){
    saveCustom(getCustom().filter((c) => c.id !== btn.dataset.id));
    renderAccessories(root);
  }
}
