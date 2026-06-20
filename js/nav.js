// Навигация между разделами по hash (#calc / #cycle / #learn).
const VIEWS = ["calc", "cycle", "profile"];

export function initNav(onChange){
  const tabs = document.getElementById("tabs");

  function show(view){
    if (!VIEWS.includes(view)) view = "calc";
    for (const v of VIEWS){
      const sec = document.getElementById("view-" + v);
      if (sec) sec.hidden = (v !== view);
    }
    if (tabs){
      tabs.querySelectorAll("a").forEach((a) => {
        a.classList.toggle("is-active", a.dataset.tab === view);
      });
    }
    window.scrollTo({ top: 0 });
    if (onChange) onChange(view);
  }

  const fromHash = () => (location.hash || "").replace("#", "") || "calc";
  window.addEventListener("hashchange", () => show(fromHash()));
  show(fromHash());
}
