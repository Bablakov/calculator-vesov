// Просмотр цикла: выбор недели и дня → программа подходов (% · кг · повт).
// Просто и без ввода факта (это отдельная фаза).
import { LIFTS } from "./config.js";
import { buildProgram } from "./cycle.js";
import { parseNum, fmt } from "./util.js";
import { get, KEYS } from "./store.js";

let selWeek = 1;   // выбранная неделя (1..4)
let selDay  = 0;   // выбранный день (индекс в сплите)

export function initCycle(root){
  root.addEventListener("click", (e) => {
    const wp = e.target.closest(".weekpill");
    if (wp){ selWeek = Number(wp.dataset.week); renderCycle(root); return; }
    const dp = e.target.closest(".daypill");
    if (dp){ selDay = Number(dp.dataset.day); renderCycle(root); return; }
  });
  renderCycle(root);
}

export function renderCycle(root){
  const raw = get(KEYS.maxes, {});
  const maxes = {};
  let hasMax = false;
  for (const l of LIFTS){
    maxes[l.key] = parseNum(raw[l.key]);
    if (maxes[l.key] > 0) hasMax = true;
  }
  if (!hasMax){
    root.innerHTML =
      '<div class="cyc-empty">' +
        '<p>Чтобы построить цикл, сначала введите свой 1ПМ в калькуляторе.</p>' +
        '<a class="btn-link" href="#calc">→ Перейти к вводу 1ПМ</a>' +
      '</div>';
    return;
  }

  const program = buildProgram(maxes);
  if (!program.some((w) => w.n === selWeek)) selWeek = 1;
  const week = program.find((w) => w.n === selWeek);
  if (selDay >= week.days.length) selDay = 0;
  const day = week.days[selDay];

  root.innerHTML = weekPills(program) + dayPills(week) + dayProgram(day);
}

function weekPills(program){
  return '<div class="weekpills">' + program.map((w) =>
    '<button type="button" class="weekpill' + (w.n === selWeek ? " is-active" : "") + '" data-week="' + w.n + '">' +
      '<span class="weekpill__n">Неделя ' + w.n + '</span>' +
      '<span class="weekpill__kind">' + w.kind + '</span>' +
    '</button>').join("") + '</div>';
}

function dayPills(week){
  return '<div class="daypills">' + week.days.map((d, i) =>
    '<button type="button" class="daypill' + (i === selDay ? " is-active" : "") + '" data-day="' + i + '">' +
      '<span class="daypill__n">День ' + (i + 1) + '</span>' +
      '<span class="daypill__abbr">' + d.abbr + '</span>' +
    '</button>').join("") + '</div>';
}

function dayProgram(day){
  return '<div class="prog">' + day.exercises.map((ex) =>
    '<div class="progex" style="--accent:' + ex.accent + '">' +
      '<div class="progex__name">' + ex.name + '</div>' +
      '<ol class="psets">' + ex.sets.map((s) => pset(s)).join("") + '</ol>' +
    '</div>').join("") + '</div>';
}

function pset(s){
  const reps = s.reps === "макс" ? "макс" : (s.reps + " раз");
  const plate = (s.plate !== s.exact)
    ? '<span class="pset__plate">≈ ' + fmt(s.plate) + '</span>' : '';
  return '<li class="pset">' +
    '<span class="pset__pct">' + s.pct + '%</span>' +
    '<span class="pset__kg">' + fmt(s.exact) + ' кг</span>' +
    plate +
    '<span class="pset__reps">' + reps + '</span>' +
  '</li>';
}
