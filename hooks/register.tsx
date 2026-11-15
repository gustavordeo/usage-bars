import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, SessionRateLimit, SessionContextUsage } from 'claude-code'

import type { UsageSettings, Snapshot } from '../types'

const PANE = 'usage-bars'
const TITLE = 'Uso'
const STORE_KEY = 'settings'

const DEFAULTS: UsageSettings = {
  show5h: true,
  show7d: true,
  showCtx: true,
  showReset: true,
  showBars: true,
  opacity: 100,
  barWidth: 12,
  textColor: 'branco',
}

const snapshot = atom({ plugin: 'usage-bars', key: 'snapshot' } as const, null)
const settings = atom({ plugin: 'usage-bars', key: 'settings' } as const, DEFAULTS)
const isEditing = atom({ plugin: 'usage-bars', key: 'isEditing' } as const, false)

const OPACITIES = [100, 75, 50, 30]

const TEXT_COLORS: { key: string; name: string; hex: string }[] = [
  { key: 'branco', name: 'Branco', hex: '#ffffff' },
  { key: 'cinza', name: 'Cinza', hex: '#a8a8a8' },
  { key: 'azul', name: 'Azul', hex: '#6cb6ff' },
  { key: 'verde', name: 'Verde', hex: '#6bd68a' },
  { key: 'amarelo', name: 'Amarelo', hex: '#f2c94c' },
  { key: 'laranja', name: 'Laranja', hex: '#ff9f5a' },
  { key: 'rosa', name: 'Rosa', hex: '#ff7eb6' },
  { key: 'roxo', name: 'Roxo', hex: '#b48cff' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

function textColor(key: string): { key: string; name: string; hex: string } {
  if (HEX.test(key)) return { key, name: key.toLowerCase(), hex: key.toLowerCase() }
  return TEXT_COLORS.find(c => c.key === key) ?? TEXT_COLORS[0]
}

function swatchSvg(hex: string, isSelected: boolean): string {
  const ring = isSelected
    ? '<rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="#ffffff" stroke-width="2"/>'
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${ring}<rect x="5" y="5" width="22" height="22" rx="5" fill="${hex}"/></svg>`
}
const WIDTHS = [8, 12, 16, 20]

function tinted(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${(opacity / 100).toFixed(2)})`
}

function bar(pct: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function fmtReset(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  if (min < 60) return ` · reseta em ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return ` · reseta em ${h}h${String(min % 60).padStart(2, '0')}`
  const d = Math.floor(h / 24)
  return ` · reseta em ${d}d ${h % 24}h`
}

function toSnapshot(rateLimits: SessionRateLimit[], context: SessionContextUsage): Snapshot {
  return {
    limits: rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
    contextPercent: context.percent ?? null,
  }
}

function next<T>(list: T[], current: T): T {
  const i = list.indexOf(current)
  return list[(i + 1) % list.length]
}

async function change($: EngineInterface, fn: (s: UsageSettings) => UsageSettings): Promise<void> {
  await update($, settings, fn)
  await $.store.set(STORE_KEY, await read($, settings))
}

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

export const register: Register = on => {
  on('session.start', async ($, e, nextHook) => {
    const result = await nextHook(e)

    const saved = (await $.store.get(STORE_KEY)) as Partial<UsageSettings> | undefined
    if (saved && typeof saved === 'object') {
      await update($, settings, () => ({ ...DEFAULTS, ...saved }))
    }

    const u = await $.session.usage()
    await update($, snapshot, () => toSnapshot(u.rateLimits, u.context))

    await $.command.register({ name: 'uso', description: 'Abre o painel de uso (barras de 5h, 7 dias e contexto)' })
    void openPane($)

    return result
  })

  on('command.run', { command: 'uso' }, async $ => {
    const opened = await openPane($)
    return { text: opened.isPlaced ? 'Painel de uso aberto.' : `Painel de uso ainda não apareceu: ${opened.reason}` }
  })

  on('session.measure', async ($, e, nextHook) => {
    await update($, snapshot, () => toSnapshot(e.rateLimits, e.context))
    return nextHook(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Input = 'Input' in ui ? ui.Input : null
    const Svg = 'Svg' in ui ? ui.Svg : null
    const snap = (await read($, snapshot)) ?? { limits: [], contextPercent: null }
    const s: UsageSettings = { ...DEFAULTS, ...(await read($, settings)) }
    const editing = await read($, isEditing)
    const current = textColor(s.textColor)
    const now = await $.clock.now()
    const color = tinted(current.hex, s.opacity)

    type Row = { key: string; label: string; pct: number; detail: string }
    const rows: Row[] = []
    for (const l of snap.limits) {
      if (l.kind === 'five_hour' && !s.show5h) continue
      if (l.kind === 'seven_day' && !s.show7d) continue
      const label = l.kind === 'five_hour' ? '5h' : l.kind === 'seven_day' ? '7d' : l.kind === 'spend_limit' ? 'Gasto' : l.kind
      rows.push({ key: l.kind, label, pct: l.percentUsed, detail: s.showReset ? fmtReset(l.resetsAt, now) : '' })
    }
    if (s.showCtx && snap.contextPercent !== null) {
      rows.push({ key: 'ctx', label: 'Ctx', pct: snap.contextPercent, detail: s.showReset ? ' · contexto' : '' })
    }

    const toggle = (key: string, label: string, isOn: boolean, field: keyof UsageSettings) => (
      <Button
        key={key}
        label={`${isOn ? '☑' : '☐'} ${label}`}
        onPress={() => change($, cur => ({ ...cur, [field]: !cur[field] }))}
      />
    )

    const gear = (
      <Button
        key="settings"
        label="⚙"
        plain
        dimColor
        onPress={() => update($, isEditing, v => !v)}
      />
    )

    return (
      <Box flexDirection="column" gap="xs">
        {rows.length === 0 && (
          <Box flexDirection="row" width="100%" justifyContent="space-between">
            <Text color={color}>Aguardando a primeira resposta para ler os limites…</Text>
            {gear}
          </Box>
        )}
        {rows.map((r, i) => (
          <Box key={r.key} flexDirection="row" width="100%" justifyContent="space-between">
            <Box flexDirection="row" flexShrink={1}>
              <Text bold color={color}>{r.label.padEnd(5)} </Text>
              {s.showBars && <Text color={color}>{bar(r.pct, s.barWidth)} </Text>}
              <Text bold color={color}>{r.pct.toFixed(0).padStart(3)}%</Text>
              <Text color={color}>{r.detail}</Text>
            </Box>
            {i === rows.length - 1 && gear}
          </Box>
        ))}

        {editing && (
          <Box flexDirection="column" gap="xs">
            <Text dimColor>Mostrar</Text>
            {toggle('t5h', 'Limite de 5h', s.show5h, 'show5h')}
            {toggle('t7d', 'Limite de 7 dias', s.show7d, 'show7d')}
            {toggle('tctx', 'Contexto da conversa', s.showCtx, 'showCtx')}
            {toggle('treset', 'Tempo até resetar', s.showReset, 'showReset')}
            {toggle('tbars', 'Barras', s.showBars, 'showBars')}
            <Text dimColor>Aparência</Text>
            <Button
              key="opacity"
              label={`Opacidade: ${s.opacity}%`}
              onPress={() => change($, cur => ({ ...cur, opacity: next(OPACITIES, cur.opacity) }))}
            />
            <Button
              key="width"
              label={`Tamanho da barra: ${s.barWidth}`}
              onPress={() => change($, cur => ({ ...cur, barWidth: next(WIDTHS, cur.barWidth) }))}
            />
            <Text dimColor>Cor do texto</Text>
            <Box flexDirection="row" gap="sm" flexWrap="wrap">
              {TEXT_COLORS.map((c, i) => (
                <Box key={`sw-${c.key}`} flexDirection="column" alignItems="center">
                  {Svg ? (
                    <Svg
                      source={swatchSvg(c.hex, s.textColor === c.key)}
                      alt={`${c.name}${s.textColor === c.key ? ' (atual)' : ''}`}
                      width={32}
                      height={32}
                    />
                  ) : (
                    <Text color={c.hex}>███</Text>
                  )}
                  <Button
                    key={`color-${c.key}`}
                    label={c.name}
                    hotkey={String(i + 1)}
                    plain
                    dimColor={s.textColor !== c.key}
                    onPress={() => change($, cur => ({ ...cur, textColor: c.key }))}
                  />
                </Box>
              ))}
            </Box>
            {Input && (
              <Input
                key="hex"
                label="Código da cor"
                placeholder="Cole um código, ex.: #ff8800"
                submitLabel="Aplicar"
                onSubmit={(value: string) => {
                  const raw = value.trim().replace(/^#?/, '#')
                  const full = /^#[0-9a-fA-F]{3}$/.test(raw)
                    ? '#' + raw.slice(1).split('').map(ch => ch + ch).join('')
                    : raw
                  if (HEX.test(full)) return change($, cur => ({ ...cur, textColor: full.toLowerCase() }))
                  $.ui.toast('Código inválido. Use o formato #rrggbb, por exemplo #ff8800')
                }}
              />
            )}
            <Button key="reset" label="Restaurar padrão" onPress={() => change($, () => DEFAULTS)} />
          </Box>
        )}
      </Box>
    )
  })
}
