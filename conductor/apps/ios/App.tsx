import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { getTheme, SERIF, type Theme } from './src/theme'
import { formatUSD, streamChat, toOutAttachments, type OutMsg } from './src/api'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './src/config'
import type { Attachment, Msg } from './src/types'
import { planById, type PlanId } from './src/auth'
import { AuthContextProvider, useAuth } from './src/context/AuthContext'
import { loadMemory, saveMemory, clearMemory } from './src/storage'
import { MessageBubble } from './src/components/MessageBubble'
import { Composer } from './src/components/Composer'
import { SettingsSheet } from './src/components/SettingsSheet'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import { AuthFlow } from './src/screens/AuthFlow'
import { PricingScreen } from './src/screens/PricingScreen'

let counter = 0
const nextId = () => `m${Date.now().toString(36)}-${(counter++).toString(36)}`

export default function App() {
  return (
    <ErrorBoundary>
      <AuthContextProvider>
        <Root />
      </AuthContextProvider>
    </ErrorBoundary>
  )
}

function Root() {
  const scheme = useColorScheme()
  const theme = getTheme(scheme)
  const { loading, user, setPlan } = useAuth()
  const [onboarding, setOnboarding] = useState(false)

  let body: ReactNode
  if (loading) {
    body = <Splash theme={theme} />
  } else if (!user) {
    body = <AuthFlow theme={theme} onAuthenticated={(isNewUser) => setOnboarding(isNewUser)} />
  } else if (onboarding) {
    body = (
      <PricingScreen
        theme={theme}
        mode="onboarding"
        currentPlan={user.plan}
        onChoose={async (plan) => {
          await setPlan(plan)
          setOnboarding(false)
        }}
      />
    )
  } else {
    body = <ChatApp theme={theme} />
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {body}
    </View>
  )
}

function Splash({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.splash, { backgroundColor: theme.bg }]}>
      <Text style={[styles.splashMark, { color: theme.coral }]}>✶</Text>
      <ActivityIndicator color={theme.muted} />
    </View>
  )
}

function ChatApp({ theme }: { theme: Theme }) {
  const { user, signOut, setPlan } = useAuth()
  const userId = user?.id ?? 'anon'

  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [sessionSpent, setSessionSpent] = useState(0)
  const [budgetUSD, setBudgetUSD] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [memoryLoaded, setMemoryLoaded] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const listRef = useRef<FlatList<Msg>>(null)
  const convoRef = useRef<string | undefined>(undefined)

  // Latest-value refs so the unmount/background flush always persists fresh state.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const spentRef = useRef(sessionSpent)
  spentRef.current = sessionSpent

  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  // Restore this user's conversation memory on mount / account switch.
  useEffect(() => {
    let alive = true
    setMemoryLoaded(false)
    loadMemory(userId).then((mem) => {
      if (!alive) return
      if (mem) {
        setMessages(mem.messages)
        setSessionSpent(mem.sessionSpent)
        convoRef.current = mem.conversationId
      }
      setMemoryLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [userId])

  const flush = useCallback(() => {
    if (!memoryLoaded) return // don't clobber stored memory before it's loaded
    saveMemory(userId, {
      messages: messagesRef.current,
      sessionSpent: spentRef.current,
      conversationId: convoRef.current,
    })
  }, [userId, memoryLoaded])

  // Debounced persistence: captures partial streaming text continuously.
  useEffect(() => {
    if (!memoryLoaded) return
    const t = setTimeout(flush, 400)
    return () => clearTimeout(t)
  }, [messages, sessionSpent, memoryLoaded, flush])

  // Immediate flush when the app backgrounds — survives mid-stream interruptions.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushRef.current()
    })
    return () => sub.remove()
  }, [])
  useEffect(() => () => flushRef.current(), [])

  const patch = useCallback((id: string, fn: (m: Msg) => Msg) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
  }, [])

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [])

  const send = useCallback(
    (text: string, attachments: Attachment[]) => {
      const userMsg: Msg = {
        id: nextId(),
        role: 'user',
        content: text,
        attachments: attachments.length ? attachments : undefined,
      }
      const assistantId = nextId()
      const assistantMsg: Msg = { id: assistantId, role: 'assistant', content: '', pending: true, steps: [] }

      const history: OutMsg[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
        attachments: toOutAttachments(m.attachments),
      }))

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setBusy(true)

      const cancel = streamChat(
        {
          baseUrl: settings.baseUrl,
          messages: history,
          spentUSD: sessionSpent,
          agentic: settings.agentic,
          conversationId: convoRef.current,
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
            if (info.conversationId) convoRef.current = info.conversationId
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
    // Keep whatever streamed so far; just settle the pending flag.
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)))
  }, [])

  const newChat = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    convoRef.current = undefined
    setMessages([])
    setSessionSpent(0)
    setBusy(false)
    setSettingsOpen(false)
    clearMemory(userId)
  }, [userId])

  const onSaveSettings = useCallback((s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  const onSignOut = useCallback(async () => {
    cancelRef.current?.()
    cancelRef.current = null
    flushRef.current() // persist before leaving so memory is intact on return
    setSettingsOpen(false)
    await signOut()
  }, [signOut])

  const plan = planById(user?.plan)
  const budgetPct =
    budgetUSD && budgetUSD > 0 ? Math.min(100, Math.round((sessionSpent / budgetUSD) * 100)) : 0
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <View style={styles.brand}>
          <Text style={[styles.wordmark, { color: theme.text }]}>Conductor</Text>
          <Text style={[styles.tagline, { color: theme.muted }]}>{plan.name} plan</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.costChip, { backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}>
            <View style={[styles.costDot, { backgroundColor: budgetPct > 85 ? theme.coralPress : theme.green }]} />
            <Text style={[styles.costText, { color: theme.textSoft }]}>
              {formatUSD(sessionSpent)}
              {budgetUSD ? <Text style={{ color: theme.faint }}>{` / ${formatUSD(budgetUSD)}`}</Text> : null}
            </Text>
          </View>
          <Pressable onPress={newChat} hitSlop={10} style={({ pressed }) => [styles.iconBtn, { backgroundColor: theme.surfaceSunk, borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.iconText, { color: theme.textSoft }]}>＋</Text>
          </Pressable>
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10} style={({ pressed }) => [styles.avatar, { backgroundColor: theme.coral, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.avatarText, { color: theme.onCoral }]}>{initial}</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!memoryLoaded ? (
          <View style={styles.flex} />
        ) : messages.length === 0 ? (
          <EmptyState theme={theme} name={user?.name} />
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

      <SettingsSheet
        visible={settingsOpen}
        theme={theme}
        settings={settings}
        user={user}
        planName={plan.name}
        onClose={() => setSettingsOpen(false)}
        onSave={onSaveSettings}
        onNewChat={newChat}
        onManagePlan={() => {
          setSettingsOpen(false)
          setPricingOpen(true)
        }}
        onSignOut={onSignOut}
      />

      <Modal visible={pricingOpen} animationType="slide" onRequestClose={() => setPricingOpen(false)}>
        <PricingScreen
          theme={theme}
          mode="manage"
          currentPlan={user?.plan}
          onChoose={async (p: PlanId) => {
            await setPlan(p)
            setPricingOpen(false)
          }}
          onClose={() => setPricingOpen(false)}
        />
      </Modal>
    </SafeAreaView>
  )
}

function EmptyState({ theme, name }: { theme: Theme; name?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyMark, { color: theme.coral }]}>✶</Text>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {name ? `Hi ${name.split(' ')[0]} — how can I help?` : 'How can I help?'}
      </Text>
      <Text style={[styles.emptyBody, { color: theme.muted }]}>
        Every turn is routed to the cheapest model capable of the task. Attach an image, turn on
        tools, and tap the pill above any reply to see the routing decision.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0 },
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  splashMark: { fontSize: 40 },
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
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20, fontWeight: '500', lineHeight: 22 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  listContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyMark: { fontSize: 34, marginBottom: 2 },
  emptyTitle: { fontSize: 25, fontFamily: SERIF, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
