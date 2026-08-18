/** QQ QRC 专用 TripleDES（非标准 S-box，不能用 WebCrypto 标准 3DES 替代） */

const QQ_KEY = Buffer.from('!@#)(*$%123ZXC!@!@#)(NHL', 'ascii');
const ENCRYPT = 1;
const DECRYPT = 0;

const SBOX = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

type KeySchedule = Uint8Array[];

function bitnum(a: Uint8Array, b: number, c: number): number {
  const byteIdx = Math.floor(b / 32) * 4 + 3 - Math.floor((b % 32) / 8);
  return (((a[byteIdx] >>> (7 - (b % 8))) & 0x01) << c) >>> 0;
}

function bitnumIntr(a: number, b: number, c: number): number {
  return (((a >>> (31 - b)) & 1) << c) & 0xff;
}

function bitnumIntl(a: number, b: number, c: number): number {
  return ((((a << b) >>> 0) & 0x80000000) >>> c) >>> 0;
}

function sboxBit(a: number): number {
  return ((a & 0x20) | ((a & 0x1f) >>> 1) | ((a & 0x01) << 4)) & 0x3f;
}

function keySchedule(key: Uint8Array, mode: number): KeySchedule {
  const KEY_RND_SHIFT = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
  const KEY_PERM_C = [56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35];
  const KEY_PERM_D = [62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3];
  const KEY_COMPRESSION = [13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31];
  const schedule: KeySchedule = Array.from({ length: 16 }, () => new Uint8Array(6));
  let c = 0;
  let d = 0;
  let j = 31;
  for (let i = 0; i < 28; i++) {
    c = (c | bitnum(key, KEY_PERM_C[i], j)) >>> 0;
    j--;
  }
  j = 31;
  for (let i = 0; i < 28; i++) {
    d = (d | bitnum(key, KEY_PERM_D[i], j)) >>> 0;
    j--;
  }
  for (let i = 0; i < 16; i++) {
    const shift = KEY_RND_SHIFT[i];
    c = (((c << shift) >>> 0) | (c >>> (28 - shift))) >>> 0;
    c = (c & 0xfffffff0) >>> 0;
    d = (((d << shift) >>> 0) | (d >>> (28 - shift))) >>> 0;
    d = (d & 0xfffffff0) >>> 0;
    const toGen = mode === DECRYPT ? 15 - i : i;
    const round = schedule[toGen];
    round.fill(0);
    for (let k = 0; k < 24; k++) round[Math.floor(k / 8)] |= bitnumIntr(c, KEY_COMPRESSION[k], 7 - (k % 8));
    for (let k = 24; k < 48; k++) round[Math.floor(k / 8)] |= bitnumIntr(d, KEY_COMPRESSION[k] - 27, 7 - (k % 8));
  }
  return schedule;
}

function ip(input: Uint8Array): [number, number] {
  const bits = [57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
  const bits2 = [56, 48, 40, 32, 24, 16, 8, 0, 58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6];
  let s0 = 0;
  let s1 = 0;
  for (let i = 0; i < 32; i++) {
    s0 |= bitnum(input, bits[i], 31 - i);
    s1 |= bitnum(input, bits2[i], 31 - i);
  }
  return [s0 >>> 0, s1 >>> 0];
}

function invIp(state: [number, number], output: Uint8Array): void {
  const [s0, s1] = state;
  output[3] = bitnumIntr(s1, 7, 7) | bitnumIntr(s0, 7, 6) | bitnumIntr(s1, 15, 5) | bitnumIntr(s0, 15, 4) | bitnumIntr(s1, 23, 3) | bitnumIntr(s0, 23, 2) | bitnumIntr(s1, 31, 1) | bitnumIntr(s0, 31, 0);
  output[2] = bitnumIntr(s1, 6, 7) | bitnumIntr(s0, 6, 6) | bitnumIntr(s1, 14, 5) | bitnumIntr(s0, 14, 4) | bitnumIntr(s1, 22, 3) | bitnumIntr(s0, 22, 2) | bitnumIntr(s1, 30, 1) | bitnumIntr(s0, 30, 0);
  output[1] = bitnumIntr(s1, 5, 7) | bitnumIntr(s0, 5, 6) | bitnumIntr(s1, 13, 5) | bitnumIntr(s0, 13, 4) | bitnumIntr(s1, 21, 3) | bitnumIntr(s0, 21, 2) | bitnumIntr(s1, 29, 1) | bitnumIntr(s0, 29, 0);
  output[0] = bitnumIntr(s1, 4, 7) | bitnumIntr(s0, 4, 6) | bitnumIntr(s1, 12, 5) | bitnumIntr(s0, 12, 4) | bitnumIntr(s1, 20, 3) | bitnumIntr(s0, 20, 2) | bitnumIntr(s1, 28, 1) | bitnumIntr(s0, 28, 0);
  output[7] = bitnumIntr(s1, 3, 7) | bitnumIntr(s0, 3, 6) | bitnumIntr(s1, 11, 5) | bitnumIntr(s0, 11, 4) | bitnumIntr(s1, 19, 3) | bitnumIntr(s0, 19, 2) | bitnumIntr(s1, 27, 1) | bitnumIntr(s0, 27, 0);
  output[6] = bitnumIntr(s1, 2, 7) | bitnumIntr(s0, 2, 6) | bitnumIntr(s1, 10, 5) | bitnumIntr(s0, 10, 4) | bitnumIntr(s1, 18, 3) | bitnumIntr(s0, 18, 2) | bitnumIntr(s1, 26, 1) | bitnumIntr(s0, 26, 0);
  output[5] = bitnumIntr(s1, 1, 7) | bitnumIntr(s0, 1, 6) | bitnumIntr(s1, 9, 5) | bitnumIntr(s0, 9, 4) | bitnumIntr(s1, 17, 3) | bitnumIntr(s0, 17, 2) | bitnumIntr(s1, 25, 1) | bitnumIntr(s0, 25, 0);
  output[4] = bitnumIntr(s1, 0, 7) | bitnumIntr(s0, 0, 6) | bitnumIntr(s1, 8, 5) | bitnumIntr(s0, 8, 4) | bitnumIntr(s1, 16, 3) | bitnumIntr(s0, 16, 2) | bitnumIntr(s1, 24, 1) | bitnumIntr(s0, 24, 0);
}

function f(state: number, key: Uint8Array): number {
  const lrgstate = new Uint8Array(6);
  const t1 = (bitnumIntl(state, 31, 0) | ((state & 0xf0000000) >>> 1) | bitnumIntl(state, 4, 5) | bitnumIntl(state, 3, 6) | ((state & 0x0f000000) >>> 3) | bitnumIntl(state, 8, 11) | bitnumIntl(state, 7, 12) | ((state & 0x00f00000) >>> 5) | bitnumIntl(state, 12, 17) | bitnumIntl(state, 11, 18) | ((state & 0x000f0000) >>> 7) | bitnumIntl(state, 16, 23)) >>> 0;
  const t2 = (bitnumIntl(state, 15, 0) | (((state & 0x0000f000) << 15) >>> 0) | bitnumIntl(state, 20, 5) | bitnumIntl(state, 19, 6) | (((state & 0x00000f00) << 13) >>> 0) | bitnumIntl(state, 24, 11) | bitnumIntl(state, 23, 12) | (((state & 0x000000f0) << 11) >>> 0) | bitnumIntl(state, 28, 17) | bitnumIntl(state, 27, 18) | (((state & 0x0000000f) << 9) >>> 0) | bitnumIntl(state, 0, 23)) >>> 0;
  lrgstate[0] = (t1 >>> 24) & 0xff;
  lrgstate[1] = (t1 >>> 16) & 0xff;
  lrgstate[2] = (t1 >>> 8) & 0xff;
  lrgstate[3] = (t2 >>> 24) & 0xff;
  lrgstate[4] = (t2 >>> 16) & 0xff;
  lrgstate[5] = (t2 >>> 8) & 0xff;
  for (let i = 0; i < 6; i++) lrgstate[i] ^= key[i];
  const sboxed = ((SBOX[0][sboxBit(lrgstate[0] >>> 2)] << 28) | (SBOX[1][sboxBit(((lrgstate[0] & 0x03) << 4) | (lrgstate[1] >>> 4))] << 24) | (SBOX[2][sboxBit(((lrgstate[1] & 0x0f) << 2) | (lrgstate[2] >>> 6))] << 20) | (SBOX[3][sboxBit(lrgstate[2] & 0x3f)] << 16) | (SBOX[4][sboxBit(lrgstate[3] >>> 2)] << 12) | (SBOX[5][sboxBit(((lrgstate[3] & 0x03) << 4) | (lrgstate[4] >>> 4))] << 8) | (SBOX[6][sboxBit(((lrgstate[4] & 0x0f) << 2) | (lrgstate[5] >>> 6))] << 4) | SBOX[7][sboxBit(lrgstate[5] & 0x3f)]) >>> 0;
  return (bitnumIntl(sboxed, 15, 0) | bitnumIntl(sboxed, 6, 1) | bitnumIntl(sboxed, 19, 2) | bitnumIntl(sboxed, 20, 3) | bitnumIntl(sboxed, 28, 4) | bitnumIntl(sboxed, 11, 5) | bitnumIntl(sboxed, 27, 6) | bitnumIntl(sboxed, 16, 7) | bitnumIntl(sboxed, 0, 8) | bitnumIntl(sboxed, 14, 9) | bitnumIntl(sboxed, 22, 10) | bitnumIntl(sboxed, 25, 11) | bitnumIntl(sboxed, 4, 12) | bitnumIntl(sboxed, 17, 13) | bitnumIntl(sboxed, 30, 14) | bitnumIntl(sboxed, 9, 15) | bitnumIntl(sboxed, 1, 16) | bitnumIntl(sboxed, 7, 17) | bitnumIntl(sboxed, 23, 18) | bitnumIntl(sboxed, 13, 19) | bitnumIntl(sboxed, 31, 20) | bitnumIntl(sboxed, 26, 21) | bitnumIntl(sboxed, 2, 22) | bitnumIntl(sboxed, 8, 23) | bitnumIntl(sboxed, 18, 24) | bitnumIntl(sboxed, 12, 25) | bitnumIntl(sboxed, 29, 26) | bitnumIntl(sboxed, 5, 27) | bitnumIntl(sboxed, 21, 28) | bitnumIntl(sboxed, 10, 29) | bitnumIntl(sboxed, 3, 30) | bitnumIntl(sboxed, 24, 31)) >>> 0;
}

function cryptBlock(input: Uint8Array, output: Uint8Array, schedule: KeySchedule): void {
  const state = ip(input);
  for (let round = 0; round < 15; round++) {
    const tmp = state[1];
    state[1] = (f(state[1], schedule[round]) ^ state[0]) >>> 0;
    state[0] = tmp;
  }
  state[0] = (f(state[1], schedule[15]) ^ state[0]) >>> 0;
  invIp(state, output);
}

function tripleDesKeySetup(key: Uint8Array, mode: number): [KeySchedule, KeySchedule, KeySchedule] {
  if (mode === ENCRYPT) {
    return [keySchedule(key.subarray(0, 8), mode), keySchedule(key.subarray(8, 16), DECRYPT), keySchedule(key.subarray(16, 24), mode)];
  }
  return [keySchedule(key.subarray(16, 24), mode), keySchedule(key.subarray(8, 16), ENCRYPT), keySchedule(key.subarray(0, 8), mode)];
}

function tripleDesCrypt(input: Uint8Array, output: Uint8Array, schedules: [KeySchedule, KeySchedule, KeySchedule]): void {
  const tmp1 = new Uint8Array(8);
  const tmp2 = new Uint8Array(8);
  cryptBlock(input, tmp1, schedules[0]);
  cryptBlock(tmp1, tmp2, schedules[1]);
  cryptBlock(tmp2, output, schedules[2]);
}

export function qrcTripleDesDecrypt(hexCipher: string): Buffer {
  const clean = hexCipher.replace(/\s+/g, '');
  const cipher = Buffer.from(clean, 'hex');
  if (!cipher.length || cipher.length % 8 !== 0) {
    throw new Error('QRC ciphertext length invalid');
  }
  const schedules = tripleDesKeySetup(QQ_KEY, DECRYPT);
  const out = Buffer.alloc(cipher.length);
  const inBlock = Buffer.alloc(8);
  const outBlock = Buffer.alloc(8);
  for (let i = 0; i < cipher.length; i += 8) {
    cipher.copy(inBlock, 0, i, i + 8);
    tripleDesCrypt(inBlock, outBlock, schedules);
    outBlock.copy(out, i, 0, 8);
  }
  return out;
}
