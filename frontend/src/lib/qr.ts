// A small QR code encoder: byte mode, error correction level M, versions 1 to 10 (up to 213
// bytes). It exists so the certificate can carry a scannable link without a new dependency.
// The algorithm follows the QR Code Model 2 standard (ISO/IEC 18004).

const EC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number): number {
  return Math.floor(rawModules(version) / 8) - EC_PER_BLOCK_M[version]! * BLOCKS_M[version]!;
}

function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomon(data: number[], degree: number): number[] {
  const divisor: number[] = new Array(degree - 1).fill(0).concat([1]);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < divisor.length; j++) {
      divisor[j] = multiply(divisor[j]!, root);
      if (j + 1 < divisor.length) divisor[j]! ^= divisor[j + 1]!;
    }
    root = multiply(root, 2);
  }
  const result: number[] = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i]! ^= multiply(coefficient, factor);
    });
  }
  return result;
}

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

/** The dark/light grid for `text`, without a quiet zone. Throws when the text is too long. */
export function qrModules(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 1;
  while (version <= MAX_VERSION) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version) * 8) break;
    version++;
  }
  if (version > MAX_VERSION) throw new Error("Text is too long for the QR encoder");

  // Bit stream: mode, length, bytes, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => push(byte, 8));
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < dataCodewords(version); pad ^= 0xec ^ 0x11) data.push(pad);

  // Split into blocks, add error correction, interleave.
  const numBlocks = BLOCKS_M[version]!;
  const eccLength = EC_PER_BLOCK_M[version]!;
  const rawCodewords = Math.floor(rawModules(version) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLength = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const length = shortLength - eccLength + (i < numShort ? 0 : 1);
    const part = data.slice(k, k + length);
    k += length;
    const ecc = reedSolomon(part, eccLength);
    if (i < numShort) part.push(0);
    blocks.push(part.concat(ecc));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= numShort) codewords.push(block[i]!);
    });
  }

  // Place the function patterns.
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y]![x] = dark;
    reserved[y]![x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, Math.max(Math.abs(dx), Math.abs(dy)) !== 2 && Math.max(Math.abs(dx), Math.abs(dy)) !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const positions: number[] = [];
  if (version > 1) {
    const count = Math.floor(version / 7) + 2;
    const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    positions.push(6);
    for (let pos = size - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  }
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    });
  });

  const drawFormat = (mask: number) => {
    const formatData = (0 << 3) | mask; // level M is 0
    let rem = formatData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits15 = ((formatData << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(bits15, i));
    setFunction(8, 7, bit(bits15, 6));
    setFunction(8, 8, bit(bits15, 7));
    setFunction(7, 8, bit(bits15, 8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(bits15, i));
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(bits15, i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(bits15, i));
    setFunction(8, size - 8, true);
  };
  drawFormat(0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits18 = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, bit(bits18, i));
      setFunction(b, a, bit(bits18, i));
    }
  }

  // Place the data bits in the zigzag order.
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y]![x] && index < codewords.length * 8) {
          modules[y]![x] = bit(codewords[index >>> 3]!, 7 - (index & 7));
          index++;
        }
      }
    }
  }

  // Pick the mask with the lowest penalty (runs, 2x2 blocks, dark/light balance).
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const invert =
          mask === 0 ? (x + y) % 2 === 0
          : mask === 1 ? y % 2 === 0
          : mask === 2 ? x % 3 === 0
          : mask === 3 ? (x + y) % 3 === 0
          : mask === 4 ? (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
          : mask === 5 ? ((x * y) % 2) + ((x * y) % 3) === 0
          : mask === 6 ? (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
          : (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        if (!reserved[y]![x] && invert) modules[y]![x] = !modules[y]![x];
      }
    }
  };
  const penalty = () => {
    let score = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          const same = (pass === 0 ? modules[a]![b] : modules[b]![a]) === (pass === 0 ? modules[a]![b - 1] : modules[b - 1]![a]);
          if (same) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score++;
          } else run = 1;
        }
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y]![x];
        if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) score += 3;
      }
    }
    const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    score += Math.floor(Math.abs((dark * 20) / (size * size) - 10) / 1) * 10;
    return score;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty();
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(mask);
  }
  applyMask(bestMask);
  drawFormat(bestMask);
  return modules;
}
