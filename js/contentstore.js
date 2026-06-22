// Слой контента: встроенные дефолты + правки из админ-панели (localStorage).
// Потребители (journal, accessories) читают контент ТОЛЬКО отсюда, чтобы правки
// админа подхватывались везде. Правка = полная замена этого раздела контента
// (редактируемая копия снимается с дефолта). Сброс — удаляет правку.
import { get, set, remove, KEYS } from "./store.js";
import { WEEKS } from "./config.js";
import { ERRORS } from "./content.js";
import { CATALOG, PROBLEM_FIX, ACC_DEFAULTS } from "./accessorydata.js";

export const DEFAULT_ERRORS = ERRORS;
export const DEFAULT_CATALOG = CATALOG;
export const DEFAULT_FIX = PROBLEM_FIX;
export const DEFAULT_WEEKS = WEEKS;
export const DEFAULT_ACCDEF = ACC_DEFAULTS;

export function getErrors(){ return get(KEYS.admErrors, null) || ERRORS; }
export function getCatalog(){ return get(KEYS.admCatalog, null) || CATALOG; }
export function getProblemFix(){ return get(KEYS.admFix, null) || PROBLEM_FIX; }
export function getWeeks(){ return get(KEYS.admWeeks, null) || WEEKS; }
export function getAccDefaults(){ return get(KEYS.admAcc, null) || ACC_DEFAULTS; }

export function saveErrors(v){ set(KEYS.admErrors, v); }
export function saveCatalog(v){ set(KEYS.admCatalog, v); }
export function saveProblemFix(v){ set(KEYS.admFix, v); }
export function saveWeeks(v){ set(KEYS.admWeeks, v); }
export function saveAccDefaults(v){ set(KEYS.admAcc, v); }

export function resetErrors(){ remove(KEYS.admErrors); }
export function resetCatalog(){ remove(KEYS.admCatalog); }
export function resetProblemFix(){ remove(KEYS.admFix); }
export function resetWeeks(){ remove(KEYS.admWeeks); }
export function resetAccDefaults(){ remove(KEYS.admAcc); }

// Какие разделы переопределены админом (для пометки «изменено»).
export function overrides(){
  return {
    errors:  get(KEYS.admErrors, null) != null,
    catalog: get(KEYS.admCatalog, null) != null,
    fix:     get(KEYS.admFix, null) != null,
    template: get(KEYS.admWeeks, null) != null || get(KEYS.admAcc, null) != null,
  };
}

export function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }
