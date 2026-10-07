import { EMOTES, FRAMES } from './art'
import type { Layer } from './art'

export type Mode = 'idle' | 'working'

export type SvgOptions = {
  /** CSS pixels per art pixel. */
  scale: number
  /** Width of the walking lane while Claude works, in art pixels. */
  lane: number
  /** Seconds idle before he dozes off. */
  sleepAfter: number
  /** Milliseconds left of waving hello after a turn finished (0 = none). */
  greetMs?: number
}

const SIZE = 32
const IDLE_WIDTH = 40

const layers = (list: Layer[]) =>
  list.map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('')

const defs = (frames: string[], emotes: string[]) =>
  '<defs>' +
  frames.map(f => `<g id="f-${f}">${layers(FRAMES[f] ?? [])}</g>`).join('') +
  emotes.map(e => `<g id="e-${e}">${layers(EMOTES[e] ?? [])}</g>`).join('') +
  '</defs>'

const pct = (n: number) => `${+n.toFixed(3)}%`

/**
 * A flip-book: each frame is a <use> whose opacity is switched on for its own
 * slots of `seq`, every slot `slot` seconds long. Pure CSS, no script.
 */
function flipbook(prefix: string, seq: string[], slot: number) {
  const unique = [...new Set(seq)]
  const total = seq.length * slot
  let css = ''
  let body = ''
  for (const f of unique) {
    const name = `${prefix}-${f}`
    const steps = seq.map((s, i) => `${pct((i * 100) / seq.length)}{opacity:${s === f ? 1 : 0}}`)
    steps.push(`100%{opacity:${seq[0] === f ? 1 : 0}}`)
    css += `@keyframes ${name}{${steps.join('')}}`
    css += `.${name}{opacity:0;animation:${name} ${total}s step-end infinite}`
    body += `<use href="#f-${f}" class="${name}"/>`
  }
  return { css, body, frames: unique }
}

const IDLE_SEQ = ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink', 'idle0', 'idle1']
const WAVE_SEQ = ['wave0', 'wave1']
const SLEEP_SEQ = ['sleep0', 'sleep0', 'sleep1', 'sleep1']
const WALK_SEQ = ['walk0', 'walk1', 'walk2', 'walk1']

const BASE_CSS =
  'svg{overflow:hidden}' +
  '@media (prefers-reduced-motion: reduce){*{animation-play-state:paused!important}}'

function frame(width: number, scale: number, alt: string, css: string, inner: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${SIZE}" ` +
    `width="${width * scale}" height="${SIZE * scale}" shape-rendering="crispEdges">` +
    `<title>${alt}</title><style>${BASE_CSS}${css}</style>${inner}</svg>`
  )
}

/** Idle: breathes and blinks, waves the rapeseed on hover, dozes off after a while. */
function idleSvg(o: SvgOptions) {
  const calm = flipbook('i', IDLE_SEQ, 0.4)
  const wave = flipbook('w', WAVE_SEQ, 0.25)
  const sleep = flipbook('s', SLEEP_SEQ, 0.6)
  const after = Math.max(0, Math.round(o.sleepAfter * 10) / 10)
  const greet = Math.max(0, Math.round(o.greetMs ?? 0)) / 1000
  const greetCss = greet
    ? `.calm{animation:hold 0s linear ${greet}s backwards}@keyframes hold{from,to{visibility:hidden}}` +
      `.greeting{animation:gone 0s linear ${greet}s forwards}@keyframes gone{to{visibility:hidden}}` +
      'svg:hover .greeting{display:none}'
    : '.greeting{display:none}'
  const css =
    greetCss +
    calm.css + wave.css + sleep.css +
    '.wavey{display:none}' +
    'svg:hover .calm{display:none}svg:hover .wavey{display:inline}' +
    `.awake{animation:doze 0s linear ${after}s forwards}@keyframes doze{to{opacity:0}}` +
    `.asleep{opacity:0;animation:wake 0s linear ${after}s forwards}@keyframes wake{to{opacity:1}}` +
    'svg:hover .awake{opacity:1!important}svg:hover .asleep{display:none}' +
    // heart bobs one pixel
    '.heart{animation:bob .5s step-end infinite}@keyframes bob{0%{transform:translate(32px,2px)}50%{transform:translate(32px,1px)}}' +
    // two little Zs drifting up and right in pixel steps
    '.z{opacity:0;animation:rise 2.4s steps(6,end) infinite}' +
    '@keyframes rise{0%{opacity:1;transform:translate(28px,12px)}85%{opacity:1}100%{opacity:0;transform:translate(35px,0px)}}' +
    '.z2{animation-delay:1.2s}'
  const inner =
    defs([...calm.frames, ...wave.frames, ...sleep.frames], ['heart', 'z']) +
    `<g class="awake"><g class="calm">${calm.body}</g>` +
    `<g class="greeting">${wave.body}<use href="#e-heart" class="heart"/></g>` +
    `<g class="wavey">${wave.body}<use href="#e-heart" class="heart"/></g></g>` +
    `<g class="asleep">${sleep.body}` +
    '<use href="#e-z" class="z"/><use href="#e-z" class="z z2"/></g>'
  return frame(IDLE_WIDTH, o.scale, 'Ripachok, your little stalker, idling', css, inner)
}

/** Working: paces back and forth along the lane, one art pixel per step. */
function workingSvg(o: SvgOptions) {
  const lane = Math.max(SIZE + 8, Math.round(o.lane))
  const travel = lane - SIZE
  const walk = flipbook('k', WALK_SEQ, 0.15)
  // ~18 art px per second, plus short pauses at each end
  const duration = +((2 * travel) / 18 / 0.92).toFixed(2)
  const move = `steps(${travel},end)`
  const css =
    walk.css +
    `.pace{animation:pace ${duration}s linear infinite}` +
    '@keyframes pace{' +
    `0%{transform:translateX(0px);animation-timing-function:${move}}` +
    `46%{transform:translateX(${travel}px);animation-timing-function:step-end}` +
    `50%{transform:translateX(${travel}px);animation-timing-function:${move}}` +
    '96%{transform:translateX(0px);animation-timing-function:step-end}' +
    '100%{transform:translateX(0px)}}' +
    `.face{animation:face ${duration}s step-end infinite}` +
    '@keyframes face{0%{transform:none}48%{transform:matrix(-1,0,0,1,32,0)}98%{transform:none}100%{transform:none}}'
  const inner = defs(walk.frames, []) + `<g class="pace"><g class="face">${walk.body}</g></g>`
  return frame(lane, o.scale, 'Ripachok pacing while Claude works', css, inner)
}

export function buildSvg(mode: Mode, o: SvgOptions): string {
  return mode === 'working' ? workingSvg(o) : idleSvg(o)
}
