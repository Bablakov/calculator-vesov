// Профиль: личные данные + аватар, контроль веса тела, тайминг тренировки,
// выбор дня сплита. Хранение — localStorage.
import { get, set, KEYS } from "./store.js";
import { SPLIT, LIFT_BY_KEY } from "./config.js";
import { parseNum, round1, fmt, fmtDateTime, escapeAttr } from "./util.js";

/* ───── Чистая логика (покрыта тестами) ───── */

// Длительность между "HH:MM" и "HH:MM" в минутах (через полночь — корректно). null если данных нет.
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
function saveTimingField(key, value){
  const t = get(KEYS.timing, {});
  if (value === "" || value == null) delete t[key]; else t[key] = value;
  set(KEYS.timing, t);
}

/* ───── Рендер ───── */
export function initProfile(root){
  render(root);

  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.pf) saveProfileField(t.dataset.pf, t.value);
  });

  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "avatarInput" && t.files && t.files[0]){
      readAvatar(t.files[0], (dataUrl) => { saveProfileField("avatar", dataUrl); render(root); });
    } else if (t.dataset.tm){
      saveTimingField(t.dataset.tm, t.value);
      if (t.dataset.tm === "start" || t.dataset.tm === "end") refreshDuration(root);
    }
  });

  root.addEventListener("click", (e) => {
    const now = e.target.closest("[data-now]");
    if (now){
      const field = now.dataset.now;
      const inp = root.querySelector('input[data-tm="' + field + '"]');
      const val = nowHHMM();
      if (inp) inp.value = val;
      saveTimingField(field, val);
      refreshDuration(root);
      return;
    }
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

function refreshDuration(root){
  const t = get(KEYS.timing, {});
  const box = root.querySelector("#tmDur");
  if (box) box.textContent = fmtDuration(computeDuration(t.start, t.end));
}

function render(root){
  const p = get(KEYS.profile, {});
  const weights = get(KEYS.weight, []);
  const t = get(KEYS.timing, {});
  const dur = computeDuration(t.start, t.end);

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
          pf("Возраст", '<input type="number" inputmode="numeric" min="0" data-pf="age" value="' + escapeAttr(p.age) + '" placeholder="лет">') +
        '</div>' +
      '</div>' +
    '</section>' +

    // Вес тела
    '<section class="prof-card">' +
      '<h3 class="prof-h">Вес тела</h3>' +
      '<div class="bw-add">' +
        '<input type="number" inputmode="decimal" step="0.1" min="0" id="bwInput" placeholder="вес на сегодня, напр. 85.4">' +
        '<span class="unit">кг</span>' +
        '<button class="primary" id="bwAdd">Добавить</button>' +
      '</div>' +
      '<div class="bw-list">' + weightList(weights) + '</div>' +
    '</section>' +

    // Тренировка сегодня
    '<section class="prof-card">' +
      '<h3 class="prof-h">Тренировка сегодня</h3>' +
      '<div class="tm-grid">' +
        pf("Начало", '<span class="tm-row"><input type="time" data-tm="start" value="' + escapeAttr(t.start) + '"><button type="button" class="now" data-now="start">Сейчас</button></span>') +
        pf("Конец",  '<span class="tm-row"><input type="time" data-tm="end" value="' + escapeAttr(t.end) + '"><button type="button" class="now" data-now="end">Сейчас</button></span>') +
      '</div>' +
      '<div class="tm-dur">Длительность: <b id="tmDur">' + fmtDuration(dur) + '</b></div>' +
      pf("День тренировки",
        '<select data-tm="day"><option value="">— выберите —</option>' +
        SPLIT.map((d, i) =>
          '<option value="' + i + '"' + (String(t.day) === String(i) ? " selected" : "") + '>' +
            d.day + ' · ' + d.lifts.map((k) => LIFT_BY_KEY[k].short).join(" + ") +
          '</option>').join("") +
        '</select>') +
    '</section>';
}

function pf(label, control){
  return '<label class="pf"><span>' + label + '</span>' + control + '</label>';
}

function weightList(list){
  if (!list.length) return '<p class="muted">Пока нет замеров. Внесите вес и нажмите «Добавить».</p>';
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

function nowHHMM(){
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
