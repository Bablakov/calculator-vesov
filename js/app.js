// Точка входа: собирает разделы и навигацию.
import { initCalc } from "./calc.js";
import { initNav } from "./nav.js";
import { renderCycle, initCycle } from "./cycleview.js";
import { initProfile } from "./profile.js";
import { initPwa } from "./pwa.js";

// Раздел «Калькулятор»
initCalc();

// Раздел «Цикл»: слушатели один раз; перерисовка при входе и при смене 1ПМ
const cycleRoot = document.getElementById("cycle-root");
if (cycleRoot){
  initCycle(cycleRoot);
  document.addEventListener("maxes:changed", () => {
    const view = document.getElementById("view-cycle");
    if (view && !view.hidden) renderCycle(cycleRoot);
  });
}

// Раздел «Профиль»
const profileRoot = document.getElementById("profile-root");
if (profileRoot) initProfile(profileRoot);

// Навигация: при заходе на «Цикл» перерисовываем по актуальному 1ПМ
initNav((view) => {
  if (view === "cycle" && cycleRoot) renderCycle(cycleRoot);
});

// PWA
initPwa();
