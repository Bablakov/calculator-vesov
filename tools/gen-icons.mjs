/**
 * Генератор PNG-иконок из той же фигуры, что и icon.svg.
 * Чистый Node (zlib встроенный), без сторонних пакетов.
 * Запуск из корня проекта:  node tools/gen-icons.mjs
 */
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const GRAD_FROM = "#ff8a4d", GRAD_TO = "#ff4136"; // яркий оранжево-красный градиент фона
const PART = "#ffffff";                            // штанга белая
const SS = 4; // суперсэмплинг для сглаживания краёв

// Фигуры в системе координат 512×512 (как в icon.svg). Порядок = порядок отрисовки.
const SHAPES = [
  { grad: true, x: 0,   y: 0,   w: 512, h: 512, r: 112 },
  { c: PART,    x: 150, y: 236, w: 212, h: 40,  r: 20  },
  { c: PART,    x: 92,  y: 176, w: 34,  h: 160, r: 10  },
  { c: PART,    x: 138, y: 146, w: 40,  h: 220, r: 12  },
  { c: PART,    x: 334, y: 146, w: 40,  h: 220, r: 12  },
  { c: PART,    x: 386, y: 176, w: 34,  h: 160, r: 10  },
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const GF = hex(GRAD_FROM), GT = hex(GRAD_TO);

// Точка внутри прямоугольника со скруглёнными углами?
function inRoundRect(px, py, x, y, w, h, r) {
  const x1 = x + w, y1 = y + h;
  if (px < x || px > x1 || py < y || py > y1) return false;
  const dx = Math.min(px - x, x1 - px), dy = Math.min(py - y, y1 - py);
  if (dx >= r || dy >= r) return true;          // прямые участки
  const ax = r - dx, ay = r - dy;               // угловая четверть круга
  return ax * ax + ay * ay <= r * r;
}

function renderRGBA(size) {
  const S = size * SS, k = S / 512;
  const big = new Uint8Array(S * S * 4);        // прозрачный фон по умолчанию

  for (const sh of SHAPES) {
    const solid = sh.c ? hex(sh.c) : null;
    const x = sh.x * k, y = sh.y * k, w = sh.w * k, h = sh.h * k, rad = sh.r * k;
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(S - 1, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(S - 1, Math.ceil(y + h));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        if (inRoundRect(px + 0.5, py + 0.5, x, y, w, h, rad)) {
          let r, g, b;
          if (sh.grad) {                         // диагональный градиент top-left → bottom-right
            const t = Math.min(1, Math.max(0, (px + py) / (2 * S)));
            r = Math.round(GF[0] + (GT[0] - GF[0]) * t);
            g = Math.round(GF[1] + (GT[1] - GF[1]) * t);
            b = Math.round(GF[2] + (GT[2] - GF[2]) * t);
          } else {
            r = solid[0]; g = solid[1]; b = solid[2];
          }
          const i = (py * S + px) * 4;
          big[i] = r; big[i + 1] = g; big[i + 2] = b; big[i + 3] = 255;
        }
      }
    }
  }

  // Даунсэмпл боксом SS×SS с учётом альфы (premultiplied) — корректное сглаживание по краю.
  const out = new Uint8Array(size * size * 4), n = SS * SS;
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = (((oy * SS + sy) * S) + (ox * SS + sx)) * 4;
          const a = big[i + 3];
          R += big[i] * a; G += big[i + 1] * a; B += big[i + 2] * a; A += a;
        }
      }
      const oi = (oy * size + ox) * 4;
      if (A > 0) { out[oi] = Math.round(R / A); out[oi + 1] = Math.round(G / A); out[oi + 2] = Math.round(B / A); }
      out[oi + 3] = Math.round(A / n);
    }
  }
  return out;
}

/* ── Минимальный кодировщик PNG (RGBA, 8 бит, тип 6) ── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const u32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 6, 0, 0, 0])]);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);       // фильтр 0 перед каждой строкой
  for (let y = 0; y < size; y++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

for (const size of [192, 512, 180]) {
  const png = encodePNG(size, renderRGBA(size));
  writeFileSync(new URL(`../icon-${size}.png`, import.meta.url), png);
  console.log(`icon-${size}.png — ${png.length} bytes`);
}
