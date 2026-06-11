import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { RouteDecision } from '../types'
import type { Theme } from '../theme'
import { MONO, radius } from '../theme'
import { formatUSD } from '../api'

/**
 * The signature Conductor affordance: a small pill above each assistant turn
 * showing which model the COO engine routed to and the estimated cost. Tapping
 * it opens a sheet with the full routing rationale (score, domain, candidates,
 * budget) — the same evidence the web OrchestrationPanel surfaces.
 */
export function DecisionPill({
  decision,
  simulated,
  theme,
}: {
  decision: RouteDecision
  simulated?: boolean
  theme: Theme
}) {
  const [open, setOpen] = useState(false)
  const model = decision.model

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: theme.coralTint,
            borderColor: theme.line,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: theme.coral }]} />
        <Text style={[styles.pillText, { color: theme.textSoft }]} numberOfLines={1}>
          {model ? model.label : 'no route'}
          <Text style={{ color: theme.muted }}>{`  ·  ${formatUSD(decision.estCostUSD)}`}</Text>
        </Text>
        {simulated ? (
          <Text style={[styles.sim, { color: theme.muted, borderColor: theme.line }]}>sim</Text>
        ) : null}
        <Text style={[styles.chev, { color: theme.faint }]}>ⓘ</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Routing decision</Text>
              <Text style={[styles.reason, { color: theme.muted }]}>{decision.reason}</Text>

              {model ? (
                <Row theme={theme} label="Model" value={`${model.label}`} sub={model.id} />
              ) : (
                <Row theme={theme} label="Model" value="— (budget guardrail)" />
              )}
              <Row
                theme={theme}
                label="Task"
                value={decision.classification.type}
                sub={decision.classification.domain}
              />
              <Row theme={theme} label="Score" value={decision.score.toFixed(3)} />
              <Row theme={theme} label="Est. cost" value={formatUSD(decision.estCostUSD)} />
              <Row
                theme={theme}
                label="Complexity"
                value={`${Math.round(decision.classification.complexity * 100)}%`}
              />
              {decision.fallback ? <Tag theme={theme} text="fallback route" /> : null}
              {decision.overridden ? <Tag theme={theme} text="user override" /> : null}

              {decision.candidates?.length ? (
                <>
                  <Text style={[styles.section, { color: theme.textSoft }]}>Candidates</Text>
                  {decision.candidates.map((c) => (
                    <View key={c.id} style={styles.candRow}>
                      <View
                        style={[
                          styles.candDot,
                          {
                            backgroundColor:
                              c.id === model?.id ? theme.coral : c.typeMatch ? theme.green : theme.faint,
                          },
                        ]}
                      />
                      <Text style={[styles.candLabel, { color: theme.textSoft }]} numberOfLines={1}>
                        {c.label}
                      </Text>
                      <Text style={[styles.candScore, { color: theme.muted }]}>{c.score.toFixed(3)}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={[styles.section, { color: theme.textSoft }]}>Budget</Text>
              <View style={[styles.budgetTrack, { backgroundColor: theme.surfaceSunk }]}>
                <View
                  style={[
                    styles.budgetFill,
                    {
                      backgroundColor: decision.budget.throttled ? theme.coralPress : theme.coral,
                      width: `${Math.min(100, Math.round(decision.budget.utilization * 100))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.budgetText, { color: theme.muted }]}>
                {formatUSD(decision.budget.spentUSD)} / {formatUSD(decision.budget.budgetUSD)} used
                {decision.budget.throttled ? '  ·  throttled' : ''}
              </Text>

              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [
                  styles.close,
                  { backgroundColor: theme.surfaceSunk, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.closeText, { color: theme.textSoft }]}>Close</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function Row({
  theme,
  label,
  value,
  sub,
}: {
  theme: Theme
  label: string
  value: string
  sub?: string
}) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.line }]}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
        {sub ? <Text style={[styles.rowSub, { color: theme.faint }]}>{sub}</Text> : null}
      </View>
    </View>
  )
}

function Tag({ theme, text }: { theme: Theme; text: string }) {
  return (
    <Text style={[styles.tagInline, { color: theme.coral, borderColor: theme.coral }]}>{text}</Text>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    maxWidth: '92%',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  sim: {
    fontSize: 10,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  chev: { fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,19,0.32)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  reason: { fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLabel: { fontSize: 13, paddingTop: 1 },
  rowValueWrap: { flexShrink: 1, alignItems: 'flex-end' },
  rowValue: { fontSize: 14.5, fontWeight: '600', textAlign: 'right' },
  rowSub: { fontSize: 11.5, fontFamily: MONO, marginTop: 2, textAlign: 'right' },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  candDot: { width: 7, height: 7, borderRadius: 4 },
  candLabel: { flex: 1, fontSize: 13.5 },
  candScore: { fontSize: 12.5, fontFamily: MONO },
  budgetTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  budgetFill: { height: 8, borderRadius: 4 },
  budgetText: { fontSize: 12, marginTop: 6 },
  tagInline: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  close: { marginTop: 22, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '600' },
})
