// Точка входа: собирает разделы и навигацию.
import { initCalc } from "./calc.js";
import { initNav } from "./nav.js";
import { initPrograms, renderPrograms } from "./programs.js";
import { initJournal, renderJournal } from "./journal.js";
import { initAccessories } from "./accessories.js";
import { initProfile } from "./profile.js";
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

// При входе на раздел — перерисовываем (программы/журнал зависят от 1ПМ и списка программ)
initNav((view) => {
  if (view === "programs" && programsRoot) renderPrograms(programsRoot);
  if (view === "journal" && journalRoot) renderJournal(journalRoot);
});

initPwa();
