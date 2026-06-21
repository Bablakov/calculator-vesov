// Тест подсобок: у каждой типовой ошибки есть подобранные подсобки.
import { eq } from "./_assert.mjs";
import { ERRORS } from "../js/content.js";
import { PROBLEM_FIX, CATALOG } from "../js/accessories.js";

console.log("accessories:");

const allErrorIds = Object.values(ERRORS).flat().map((e) => e.id);
const missing = allErrorIds.filter((id) => !(PROBLEM_FIX[id] && PROBLEM_FIX[id].length));
eq(missing, [], "у каждой ошибки есть подсобки (PROBLEM_FIX)");

eq(CATALOG.length > 0 && CATALOG.every((g) => g.cat && g.items.length > 0), true, "каталог: непустые категории с упражнениями");
