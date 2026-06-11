import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'

import { getTheme, SERIF } from './src/theme'
import { formatUSD, streamChat, type OutMsg } from './src/api'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from './src/config'
import type { Msg } from './src/types'
import { MessageBubble } from './src/components/MessageBubble'
import { Composer } from './src/components/Composer'
import { SettingsSheet } from './src/components/SettingsSheet'

let counter = 0
const nextId = () => `m${Date.now().toString(36)}-${(counter++).toString(36)}`

export default function App() {
  const scheme = useColorScheme()
  const theme = getTheme(scheme)

  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [sessionSpent, setSessionSpent] = useState(0)
  const [budgetUSD, setBudgetUSD] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const listRef = useRef<FlatList<Msg>>(null)

  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  const patch = useCallback((id: string, fn: (m: Msg) => Msg) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
  }, [])

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [])

  const send = useCallback(
    (text: string) => {
      const userMsg: Msg = { id: nextId(), role: 'user', content: text }
      const assistantId = nextId()
      const assistantMsg: Msg = { id: assistantId, role: 'assistant', content: '', pending: true, steps: [] }

      // Outgoing history: all settled turns + this user turn (the new pending
      // assistant placeholder isn't in `messages` yet, so it's naturally excluded).
      const history: OutMsg[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setBusy(true)

      const cancel = streamChat(
        {
          baseUrl: settings.baseUrl,
          messages: history,
          spentUSD: sessionSpent,
          agentic: settings.agentic,
        },
        {
          onDecision: (d) => {
            if (d?.budget?.budgetUSD) setBudgetUSD(d.budget.budgetUSD)
            patch(assistantId, (m) => ({ ...m, decision: d }))
          },
          onText: (delta) =>
            patch(assistantId, (m) => ({ ...m, pending: false, content: m.content + delta })),
          onTool: (step) =>
            patch(assistantId, (m) => ({ ...m, pending: false, steps: [...(m.steps || []), step] })),
          onDone: (info) => {
            patch(assistantId, (m) => ({
              ...m,
              pending: false,
              simulated: info.simulated,
              costUSD: info.costUSD,
            }))
            if (typeof info.spentUSD === 'number') setSessionSpent(info.spentUSD)
            setBusy(false)
            cancelRef.current = null
          },
          onError: (message) => {
            patch(assistantId, (m) => ({
              ...m,
              pending: false,
              error: true,
              content: m.content || `Couldn't complete this turn — ${message}`,
            }))
            setBusy(false)
            cancelRef.current = null
          },
        }
      )
      cancelRef.current = cancel
    },
    [messages, settings, sessionSpent, patch]
  )

  const stop = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    setBusy(false)
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)))
  }, [])

  const clearConversation = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    setMessages([])
    setSessionSpent(0)
    setBusy(false)
    setSettingsOpen(false)
  }, [])

  const onSaveSettings = useCallback((s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  const budgetPct =
    budgetUSD && budgetUSD > 0 ? Math.min(100, Math.round((sessionSpent / budgetUSD) * 100)) : 0

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.line }]}>
          <View style={styles.brand}>
            <Text style={[styles.wordmark, { color: theme.text }]}>Conductor</Text>
            <Text style={[styles.tagline, { color: theme.muted }]}>
              constraint-optimized assistant
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.costChip, { backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}>
              <View
                style={[styles.costDot, { backgroundColor: budgetPct > 85 ? theme.coralPress : theme.green }]}
              />
              <Text style={[styles.costText, { color: theme.textSoft }]}>
                {formatUSD(sessionSpent)}
                {budgetUSD ? <Text style={{ color: theme.faint }}>{` / ${formatUSD(budgetUSD)}`}</Text> : null}
              </Text>
            </View>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.gear,
                { backgroundColor: theme.surfaceSunk, borderColor: theme.line, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.gearIcon, { color: theme.textSoft }]}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {messages.length === 0 ? (
            <EmptyState theme={theme} baseUrl={settings.baseUrl} />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <MessageBubble msg={item} theme={theme} />}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={scrollToEnd}
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            />
          )}

          <Composer
            theme={theme}
            busy={busy}
            agentic={settings.agentic}
            onToggleAgentic={() => onSaveSettings({ ...settings, agentic: !settings.agentic })}
            onSend={send}
            onStop={stop}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SettingsSheet
        visible={settingsOpen}
        theme={theme}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={onSaveSettings}
        onClear={clearConversation}
      />
    </View>
  )
}

function EmptyState({ theme, baseUrl }: { theme: ReturnType<typeof getTheme>; baseUrl: string }) {
  const host = baseUrl.replace(/^https?:\/\//, '')
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyMark, { color: theme.coral }]}>✶</Text>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>How can I help?</Text>
      <Text style={[styles.emptyBody, { color: theme.muted }]}>
        Every turn is routed to the cheapest model capable of the task. Tap the pill above any reply
        to see the routing decision and cost.
      </Text>
      <Text style={[styles.emptyHost, { color: theme.faint }]}>{host}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: { flexShrink: 1 },
  wordmark: { fontSize: 24, fontFamily: SERIF, fontWeight: '600', letterSpacing: 0.2 },
  tagline: { fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  costChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  costDot: { width: 6, height: 6, borderRadius: 3 },
  costText: { fontSize: 12.5, fontWeight: '600' },
  gear: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 16 },
  listContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyMark: { fontSize: 34, marginBottom: 2 },
  emptyTitle: { fontSize: 26, fontFamily: SERIF, fontWeight: '600' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyHost: { fontSize: 12, marginTop: 8 },
})
