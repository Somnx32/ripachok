import { EMOTE_GRIDS, GRIDS, RGB } from './art'

/**
 * The terminal renderer: every art pixel is half a cell (▀/▄ with a 24-bit
 * foreground and background), so the 32x32 sprite is 32 columns x 16 rows of
 * true pixels. Frames are computed from the clock and blitted in place.
 */

export const ROWS = 16
export const IDLE_COLUMNS = 40
const SIZE = 32
const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20

const WALK = ['walk0', 'walk1', 'walk2', 'walk1']
const IDLE = ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink', 'idle0', 'idle1']
const WAVE = ['wave0', 'wave1']
const SLEEP = ['sleep0', 'sleep0', 'sleep1', 'sleep1']

export type Scene = {
  frame: string
  x: number
  flip: boolean
  emotes: { name: string; x: number; y: number }[]
}

export type Clocks = {
  /** ms now */
  now: number
  /** ms when the session last went quiet */
  idleSince: number
  /** ms until which he waves hello after a turn */
  greetUntil: number
}

const pick = (seq: string[], now: number, slotMs: number) => seq[Math.floor(now / slotMs) % seq.length] ?? seq[0]!

export function scene(working: boolean, columns: number, c: Clocks, sleepAfterS: number): Scene {
  if (working) {
    const travel = Math.max(0, columns - SIZE)
    const p = travel === 0 ? 0 : Math.floor((c.now / 1000) * 18) % (2 * travel)
    const back = p >= travel
    return { frame: pick(WALK, c.now, 150), x: back ? 2 * travel - p : p, flip: back, emotes: [] }
  }
  if (c.now < c.greetUntil) {
    const bob = Math.floor(c.now / 500) % 2
    return { frame: pick(WAVE, c.now, 250), x: 0, flip: false, emotes: [{ name: 'heart', x: 32, y: 2 - bob }] }
  }
  if (c.now - c.idleSince >= sleepAfterS * 1000) {
    const emotes = [0, 1200].map(offset => {
      const step = Math.floor((((c.now + offset) % 2400) / 2400) * 6)
      return { name: 'z', x: 28 + step, y: 12 - step * 2 }
    })
    return { frame: pick(SLEEP, c.now, 600), x: 0, flip: false, emotes }
  }
  return { frame: pick(IDLE, c.now, 400), x: 0, flip: false, emotes: [] }
}

/** Paint a scene into `columns x 32` pixels (-1 = transparent). */
export function pixels(s: Scene, columns: number): Int32Array {
  const px = new Int32Array(columns * SIZE).fill(-1)
  const stamp = (grid: string[], ox: number, oy: number, flip: boolean) => {
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]!
        if (ch === '.') continue
        const tx = ox + (flip ? row.length - 1 - x : x)
        const ty = oy + y
        if (tx < 0 || tx >= columns || ty < 0 || ty >= SIZE) continue
        px[ty * columns + tx] = RGB[ch] ?? 0
      }
    })
  }
  stamp(GRIDS[s.frame] ?? [], s.x, 0, s.flip)
  for (const e of s.emotes) stamp(EMOTE_GRIDS[e.name] ?? [], e.x, e.y, false)
  return px
}

/** Half-block cells, base64 of little-endian u32 [codePoint, fg, bg] triplets. */
export function cells(px: Int32Array, columns: number): string {
  const words = new Uint32Array(columns * ROWS * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let x = 0; x < columns; x++) {
      const top = px[2 * r * columns + x]!
      const bottom = px[(2 * r + 1) * columns + x]!
      const i = (r * columns + x) * 3
      if (top < 0 && bottom < 0) words.set([SPACE, DEFAULT, DEFAULT], i)
      else if (bottom < 0) words.set([UPPER, top, DEFAULT], i)
      else if (top < 0) words.set([LOWER, bottom, DEFAULT], i)
      else words.set([UPPER, top, bottom], i)
    }
  }
  return base64(new Uint8Array(words.buffer))
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += ABC[(n >> 18) & 63]! + ABC[(n >> 12) & 63]!
    out += b === undefined ? '=' : ABC[(n >> 6) & 63]!
    out += c === undefined ? '=' : ABC[n & 63]!
  }
  return out
}

export function terminalCells(working: boolean, columns: number, c: Clocks, sleepAfterS: number): string {
  return cells(pixels(scene(working, columns, c, sleepAfterS), columns), columns)
}
