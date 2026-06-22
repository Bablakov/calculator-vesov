// Точка входа: собирает разделы и навигацию.
import { initCalc } from "./calc.js";
import { initNav } from "./nav.js";
import { initPrograms, renderPrograms } from "./programs.js";
import { initJournal, renderJournal } from "./journal.js";
import { initAccessories } from "./accessories.js";
import { initProfile } from "./profile.js";
import { initReports, renderReports } from "./reports.js";
import { initAdmin, renderAdmin } from "./admin.js";
import { initPwa } from "./pwa.js";

initCalc();

const programsRoot = document.getElementById("programs-root");
if (programsRoot) initPrograms(programsRoot);

const journalRoot = document.getElementById("journal-root");
if (journalRoot) initJournal(journalRoot);

const accRoot = document.getElementById("accessories-root");
if (accRoot) initAccessories(accRoot);

const profileRoot = document.getElementById("profile-root");
if (profileRoot) initProfile(profileRoot);

const reportsRoot = document.getElementById("reports-root");
if (reportsRoot) initReports(reportsRoot);

const adminRoot = document.getElementById("admin-root");
if (adminRoot) initAdmin(adminRoot);

// При входе на раздел — перерисовываем (зависят от 1ПМ, программ, сессий, контента)
initNav((view) => {
  if (view === "programs" && programsRoot) renderPrograms(programsRoot);
  if (view === "journal" && journalRoot) renderJournal(journalRoot);
  if (view === "reports" && reportsRoot) renderReports(reportsRoot);
  if (view === "admin" && adminRoot) renderAdmin(adminRoot);
});

initPwa();
