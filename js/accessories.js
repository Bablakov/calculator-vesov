// Раздел «Подсобки»: каталог по категориям + подбор под типовую ошибку + свои.
// ⚠️ Контент — ЧЕРНОВИК, тренер вычитывает/расширяет.
import { get, set, KEYS } from "./store.js";
import { LIFTS, LIFT_BY_KEY } from "./config.js";
import { ERRORS } from "./content.js";
import { escapeAttr, escapeHtml } from "./util.js";

// Каталог подсобных упражнений по категориям.
export const CATALOG = [
  { cat: "Жим / плечи", items: [
    { name: "Жим узким хватом", muscles: "трицепс, грудь", how: "Хват уже плеч, локти вдоль корпуса.", helps: "Локаут жима, стабильность локтей." },
    { name: "Отжимания на брусьях", muscles: "трицепс, низ груди", how: "Корпус вертикально, опускаться до угла 90°.", helps: "Сила в нижней фазе жима." },
    { name: "Разводка гантелей", muscles: "грудь", how: "Лёжа, лёгкий сгиб локтя, растяжение груди.", helps: "Объём и контроль груди." },
    { name: "Армейский жим (ОХП)", muscles: "дельты, трицепс", how: "Стоя, жим штанги над головой.", helps: "Плечи и верх жима." },
  ] },
  { cat: "Присед / ноги", items: [
    { name: "Фронтальный присед", muscles: "квадрицепс, корпус", how: "Штанга на дельтах спереди, корпус вертикально.", helps: "Вставание из приседа, прямая спина." },
    { name: "Жим ногами", muscles: "квадрицепс, ягодицы", how: "Полная амплитуда без отрыва таза.", helps: "Объём ног без нагрузки на спину." },
    { name: "Выпады", muscles: "ягодицы, квадрицепс", how: "Шаг вперёд, колено к полу.", helps: "Баланс, стабильность колена." },
    { name: "Разгибания ног", muscles: "квадрицепс", how: "В тренажёре, плавно.", helps: "Изоляция квадрицепса." },
  ] },
  { cat: "Тяга / спина", items: [
    { name: "Тяга в наклоне", muscles: "широчайшие, разгибатели", how: "Наклон ~45°, тянуть к поясу.", helps: "Спина для тяги и приседа." },
    { name: "Тяга с плинтов", muscles: "разгибатели, трапеции", how: "Штанга с подставок чуть ниже колена.", helps: "Локаут и срыв тяги." },
    { name: "Румынская тяга", muscles: "бицепс бедра, ягодицы", how: "Ноги почти прямые, таз назад.", helps: "Задняя цепь, доводка таза." },
    { name: "Подтягивания", muscles: "широчайшие", how: "Полная амплитуда.", helps: "Контроль штанги у тела в тяге." },
  ] },
  { cat: "Корпус", items: [
    { name: "Гиперэкстензии", muscles: "разгибатели спины", how: "Без переразгибания, нейтраль в верхней точке.", helps: "Жёсткость спины в приседе и тяге." },
    { name: "Планка", muscles: "кор", how: "Прямая линия тело, без провисания таза.", helps: "Стабилизация корпуса." },
    { name: "«Доброе утро»", muscles: "разгибатели, бицепс бедра", how: "Штанга на спине, наклон с прямой спиной.", helps: "Сила разгибания корпуса." },
  ] },
  { cat: "ОФП", items: [
    { name: "Отжимания", muscles: "грудь, трицепс", how: "Корпус прямой.", helps: "Общая выносливость жима." },
    { name: "Фермерская ходьба", muscles: "хват, кор", how: "Тяжёлые гантели/гири, ходьба.", helps: "Хват и стабильность для тяги." },
  ] },
];

// Связь «типовая ошибка → подсобки» (зашита нами). Ключ — id ошибки из ERRORS.
export const PROBLEM_FIX = {
  stuck:     ["Фронтальный присед", "Жим ногами", "Пауза в нижней точке"],
  round:     ["Гиперэкстензии", "«Доброе утро»", "Тяга в наклоне"],
  knees_in:  ["Приседы с резинкой над коленями", "Выпады"],
  heels:     ["Мобилизация голеностопа", "Присед в штангетках"],
  depth:     ["Присед в ящик на нужную глубину", "Мобилизация таза"],
  no_chest:  ["Паузный жим", "Жим с бруска"],
  hips_up:   ["Жим с паузой", "Контроль упора ног без подъёма таза"],
  bar_tilt:  ["Жим гантелей (по одной руке)", "Жим узким хватом"],
  elbows:    ["Жим узким хватом", "Тяга в наклоне (стабилизаторы)"],
  arms_bent: ["Тяга на прямых руках", "Работа над хватом (крюк)"],
  low_round: ["Гиперэкстензии", "Тяга с плинтов", "«Доброе утро»"],
  bar_fwd:   ["Тяга с плинтов", "Подтягивания (широчайшие)"],
  hips_late: ["Румынская тяга", "Ягодичный мост"],
  jerk:      ["Тяга с паузой у пола", "Медленный съём штанги"],
};

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
  const cats = CATALOG.map((group) => {
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

  const catOpts = CATALOG.map((g) => '<option value="' + escapeAttr(g.cat) + '">' + escapeHtml(g.cat) + '</option>').join("");
  const addForm = '<section class="acat add-own"><h3 class="prof-h">Добавить своё</h3>' +
    '<div class="bw-add">' +
      '<input id="ownName" placeholder="название упражнения">' +
      '<select id="ownCat">' + catOpts + '</select>' +
      '<button class="primary" data-act="addown">Добавить</button>' +
    '</div></section>';

  return '<div class="acats">' + cats + addForm + '</div>';
}

function problemsBody(){
  return LIFTS.map((lift) =>
    '<section class="acat" style="--accent:' + lift.accent + '">' +
      '<h3 class="prof-h" style="color:' + lift.accent + '">' + lift.name + '</h3>' +
      (ERRORS[lift.key] || []).map((er) => {
        const fixes = PROBLEM_FIX[er.id] || [];
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
