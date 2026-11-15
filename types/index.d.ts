export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = { limits: Limit[]; contextPercent: number | null }
export type UsageSettings = {
  show5h: boolean
  show7d: boolean
  showCtx: boolean
  showReset: boolean
  showBars: boolean
  opacity: number
  barWidth: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-bars': {
      snapshot: Snapshot | null
      settings: UsageSettings
      isEditing: boolean
    }
  }
}
