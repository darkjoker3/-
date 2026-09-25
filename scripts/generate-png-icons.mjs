import fs from 'fs';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function generatePng(size, filename) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc((width * 4 + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded square background calculation
      const cornerR = size * 0.22;
      const qx = Math.max(0, Math.abs(dx) - (size / 2 - cornerR));
      const qy = Math.max(0, Math.abs(dy) - (size / 2 - cornerR));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);

      let inBg = cornerDist <= cornerR;

      if (inBg) {
        // Violet gradient
        const t = (x + y) / (width * 2);
        let r = Math.round(124 * (1 - t) + 67 * t);
        let g = Math.round(58 * (1 - t) + 56 * t);
        let b = Math.round(237 * (1 - t) + 202 * t);
        let a = 255;

        // Draw pin shape in white
        const pinCy = height * 0.44;
        const pinR = width * 0.25;
        const pdy = y - pinCy;
        const pdist = Math.sqrt(dx * dx + pdy * pdy);

        // Pin head
        if (pdist < pinR) {
          r = 255;
          g = 255;
          b = 255;
        }

        // Pin cone
        if (y >= pinCy && y < height * 0.82) {
          const coneHalfWidth = pinR * (1 - (y - pinCy) / (height * 0.38));
          if (Math.abs(dx) <= coneHalfWidth) {
            r = 255;
            g = 255;
            b = 255;
          }
        }

        // Pin center dot (violet)
        if (pdist < pinR * 0.5) {
          r = 79;
          g = 70;
          b = 229;
        }

        rawData[offset++] = r;
        rawData[offset++] = g;
        rawData[offset++] = b;
        rawData[offset++] = a;
      } else {
        // Transparent outside rounded box
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filename, pngBuffer);
  console.log(`Generated ${filename} (${pngBuffer.length} bytes)`);
}

generatePng(192, 'public/icon-192.png');
generatePng(512, 'public/icon-512.png');
generatePng(180, 'public/apple-touch-icon.png');
