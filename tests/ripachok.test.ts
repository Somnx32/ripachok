import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

/** Stand in for the engine beneath the plugin: register commands, start the session. */
const boot = async ($: Engine, on: On) => {
  mock.store(on)
  mock.clock(on)
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('ui.render', async ($$, e) => $$.ui.resolve(e).Box({ key: 'engine-band' }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
}

const run = ($: Engine, args: string) =>
  $.command.run({
    command: 'ripachok',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

const band = (isWorking: boolean) =>
  ({
    plugin: 'ripachok',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking,
      maxRows: 20,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  }) as const

const svgOf = async (ui: { find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) =>
  String((await ui.find({ type: 'Svg' }))?.props.source ?? '')

test('idles at 64px by default, paces while working', async ($, on) => {
  await boot($, on)

  const idle = await $.ui.mount({ ...band(false), surface: 'desktop' })
  const idleSvg = await svgOf(idle)
  expect(idleSvg).toContain('width="80" height="64"')
  expect(idleSvg).toContain('class="asleep"')
  expect(idleSvg).toContain('shape-rendering="crispEdges"')
  expect(idleSvg.length).toBeLessThan(131072)
  await idle.unmount()

  const busy = await $.ui.mount({ ...band(true), surface: 'desktop' })
  const busySvg = await svgOf(busy)
  expect(busySvg).toContain('class="pace"')
  expect(busySvg).toContain('width="320"')
  await busy.unmount()
})

test('slash command hides him and resizes him', async ($, on) => {
  await boot($, on)

  await run($, 'size 1')
  const small = await $.ui.mount({ ...band(false), surface: 'desktop' })
  expect(await svgOf(small)).toContain('width="40" height="32"')
  await small.unmount()

  await run($, '')
  const hidden = await $.ui.mount({ ...band(false), surface: 'desktop' })
  expect(await hidden.find({ type: 'Svg' })).toBeUndefined()
  await hidden.unmount()
})

test('draws true half-block pixels in the terminal band', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  const raster = await ui.find({ type: 'Raster' })
  expect(raster?.props.columns).toBe(40)
  expect(raster?.props.rows).toBe(16)
  // 40 x 16 cells x 3 u32 words x 4 bytes, base64
  expect(String(raster?.props.cells).length).toBe(Math.ceil((40 * 16 * 12) / 3) * 4)
  await ui.unmount()

  const busy = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect((await busy.find({ type: 'Raster' }))?.props.columns).toBe(100)
  await busy.unmount()
})

test('gives up the band when the terminal is too short', async ($, on) => {
  await boot($, on)
  const b = band(false)
  const ui = await $.ui.mount({ ...b, props: { ...b.props, maxRows: 10 }, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})
