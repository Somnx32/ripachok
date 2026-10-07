import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BuddyConfig } from '../types'
import { buildSvg } from './svg'
import { IDLE_COLUMNS, ROWS, terminalCells } from './terminal'

const DEFAULTS: BuddyConfig = { scale: 2, lane: 160, sleepAfter: 90, hidden: false }
const config = atom({ plugin: 'ripachok', key: 'config' } as const, DEFAULTS)

const GREET_MS = 2500
const TICK_MS = 100
const RASTER = 'ripachok-raster'

const HELP = [
  '/ripachok            show or hide him',
  '/ripachok size <n>   desktop: CSS px per art pixel (1 = 32px, 2 = 64px; 1.6 is pixel-exact at 125% Windows scaling)',
  '/ripachok lane <n>   how far he paces while Claude works, in art pixels (40–400)',
  '/ripachok sleep <s>  seconds idle before he dozes off (5–3600)',
  '/ripachok reset      back to defaults',
  '',
  'In a terminal every art pixel is half a cell, so he takes 32 columns × 16 rows (needs a truecolor terminal).',
].join('\n')

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export const register: Register = on => {
  // Module-local animation clocks (a hot reload simply starts them over).
  let idleSince = 0
  let greetUntil = 0
  let lastWorking: boolean | undefined
  let mounted: { requestId: string; columns: number; working: boolean } | null = null
  let lastCells = ''

  const turnEnded = (now: number) => {
    if (now - idleSince > GREET_MS + 500) {
      idleSince = now
      greetUntil = now + GREET_MS
    }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ripachok',
      description: 'Your pixel buddy above the prompt: show/hide, size, lane, sleep',
      argumentHint: '[size <n> | lane <n> | sleep <s> | reset | help]',
      immediate: true,
    })
    const saved = await $.store.get('config')
    if (saved && typeof saved === 'object') {
      await update($, config, () => ({ ...DEFAULTS, ...(saved as Partial<BuddyConfig>) }))
    }
    idleSince = await $.clock.now()

    // Terminal animation: recompute the half-block frame and blit it in place.
    $.clock.every(TICK_MS, async () => {
      const at = mounted
      if (!at) return
      const cfg = await read($, config)
      const now = await $.clock.now()
      const cells = terminalCells(at.working, at.columns, { now, idleSince, greetUntil }, cfg.sleepAfter)
      if (cells === lastCells) return
      lastCells = cells
      const res = await $.ui.blit({ requestId: at.requestId, key: RASTER, cells, columns: at.columns, rows: ROWS })
      if (res && 'deny' in res && res.deny && mounted === at) mounted = null
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    turnEnded(await $.clock.now())
    return next(e)
  })

  on('command.run', { command: 'ripachok' }, async ($, e) => {
    const [verb = '', raw = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const n = Number(raw)
    const cur = await read($, config)
    let nextCfg: BuddyConfig = cur
    let text: string

    if (verb === '' || verb === 'toggle') {
      nextCfg = { ...cur, hidden: !cur.hidden }
      text = nextCfg.hidden ? 'Ripachok went off to pick rapeseed. /ripachok to call him back.' : 'Ripachok is back.'
    } else if (verb === 'show' || verb === 'hide') {
      nextCfg = { ...cur, hidden: verb === 'hide' }
      text = verb === 'hide' ? 'Ripachok hidden.' : 'Ripachok is back.'
    } else if (verb === 'size' && Number.isFinite(n) && n > 0) {
      nextCfg = { ...cur, scale: clamp(Math.round(n * 100) / 100, 0.5, 6) }
      text = `Size ${nextCfg.scale}x — ${Math.round(32 * nextCfg.scale)}px on screen (desktop; the terminal is always 1 art px = half a cell).`
    } else if (verb === 'lane' && Number.isFinite(n)) {
      nextCfg = { ...cur, lane: clamp(Math.round(n), 40, 400) }
      text = `He'll pace across ${nextCfg.lane} art pixels while Claude works.`
    } else if (verb === 'sleep' && Number.isFinite(n)) {
      nextCfg = { ...cur, sleepAfter: clamp(Math.round(n), 5, 3600) }
      text = `He dozes off after ${nextCfg.sleepAfter}s of quiet.`
    } else if (verb === 'reset') {
      nextCfg = DEFAULTS
      text = 'Ripachok reset to defaults.'
    } else {
      return { text: HELP }
    }

    await update($, config, () => nextCfg)
    await $.store.set('config', nextCfg)

    return { text }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const cfg = await read($, config)
    const working = e.props.isWorking
    const now = await $.clock.now()
    if (lastWorking === true && !working) turnEnded(now)
    lastWorking = working

    if (e.props.hasSurvey || cfg.hidden) {
      mounted = null
      return next(e)
    }

    if (e.surface === 'terminal') {
      const room = e.props.bodyColumns
      const columns = working ? clamp(Math.min(cfg.lane, room), 32, 512) : Math.min(IDLE_COLUMNS, room)
      if (e.props.maxRows < ROWS || columns < 32) {
        mounted = null
        return next(e)
      }
      const { Box, Raster } = $.ui.resolve(e)
      mounted = { requestId: e.requestId, columns, working }
      lastCells = terminalCells(working, columns, { now, idleSince, greetUntil }, cfg.sleepAfter)

      return (
        <Box key="ripachok">
          <Raster key={RASTER} columns={columns} rows={ROWS} cells={lastCells} />
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      mounted = null
      const { Box, Svg } = $.ui.resolve(e)
      const mode = working ? 'working' : 'idle'
      const svg = buildSvg(mode, {
        scale: cfg.scale,
        lane: cfg.lane,
        sleepAfter: Math.max(0, cfg.sleepAfter - (now - idleSince) / 1000),
        greetMs: Math.max(0, greetUntil - now),
      })

      return (
        <Box key="ripachok" flexDirection="row">
          <Svg
            source={svg}
            alt={working ? 'Ripachok pacing while Claude works' : 'Ripachok idling'}
            isInteractive
          />
        </Box>
      )
    }

    return next(e)
  })
}
