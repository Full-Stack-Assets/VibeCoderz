import { StyleSheet, Text, View } from 'react-native'
import type { ToolStep } from '../types'
import type { Theme } from '../theme'
import { MONO, radius } from '../theme'

/** A compact card for one agentic tool call (name, args summary, result). */
export function ToolStepView({ step, theme }: { step: ToolStep; theme: Theme }) {
  const ok = step.result?.ok
  const argSummary = summarizeArgs(step.args)
  const output = step.result?.error || step.result?.output || ''
  const citations = step.result?.results
  const hasData = typeof step.result?.rows === 'number'

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}>
      <View style={styles.head}>
        <View
          style={[styles.statusDot, { backgroundColor: ok ? theme.green : theme.coralPress }]}
        />
        <Text style={[styles.tool, { color: theme.textSoft }]}>{step.tool}</Text>
        {argSummary ? (
          <Text style={[styles.args, { color: theme.muted }]} numberOfLines={1}>
            {argSummary}
          </Text>
        ) : null}
      </View>

      {output ? (
        <Text style={[styles.output, { color: theme.muted }]} numberOfLines={4}>
          {output.trim()}
        </Text>
      ) : null}

      {hasData ? (
        <Text style={[styles.meta, { color: theme.faint }]}>
          {step.result.rows} rows · {(step.result.columns || []).length} cols
        </Text>
      ) : null}

      {citations?.length ? (
        <View style={styles.cites}>
          {citations.slice(0, 3).map((c, i) => (
            <Text key={i} style={[styles.cite, { color: theme.blue }]} numberOfLines={1}>
              ↳ {c.title}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function summarizeArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args || {})
  if (!entries.length) return ''
  return entries
    .map(([k, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}: ${s.length > 40 ? s.slice(0, 40) + '…' : s}`
    })
    .join('  ')
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  tool: { fontSize: 13, fontWeight: '700', fontFamily: MONO },
  args: { fontSize: 12, fontFamily: MONO, flexShrink: 1 },
  output: { fontSize: 12.5, fontFamily: MONO, lineHeight: 17 },
  meta: { fontSize: 11.5, fontFamily: MONO },
  cites: { gap: 2 },
  cite: { fontSize: 12 },
})
