// Слой контента: встроенные дефолты + правки из админ-панели (localStorage).
// Потребители (journal, accessories) читают контент ТОЛЬКО отсюда, чтобы правки
// админа подхватывались везде. Правка = полная замена этого раздела контента
// (редактируемая копия снимается с дефолта). Сброс — удаляет правку.
import { get, set, remove, KEYS } from "./store.js";
import { ERRORS } from "./content.js";
import { CATALOG, PROBLEM_FIX } from "./accessorydata.js";

export const DEFAULT_ERRORS = ERRORS;
export const DEFAULT_CATALOG = CATALOG;
export const DEFAULT_FIX = PROBLEM_FIX;

export function getErrors(){ return get(KEYS.admErrors, null) || ERRORS; }
export function getCatalog(){ return get(KEYS.admCatalog, null) || CATALOG; }
export function getProblemFix(){ return get(KEYS.admFix, null) || PROBLEM_FIX; }

export function saveErrors(v){ set(KEYS.admErrors, v); }
export function saveCatalog(v){ set(KEYS.admCatalog, v); }
export function saveProblemFix(v){ set(KEYS.admFix, v); }

export function resetErrors(){ remove(KEYS.admErrors); }
export function resetCatalog(){ remove(KEYS.admCatalog); }
export function resetProblemFix(){ remove(KEYS.admFix); }

// Какие разделы переопределены админом (для пометки «изменено»).
export function overrides(){
  return {
    errors:  get(KEYS.admErrors, null) != null,
    catalog: get(KEYS.admCatalog, null) != null,
    fix:     get(KEYS.admFix, null) != null,
  };
}

export function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }
