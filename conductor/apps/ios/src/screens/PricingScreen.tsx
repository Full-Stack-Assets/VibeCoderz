/**
 * Plan selection. Used two ways:
 *  - onboarding: shown to a brand-new account right after sign-up.
 *  - manage:     opened from Settings to switch plans.
 * Picking a plan calls `onChoose`; the parent persists it via the auth provider.
 */
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { Theme } from '../theme'
import { SERIF, radius } from '../theme'
import { PLANS, type PlanId } from '../auth'

export function PricingScreen({
  theme,
  mode,
  currentPlan,
  onChoose,
  onClose,
}: {
  theme: Theme
  mode: 'onboarding' | 'manage'
  currentPlan?: PlanId
  onChoose: (plan: PlanId) => Promise<void> | void
  onClose?: () => void
}) {
  const [selected, setSelected] = useState<PlanId>(currentPlan ?? 'free')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onChoose(selected)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>
          {mode === 'onboarding' ? 'Choose your plan' : 'Your plan'}
        </Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          {mode === 'onboarding'
            ? 'Start free — upgrade anytime. The router keeps every plan cost-efficient.'
            : 'Switch anytime. Changes apply to your routing budget immediately.'}
        </Text>

        {PLANS.map((plan) => {
          const active = selected === plan.id
          const isCurrent = currentPlan === plan.id
          return (
            <Pressable
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: active ? theme.coral : theme.line,
                  borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                  {plan.highlight ? (
                    <View style={[styles.badge, { backgroundColor: theme.coralTint }]}>
                      <Text style={[styles.badgeText, { color: theme.coralPress }]}>Popular</Text>
                    </View>
                  ) : null}
                  {isCurrent ? (
                    <View style={[styles.badge, { backgroundColor: theme.surfaceSunk }]}>
                      <Text style={[styles.badgeText, { color: theme.muted }]}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? theme.coral : theme.lineStrong },
                  ]}
                >
                  {active ? <View style={[styles.radioDot, { backgroundColor: theme.coral }]} /> : null}
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: theme.text }]}>{plan.price}</Text>
                <Text style={[styles.period, { color: theme.muted }]}> {plan.period}</Text>
              </View>
              <Text style={[styles.planTagline, { color: theme.muted }]}>{plan.tagline}</Text>

              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.check, { color: theme.green }]}>✓</Text>
                    <Text style={[styles.featureText, { color: theme.textSoft }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )
        })}

        <Pressable
          onPress={confirm}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.coral, opacity: busy || pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onCoral} />
          ) : (
            <Text style={[styles.ctaText, { color: theme.onCoral }]}>
              {mode === 'onboarding'
                ? selected === 'free'
                  ? 'Start with Free'
                  : `Continue with ${PLANS.find((p) => p.id === selected)?.name}`
                : currentPlan === selected
                  ? 'Keep current plan'
                  : `Switch to ${PLANS.find((p) => p.id === selected)?.name}`}
            </Text>
          )}
        </Pressable>

        {mode === 'manage' && onClose ? (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.close, { color: theme.faint }]}>Close</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.fine, { color: theme.faint }]}>
          Demo pricing — no charge is made. Wire to StoreKit/RevenueCat for real billing.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingVertical: 24, gap: 14 },
  title: { fontSize: 28, fontFamily: SERIF, fontWeight: '600' },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  card: { borderRadius: radius.lg, padding: 16, gap: 6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  planName: { fontSize: 19, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  price: { fontSize: 26, fontWeight: '800' },
  period: { fontSize: 14, marginBottom: 4 },
  planTagline: { fontSize: 13.5, lineHeight: 19 },
  features: { marginTop: 8, gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  featureText: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  cta: { borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  ctaText: { fontSize: 16.5, fontWeight: '700' },
  close: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  fine: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
})
