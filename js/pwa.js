// PWA: «Поделиться», установка на главный экран, регистрация service worker.
export function initPwa(){
  /* ───── Поделиться ───── */
  const urlEl = document.getElementById("appUrl");
  const APP_URL = urlEl ? urlEl.href : location.href;

  const copyBtn = document.getElementById("copyLink");
  if (copyBtn){
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(APP_URL); copyBtn.textContent = "Скопировано ✓"; }
      catch (e) { copyBtn.textContent = "Скопируйте вручную"; }
      setTimeout(() => { copyBtn.textContent = "Скопировать ссылку"; }, 1800);
    });
  }
  const shareBtn = document.getElementById("shareLink");
  if (shareBtn && navigator.share){
    shareBtn.hidden = false;
    shareBtn.addEventListener("click", () => {
      navigator.share({ title: "Калькулятор процентовки", url: APP_URL }).catch(() => {});
    });
  }

  /* ───── Установка на главный экран ───── */
  const installBtn  = document.getElementById("install");
  const installHelp = document.getElementById("installHelp");
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (installBtn && isStandalone()) installBtn.hidden = true;

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener("appinstalled", () => { if (installBtn) installBtn.hidden = true; deferredPrompt = null; });

  if (installBtn){
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt){
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        return;
      }
      const ios = isIOS();
      document.getElementById("helpIOS").hidden = !ios;
      document.getElementById("helpAndroid").hidden = ios;
      if (typeof installHelp.showModal === "function") installHelp.showModal();
      else installHelp.setAttribute("open", "");
    });
  }
  const helpClose = document.getElementById("helpClose");
  if (helpClose) helpClose.addEventListener("click", () => installHelp.close());

  /* ───── Service worker + автообновление (только по http(s)) ───── */
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")){
    if (navigator.serviceWorker.controller){
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      }).catch(() => {});
    });
  }
}
