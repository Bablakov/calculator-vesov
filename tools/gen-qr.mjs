/**
 * Генератор статического QR-кода (SVG) на адрес приложения.
 * Используется как build-инструмент: на странице остаётся только <img src="qr.svg">,
 * рантайм-зависимостей нет, всё работает офлайн.
 *
 * Установка инструмента:  npm install --save-dev qrcode
 * Запуск из корня:        node tools/gen-qr.mjs [URL]
 */
import QRCode from "qrcode";
import { fileURLToPath } from "node:url";

const url = process.argv[2] || "https://bablakov.github.io/calculator-vesov/";
const out = fileURLToPath(new URL("../qr.svg", import.meta.url));

await QRCode.toFile(out, url, {
  type: "svg",
  errorCorrectionLevel: "M", // ~15% коррекции — достаточно для экрана/печати
  margin: 2,                 // тихая зона; на странице код ещё в белой карточке
  color: { dark: "#0e1116", light: "#ffffff" }, // тёмные модули на белом — лучше сканируется
});

console.log("qr.svg →", url);
