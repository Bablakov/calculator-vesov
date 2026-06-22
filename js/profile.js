// Профиль: ФИО, дата рождения, аватар + контроль веса тела.
// Тайминг тренировки переехал внутрь тренировки (журнал); роль — убрана (вернётся в Фазе 2).
import { get, set, KEYS } from "./store.js";
import { parseNum, round1, fmt, fmtDateTime, escapeAttr } from "./util.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// Длительность между "HH:MM" и "HH:MM" в минутах (через полночь — корректно). null если данных нет.
// (Оставлено для журнала/совместимости.)
export function computeDuration(start, end){
  if (!start || !end) return null;
  const a = start.split(":").map(Number);
  const b = end.split(":").map(Number);
  if (a.length !== 2 || b.length !== 2 || [...a, ...b].some((n) => Number.isNaN(n))) return null;
  let mins = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function fmtDuration(mins){
  if (mins == null) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + " ч " : "") + m + " мин";
}

// Возраст по дате рождения "YYYY-MM-DD" на момент nowTs (мс). null если нет/мусор.
export function ageFromBirth(birth, nowTs){
  const parts = String(birth || "").split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [by, bm, bd] = parts;
  const now = new Date(nowTs);
  let age = now.getFullYear() - by;
  const md = (now.getMonth() + 1) - bm;
  if (md < 0 || (md === 0 && now.getDate() < bd)) age--;
  return age >= 0 && age < 150 ? age : null;
}

// Добавить замер веса тела; новые сверху, округление до 0,1 кг, лимит 100.
export function addWeightEntry(list, kg, ts){
  const next = [{ id: ts, ts, kg: round1(kg) }, ...list];
  if (next.length > 100) next.length = 100;
  return next;
}

// Инициалы для плейсхолдера аватара
export function initials(p){
  const a = (p.first || "").trim()[0] || "";
  const b = (p.last || "").trim()[0] || "";
  return (a + b).toUpperCase() || "🏋";
}

/* ───── Хранение ───── */
function saveProfileField(key, value){
  const p = get(KEYS.profile, {});
  if (value === "" || value == null) delete p[key]; else p[key] = value;
  set(KEYS.profile, p);
}

/* ───── Рендер ───── */
export function initProfile(root){
  render(root);

  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.pf){ saveProfileField(t.dataset.pf, t.value); if (t.dataset.pf === "birth") refreshAge(root); }
  });

  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "avatarInput" && t.files && t.files[0]){
      readAvatar(t.files[0], (dataUrl) => { saveProfileField("avatar", dataUrl); render(root); });
    }
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("#bwAdd")){
      const inp = root.querySelector("#bwInput");
      const kg = parseNum(inp.value);
      if (kg > 0){
        set(KEYS.weight, addWeightEntry(get(KEYS.weight, []), kg, Date.now()));
        render(root);
      }
      return;
    }
    const del = e.target.closest("[data-delbw]");
    if (del){
      const id = Number(del.dataset.delbw);
      set(KEYS.weight, get(KEYS.weight, []).filter((w) => w.id !== id));
      render(root);
    }
  });
}

function refreshAge(root){
  const p = get(KEYS.profile, {});
  const box = root.querySelector("#profAge");
  if (box){ const a = ageFromBirth(p.birth, Date.now()); box.textContent = a == null ? "" : "Возраст: " + a + " " + plural(a); }
}

function plural(n){
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return "лет";
  if (b === 1) return "год";
  if (b >= 2 && b <= 4) return "года";
  return "лет";
}

function render(root){
  const p = get(KEYS.profile, {});
  const weights = get(KEYS.weight, []);
  const age = ageFromBirth(p.birth, Date.now());

  root.innerHTML =
    // Личные данные
    '<section class="prof-card">' +
      '<div class="prof-id">' +
        '<label class="avatar">' +
          (p.avatar
            ? '<img src="' + escapeAttr(p.avatar) + '" alt="Аватар">'
            : '<span class="avatar__ph">' + initials(p) + '</span>') +
          '<input type="file" id="avatarInput" accept="image/*" hidden>' +
          '<span class="avatar__edit">Фото</span>' +
        '</label>' +
        '<div class="prof-fields">' +
          pf("Фамилия", '<input data-pf="last" value="' + escapeAttr(p.last) + '" placeholder="Фамилия">') +
          pf("Имя", '<input data-pf="first" value="' + escapeAttr(p.first) + '" placeholder="Имя">') +
          pf("Отчество", '<input data-pf="middle" value="' + escapeAttr(p.middle) + '" placeholder="необязательно">') +
          pf("Дата рождения", '<input type="date" data-pf="birth" value="' + escapeAttr(p.birth) + '">') +
        '</div>' +
      '</div>' +
      '<p class="muted" id="profAge" style="margin:10px 2px 0">' + (age == null ? "" : "Возраст: " + age + " " + plural(age)) + '</p>' +
    '</section>' +

    // Вес тела
    '<section class="prof-card">' +
      '<h3 class="prof-h">Вес тела</h3>' +
      '<p class="muted" style="margin:-4px 0 10px">Текущий: <b>' + (weights.length ? fmt(weights[0].kg) + " кг" : "—") + '</b> · обновляется из последней тренировки, можно внести вручную.</p>' +
      '<div class="bw-add">' +
        '<input type="number" inputmode="decimal" step="0.1" min="0" id="bwInput" placeholder="вес на сегодня, напр. 85.4">' +
        '<span class="unit">кг</span>' +
        '<button class="primary" id="bwAdd">Добавить</button>' +
      '</div>' +
      '<div class="bw-list">' + weightList(weights) + '</div>' +
    '</section>';
}

function pf(label, control){
  return '<label class="pf"><span>' + label + '</span>' + control + '</label>';
}

function weightList(list){
  if (!list.length) return '<p class="muted">Пока нет замеров. Внесите вес вручную или завершите тренировку с весом тела.</p>';
  return list.map((w) =>
    '<div class="bw-row">' +
      '<span class="bw-date">' + fmtDateTime(w.ts) + '</span>' +
      '<span class="bw-kg">' + fmt(w.kg) + ' кг</span>' +
      '<button type="button" class="hbtn hbtn--del" data-delbw="' + w.id + '" aria-label="Удалить">✕</button>' +
    '</div>').join("");
}

/* ───── Аватар: чтение файла → квадрат 160px → dataURL ───── */
function readAvatar(file, cb){
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      try { cb(canvas.toDataURL("image/jpeg", 0.85)); } catch (e) {}
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
