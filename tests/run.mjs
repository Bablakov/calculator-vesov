// Запуск всех тестов: node tests/run.mjs  (или npm test)
import "./cycle.test.mjs";
import "./profile.test.mjs";
import "./programs.test.mjs";
import "./journal.test.mjs";
import "./accessories.test.mjs";
import { summary } from "./_assert.mjs";

summary();
