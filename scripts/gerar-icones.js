// Gera o favicon e os ícones do app instalável (o iPhone não aceita SVG na tela de início).
// O símbolo "nxx" fica sobre o branco: o "n" navy sumiria numa aba escura. Rode com: node scripts/gerar-icones.js
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..', 'public');
const SYMBOL = resolve(ROOT, 'marca', 'simbolo.png');
const OUTPUT = resolve(ROOT, 'icons');
const SAMPLES = 8;
const BACKGROUND = [255, 255, 255];
const CLEAR = [0, 0, 0, 0];
const CORNER_SHARE = 15 / 64;
const ICON_SHARE = 0.8;
// No favicon, cada pixel conta: o símbolo ocupa quase toda a largura.
const FAVICON_SHARE = 0.92;
const FAVICON_SIZES = [16, 32, 48];
// Na versão que o Android recorta em círculo, o símbolo precisa caber na área segura.
const MASKABLE_SHARE = 0.68;
const RGBA_CHANNELS = 4;

const paeth = (left, up, corner) => {
  const estimate = left + up - corner;
  const [a, b, c] = [left, up, corner].map((value) => Math.abs(estimate - value));
  if (a <= b && a <= c) return left;
  return b <= c ? up : corner;
};

// Só lê o formato em que a logo foi entregue: 8 bits por canal, com transparência.
function readLogo(path) {
  const data = readFileSync(path);
  const chunks = [];
  let width = 0;
  let height = 0;
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12]) throw new Error('O símbolo precisa ser um PNG de 8 bits com transparência, sem entrelaçamento.');
    }
    if (type === 'IDAT') chunks.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * RGBA_CHANNELS;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i += 1) {
      const left = i >= RGBA_CHANNELS ? pixels[y * stride + i - RGBA_CHANNELS] : 0;
      const up = y ? pixels[(y - 1) * stride + i] : 0;
      const corner = y && i >= RGBA_CHANNELS ? pixels[(y - 1) * stride + i - RGBA_CHANNELS] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter];
      pixels[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + predicted) & 255;
    }
  }
  return { width, height, pixels };
}

const logo = readLogo(SYMBOL);
const logoPixel = (x, y) => {
  const at = (y * logo.width + x) * RGBA_CHANNELS;
  return [logo.pixels[at], logo.pixels[at + 1], logo.pixels[at + 2], logo.pixels[at + 3]];
};

function symbolColor(u, v) {
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
  return logoPixel(Math.floor(u * logo.width), Math.floor(v * logo.height));
}

function insideRounded(x, y, size) {
  const corner = CORNER_SHARE * size;
  const nearX = Math.max(corner, Math.min(size - corner, x));
  const nearY = Math.max(corner, Math.min(size - corner, y));
  return (x - nearX) ** 2 + (y - nearY) ** 2 <= corner ** 2;
}

function sample(x, y, size, { fullBleed, share }) {
  if (!fullBleed && !insideRounded(x, y, size)) return CLEAR;
  const drawnWidth = size * share;
  const drawnHeight = drawnWidth * (logo.height / logo.width);
  const color = symbolColor((x - (size - drawnWidth) / 2) / drawnWidth, (y - (size - drawnHeight) / 2) / drawnHeight);
  if (!color) return [...BACKGROUND, 255];
  const alpha = color[3] / 255;
  return [...BACKGROUND.map((value, index) => value + (color[index] - value) * alpha), 255];
}

function pixel(px, py, size, options) {
  const totals = [0, 0, 0, 0];
  for (let sy = 0; sy < SAMPLES; sy += 1) {
    for (let sx = 0; sx < SAMPLES; sx += 1) {
      sample(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES, size, options).forEach((value, index) => {
        totals[index] += value;
      });
    }
  }
  return totals.map((value) => Math.round(value / SAMPLES ** 2));
}

function pngChunk(type, data) {
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, checksum]);
}

function png(size, options) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    rows[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      Buffer.from(pixel(x, y, size, options)).copy(rows, offset);
      offset += 4;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// O .ico guarda cada tamanho como um PNG: é o que o navegador procura sozinho nas páginas sem aviso de ícone.
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

mkdirSync(OUTPUT, { recursive: true });
const files = {
  // O iPhone arredonda os cantos sozinho e não aceita transparência.
  'icon-180.png': png(180, { fullBleed: true, share: ICON_SHARE }),
  'icon-192.png': png(192, { fullBleed: false, share: ICON_SHARE }),
  'icon-512.png': png(512, { fullBleed: false, share: ICON_SHARE }),
  'maskable-512.png': png(512, { fullBleed: true, share: MASKABLE_SHARE }),
};
for (const [name, content] of Object.entries(files)) writeFileSync(resolve(OUTPUT, name), content);
writeFileSync(resolve(ROOT, 'favicon.ico'), ico(FAVICON_SIZES.map((size) => ({ size, data: png(size, { fullBleed: false, share: FAVICON_SHARE }) }))));
console.log(`Ícones gerados: favicon.ico, ${Object.keys(files).join(', ')}`);
