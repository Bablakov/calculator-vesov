// Калькулятор: поля 1ПМ, суммы и 4 таблицы недель (веса от 1ПМ по матрице).
// Тип по умолчанию — троеборье (все упражнения). 105% в таблицах не показываем.
import { LIFTS, WEEKS, TARGET_PCT } from "./config.js";
import { parseNum, round1, fmt, fmtDateTime } from "./util.js";
import { get, set, KEYS } from "./store.js";

export function initCalc(){
  const inputsEl  = document.getElementById("inputs");
  const weeksEl   = document.getElementById("weeks");
  const historyEl = document.getElementById("history");
  const sumNowEl  = document.getElementById("sumNow");
  const sumTgtEl  = document.getElementById("sumTarget");
  if (!inputsEl) return;

  const inputs = {};   // key → <input>
  const cells  = {};   // "n_si_key" → <td>

  // — Поля ввода 1ПМ —
  for (const lift of LIFTS){
    const field = document.createElement("label");
    field.className = "field";
    field.style.setProperty("--accent", lift.accent);
    field.innerHTML =
      '<span class="field__name">' + lift.name + '</span>' +
      '<span class="field__row">' +
        '<input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0">' +
        '<span class="field__unit">кг</span>' +
      '</span>';
    const input = field.querySelector("input");
    input.setAttribute("aria-label", lift.name + ", кг");
    inputs[lift.key] = input;
    inputsEl.appendChild(field);
  }

  // — Таблицы недель —
  for (const week of WEEKS){
    const card = document.createElement("section");
    card.className = "weekcard";
    const head =
      '<tr><th class="wpct">%</th>' +
      LIFTS.map((l) => '<th style="--accent:' + l.accent + '">' + l.short + '</th>').join("") +
      '</tr>';
    const body = week.sets.map((s, si) =>
      '<tr><td class="wpct">' + s.pct + '%</td>' +
      LIFTS.map((l) => '<td class="wval" data-c="' + week.n + '_' + si + '_' + l.key + '">—</td>').join("") +
      '</tr>').join("");
    card.innerHTML =
      '<h3 class="weekcard__title">Неделя ' + week.n + ' <span class="weekcard__kind">' + week.kind + '</span></h3>' +
      '<table class="wtbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
    card.querySelectorAll(".wval").forEach((td) => { cells[td.dataset.c] = td; });
    weeksEl.appendChild(card);
  }

  function recalc(){
    let total = 0, target = 0;
    const maxes = {};
    for (const lift of LIFTS){
      const max = parseNum(inputs[lift.key].value);
      maxes[lift.key] = max;
      total += max;
      if (max > 0) target += round1(max * TARGET_PCT / 100);   // цель = сумма округлённых 105%
    }
    for (const week of WEEKS){
      week.sets.forEach((s, si) => {
        for (const lift of LIFTS){
          const max = maxes[lift.key];
          cells[week.n + "_" + si + "_" + lift.key].textContent = max > 0 ? fmt(max * s.pct / 100) : "—";
        }
      });
    }
    sumNowEl.textContent = total > 0 ? fmt(total) + " кг" : "—";
    sumTgtEl.textContent = total > 0 ? fmt(target) + " кг" : "—";
    persistInputs();
    document.dispatchEvent(new CustomEvent("maxes:changed"));
  }

  /* ───── Хранение текущих значений ───── */
  function persistInputs(){
    const data = {};
    for (const lift of LIFTS) data[lift.key] = inputs[lift.key].value;
    set(KEYS.maxes, data);
  }
  function loadInputs(){
    const data = get(KEYS.maxes, {});
    for (const lift of LIFTS) if (data[lift.key]) inputs[lift.key].value = data[lift.key];
  }

  /* ───── История 1ПМ ───── */
  function saveSnapshot(){
    const rec = { id: Date.now(), ts: Date.now() };
    let any = false;
    for (const lift of LIFTS){
      const v = parseNum(inputs[lift.key].value);
      rec[lift.key] = v;
      if (v > 0) any = true;
    }
    if (!any) return;
    const list = get(KEYS.history, []);
    list.unshift(rec);
    if (list.length > 50) list.length = 50;
    set(KEYS.history, list);
    renderHistory();
  }
  function renderHistory(){
    const list = get(KEYS.history, []);
    if (!list.length){
      historyEl.innerHTML = '<p class="muted">Пока нет записей. Введите веса и нажмите «Сохранить».</p>';
      return;
    }
    historyEl.innerHTML = list.map((rec) => {
      let total = 0;
      for (const lift of LIFTS) total += (rec[lift.key] || 0);
      const parts = LIFTS.map((l) => l.short + " " + fmt(rec[l.key] || 0)).join(" · ");
      return '<div class="hrow">' +
        '<div class="hrow__main">' +
          '<div class="hrow__top"><span class="hrow__date">' + fmtDateTime(rec.ts) + '</span>' +
          '<span class="hrow__total">Σ ' + fmt(total) + ' кг</span></div>' +
          '<div class="hrow__parts">' + parts + '</div>' +
        '</div>' +
        '<div class="hrow__actions">' +
          '<button class="hbtn" data-act="load" data-id="' + rec.id + '">Загрузить</button>' +
          '<button class="hbtn hbtn--del" data-act="del" data-id="' + rec.id + '" aria-label="Удалить">✕</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }
  historyEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const list = get(KEYS.history, []);
    if (btn.dataset.act === "del"){
      set(KEYS.history, list.filter((r) => r.id !== id));
      renderHistory();
    } else if (btn.dataset.act === "load"){
      const rec = list.find((r) => r.id === id);
      if (rec){
        for (const lift of LIFTS) inputs[lift.key].value = rec[lift.key] ? String(rec[lift.key]) : "";
        recalc();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  });

  /* ───── Кнопки ───── */
  for (const lift of LIFTS) inputs[lift.key].addEventListener("input", recalc);
  document.getElementById("save").addEventListener("click", saveSnapshot);
  document.getElementById("reset").addEventListener("click", () => {
    for (const lift of LIFTS) inputs[lift.key].value = "";
    recalc();
    inputs[LIFTS[0].key].focus();
  });

  /* ───── Старт ───── */
  loadInputs();
  recalc();
  renderHistory();
}
