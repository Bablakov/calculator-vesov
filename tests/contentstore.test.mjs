// Тесты слоя контента: правки админа переопределяют дефолты, сброс возвращает дефолт.
import { eq } from "./_assert.mjs";

// localStorage-заглушка (перекрываем встроенный экспериментальный localStorage в Node)
globalThis.localStorage = (() => {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
})();

const cs = await import("../js/contentstore.js");

console.log("contentstore:");

eq(cs.getErrors() === cs.DEFAULT_ERRORS, true, "по умолчанию getErrors = дефолт");
eq(cs.overrides().errors, false, "по умолчанию errors не переопределён");
cs.saveErrors({ squat: [{ id: "x", name: "Тест", fix: "ف" }] });
eq(cs.getErrors().squat[0].name, "Тест", "после save getErrors отдаёт правку");
eq(cs.overrides().errors, true, "overrides помечает errors изменённым");
cs.resetErrors();
eq(cs.getErrors() === cs.DEFAULT_ERRORS, true, "после reset снова дефолт");
eq(cs.overrides().errors, false, "overrides сброшен");

cs.saveProblemFix({ stuck: ["A", "B"] });
eq(cs.getProblemFix().stuck, ["A", "B"], "fix: правка применяется");
cs.resetProblemFix();
eq(cs.getProblemFix() === cs.DEFAULT_FIX, true, "fix: reset → дефолт");

cs.saveCatalog([{ cat: "X", items: [] }]);
eq(cs.getCatalog()[0].cat, "X", "catalog: правка применяется");
cs.resetCatalog();
eq(cs.getCatalog() === cs.DEFAULT_CATALOG, true, "catalog: reset → дефолт");
