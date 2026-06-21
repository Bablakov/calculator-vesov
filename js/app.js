// Точка входа: собирает разделы и навигацию.
import { initCalc } from "./calc.js";
import { initNav } from "./nav.js";
import { initProfile } from "./profile.js";
import { initPwa } from "./pwa.js";

// Раздел «Калькулятор» (4 таблицы недель)
initCalc();

// Раздел «Профиль»
const profileRoot = document.getElementById("profile-root");
if (profileRoot) initProfile(profileRoot);

// Программы / Журнал / Подсобки — заглушки в index.html, модули добавим следующими шагами.

// Навигация по разделам (#calc / #programs / #journal / #accessories / #profile)
initNav();

// PWA
initPwa();
