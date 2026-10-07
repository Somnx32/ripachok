export type BuddyConfig = {
  /** CSS pixels per art pixel (2 = 64x64 on screen). */
  scale: number
  /** Walking lane width in art pixels while Claude works. */
  lane: number
  /** Seconds of idling before he falls asleep. */
  sleepAfter: number
  hidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    ripachok: { config: BuddyConfig }
  }
}
