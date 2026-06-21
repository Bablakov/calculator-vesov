// Раздел «Программы»: мои программы, шаблоны (просмотр) и конструктор.
import { get, set, KEYS } from "./store.js";
import { LIFTS, LIFT_BY_KEY } from "./config.js";
import { escapeAttr, escapeHtml } from "./util.js";
import { TEMPLATES, TEMPLATE_BY_ID } from "./templates.js";

export const TYPE_LABEL = { triathlon: "Троеборье", duathlon: "Двоеборье", single: "Одно движение" };

/* ───── Чистая логика (покрыта тестами) ───── */

// Упражнения программы по её типу.
export function liftsForType(type, lift){
  if (type === "duathlon") return ["bench", "deadlift"];
  if (type === "single")   return [lift || "squat"];
  return ["squat", "bench", "deadlift"];
}

// Пустая программа для конструктора.
export function blankProgram(){
  return { name: "", type: "triathlon", lift: "squat", weeks: [ { kind: "", sets: [ { pct: 70, reps: 5 } ] } ] };
}

// Глубокая копия шаблона в редактируемую программу.
export function fromTemplate(tpl, id){
  return {
    id,
    name: tpl.name,
    type: tpl.type,
    lift: tpl.lift || "squat",
    weeks: tpl.weeks.map((w) => ({ kind: w.kind, sets: w.sets.map((s) => ({ ...s })) })),
  };
}

// Нормализация повторов: "макс"/число.
export function normReps(v){
  if (/макс/i.test(String(v))) return "макс";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : "";
}

// Валидность подхода: % в (0;100], повторы — "макс" или число > 0.
export function validSet(s){
  const pctOk = Number.isFinite(Number(s.pct)) && Number(s.pct) > 0 && Number(s.pct) <= 100;
  const repsOk = s.reps === "макс" || (Number.isFinite(Number(s.reps)) && Number(s.reps) > 0);
  return pctOk && repsOk;
}

// Валидность программы целиком.
export function validProgram(p){
  if (!p.name || !p.name.trim()) return false;
  if (!p.weeks || !p.weeks.length) return false;
  return p.weeks.every((w) => w.sets.length && w.sets.every(validSet));
}

/* ───── Хранение ───── */
export function getPrograms(){ return get(KEYS.programs, []); }
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

/* ───── Рендер ───── */
let editing = false;
let draft = null;
let error = "";

export function initPrograms(root){
  root.addEventListener("click", (e) => onClick(e, root));
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.f === "type"){ syncDraft(root); draft.type = t.value; renderPrograms(root); }
  });
  renderPrograms(root);
}

export function renderPrograms(root){
  root.innerHTML = editing ? formHtml() : listHtml();
}

function listHtml(){
  const mine = getPrograms();
  const mineHtml = mine.length
    ? mine.map((p) =>
        '<div class="prow">' +
          '<div class="prow__main"><b>' + escapeHtml(p.name) + '</b>' +
            '<span class="prow__meta">' + TYPE_LABEL[p.type] + ' · ' + p.weeks.length + ' нед.</span></div>' +
          '<div class="prow__act">' +
            '<button class="hbtn" data-act="edit" data-id="' + p.id + '">Изменить</button>' +
            '<button class="hbtn hbtn--del" data-act="del" data-id="' + p.id + '" aria-label="Удалить">✕</button>' +
          '</div>' +
        '</div>').join("")
    : '<p class="muted">Пока нет своих программ. Создайте или возьмите за основу шаблон.</p>';

  const tplHtml = TEMPLATES.map((t) =>
    '<div class="prow">' +
      '<div class="prow__main"><b>' + escapeHtml(t.name) + '</b>' +
        '<span class="prow__meta">' + TYPE_LABEL[t.type] + ' · ' + t.weeks.length + ' нед.</span>' +
        '<span class="prow__note">' + escapeHtml(t.note) + '</span></div>' +
      '<div class="prow__act"><button class="hbtn" data-act="use" data-id="' + t.id + '">Взять за основу</button></div>' +
    '</div>').join("");

  return '<div class="psplit">' +
    '<section><div class="phead"><h2 class="section-title" style="margin:0">Мои программы</h2>' +
      '<button class="primary" data-act="create">+ Создать</button></div>' + mineHtml + '</section>' +
    '<section><h2 class="section-title">Шаблоны</h2><p class="muted" style="margin:-6px 0 12px">Только просмотр. «Взять за основу» создаёт копию в «Моих программах».</p>' + tplHtml + '</section>' +
  '</div>';
}

function formHtml(){
  const isSingle = draft.type === "single";
  const liftOpts = LIFTS.map((l) => '<option value="' + l.key + '"' + (draft.lift === l.key ? " selected" : "") + '>' + l.name + '</option>').join("");
  const typeOpts = Object.keys(TYPE_LABEL).map((k) => '<option value="' + k + '"' + (draft.type === k ? " selected" : "") + '>' + TYPE_LABEL[k] + '</option>').join("");

  const weeks = draft.weeks.map((w, wi) =>
    '<div class="wk">' +
      '<div class="wk__head">' +
        '<span class="wk__no">Неделя ' + (wi + 1) + '</span>' +
        '<input class="wk__kind" data-f="kind" data-wi="' + wi + '" value="' + escapeAttr(w.kind) + '" placeholder="характер (средняя / тяжёлая…)">' +
        '<button class="hbtn hbtn--del" data-act="delweek" data-wi="' + wi + '" aria-label="Удалить неделю">✕</button>' +
      '</div>' +
      '<div class="wk__sets">' +
        w.sets.map((s, si) =>
          '<div class="stp">' +
            '<input type="number" inputmode="numeric" min="1" max="100" data-f="pct" data-wi="' + wi + '" data-si="' + si + '" value="' + escapeAttr(s.pct) + '" placeholder="%">' +
            '<span class="stp__x">% ×</span>' +
            '<input data-f="reps" data-wi="' + wi + '" data-si="' + si + '" value="' + escapeAttr(s.reps) + '" placeholder="повт / макс">' +
            '<button class="hbtn hbtn--del" data-act="delset" data-wi="' + wi + '" data-si="' + si + '" aria-label="Удалить подход">✕</button>' +
          '</div>').join("") +
        '<button class="hbtn" data-act="addset" data-wi="' + wi + '">+ подход</button>' +
      '</div>' +
    '</div>').join("");

  return '<div class="constructor">' +
    '<div class="phead"><h2 class="section-title" style="margin:0">' + (draft.id ? "Изменить программу" : "Новая программа") + '</h2></div>' +
    (error ? '<p class="form-err">' + escapeHtml(error) + '</p>' : '') +
    '<label class="pf"><span>Название</span><input data-f="name" value="' + escapeAttr(draft.name) + '" placeholder="Моя программа"></label>' +
    '<div class="frow">' +
      '<label class="pf"><span>Тип</span><select data-f="type">' + typeOpts + '</select></label>' +
      (isSingle ? '<label class="pf"><span>Упражнение</span><select data-f="lift">' + liftOpts + '</select></label>' : '') +
    '</div>' +
    '<div class="wks">' + weeks + '</div>' +
    '<button class="hbtn" data-act="addweek">+ неделя</button>' +
    '<p class="muted" style="margin:10px 0 0">Максимум 100% (105% — проходка, в программе не используется).</p>' +
    '<div class="toolbar" style="margin-top:14px">' +
      '<button class="primary" data-act="save">Сохранить</button>' +
      '<button data-act="cancel">Отмена</button>' +
    '</div>' +
  '</div>';
}

/* ───── Действия ───── */
function syncDraft(root){
  if (!draft) return;
  const nameEl = root.querySelector('[data-f="name"]'); if (nameEl) draft.name = nameEl.value;
  const typeEl = root.querySelector('[data-f="type"]'); if (typeEl) draft.type = typeEl.value;
  const liftEl = root.querySelector('[data-f="lift"]'); if (liftEl) draft.lift = liftEl.value;
  draft.weeks.forEach((w, wi) => {
    const k = root.querySelector('[data-f="kind"][data-wi="' + wi + '"]'); if (k) w.kind = k.value;
    w.sets.forEach((s, si) => {
      const p = root.querySelector('[data-f="pct"][data-wi="' + wi + '"][data-si="' + si + '"]'); if (p) s.pct = Number(p.value);
      const r = root.querySelector('[data-f="reps"][data-wi="' + wi + '"][data-si="' + si + '"]'); if (r) s.reps = normReps(r.value);
    });
  });
}

function onClick(e, root){
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const wi = Number(btn.dataset.wi), si = Number(btn.dataset.si);

  if (act === "create"){ draft = blankProgram(); editing = true; error = ""; renderPrograms(root); return; }
  if (act === "use"){
    const tpl = TEMPLATE_BY_ID[btn.dataset.id];
    if (tpl){ upsertProgram(fromTemplate(tpl, "p" + Date.now())); renderPrograms(root); }
    return;
  }
  if (act === "edit"){
    const p = getPrograms().find((x) => x.id === btn.dataset.id);
    if (p){ draft = JSON.parse(JSON.stringify(p)); editing = true; error = ""; renderPrograms(root); }
    return;
  }
  if (act === "del"){
    if (confirm("Удалить программу?")){ deleteProgram(btn.dataset.id); renderPrograms(root); }
    return;
  }
  if (act === "cancel"){ editing = false; draft = null; error = ""; renderPrograms(root); return; }

  // действия конструктора
  if (!draft) return;
  if (act === "addweek"){ syncDraft(root); draft.weeks.push({ kind: "", sets: [ { pct: 70, reps: 5 } ] }); renderPrograms(root); return; }
  if (act === "delweek"){ syncDraft(root); if (draft.weeks.length > 1) draft.weeks.splice(wi, 1); renderPrograms(root); return; }
  if (act === "addset"){ syncDraft(root); draft.weeks[wi].sets.push({ pct: 70, reps: 5 }); renderPrograms(root); return; }
  if (act === "delset"){ syncDraft(root); if (draft.weeks[wi].sets.length > 1) draft.weeks[wi].sets.splice(si, 1); renderPrograms(root); return; }
  if (act === "save"){
    syncDraft(root);
    if (!validProgram(draft)){ error = "Проверьте: есть название, в каждой неделе хотя бы один подход, % от 1 до 100, повторы — число или «макс»."; renderPrograms(root); return; }
    if (!draft.id) draft.id = "p" + Date.now();
    upsertProgram(draft);
    editing = false; draft = null; error = "";
    renderPrograms(root);
  }
}
