/**
 * Passwordless sign-in / sign-up flow: Welcome → Email → Magic code.
 *
 * On a successful verify we call `onAuthenticated(isNewUser)`; the parent gates
 * new users into plan selection (PricingScreen) before the chat. Because there
 * is no mail server in this demo, the code is surfaced in-app behind a clearly
 * labelled "Demo mode" card — a real `AuthProvider` would email it and omit it.
 */
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Theme } from '../theme'
import { SERIF, radius } from '../theme'
import { isValidEmail, type MagicChallenge } from '../auth'
import { useAuth } from '../context/AuthContext'

type Stage = 'welcome' | 'email' | 'code'
type Mode = 'signin' | 'signup'

export function AuthFlow({
  theme,
  onAuthenticated,
}: {
  theme: Theme
  onAuthenticated: (isNewUser: boolean) => void
}) {
  const { requestMagicLink, verifyMagicCode } = useAuth()

  const [stage, setStage] = useState<Stage>('welcome')
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<MagicChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goEmail = (m: Mode) => {
    setMode(m)
    setError(null)
    setStage('email')
  }

  const sendLink = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Enter your name to create an account.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const ch = await requestMagicLink(email, mode === 'signup' ? name : undefined)
      setChallenge(ch)
      setCode('')
      setStage('code')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!challenge) return
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await verifyMagicCode(challenge.challengeId, code)
      onAuthenticated(challenge.isNewUser)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    setError(null)
    try {
      const ch = await requestMagicLink(email, mode === 'signup' ? name : undefined)
      setChallenge(ch)
      setCode('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Text style={[styles.mark, { color: theme.coral }]}>✶</Text>
            <Text style={[styles.wordmark, { color: theme.text }]}>Conductor</Text>
            <Text style={[styles.tagline, { color: theme.muted }]}>
              The constraint-optimized assistant
            </Text>
          </View>

          {stage === 'welcome' && (
            <Welcome theme={theme} onSignUp={() => goEmail('signup')} onSignIn={() => goEmail('signin')} />
          )}

          {stage === 'email' && (
            <EmailStep
              theme={theme}
              mode={mode}
              email={email}
              name={name}
              busy={busy}
              error={error}
              onEmail={setEmail}
              onName={setName}
              onSubmit={sendLink}
              onSwitchMode={() => goEmail(mode === 'signup' ? 'signin' : 'signup')}
              onBack={() => {
                setStage('welcome')
                setError(null)
              }}
            />
          )}

          {stage === 'code' && challenge && (
            <CodeStep
              theme={theme}
              email={email}
              code={code}
              busy={busy}
              error={error}
              devCode={challenge.devCode}
              onCode={setCode}
              onVerify={verify}
              onResend={resend}
              onUseDemoCode={() => challenge.devCode && setCode(challenge.devCode)}
              onBack={() => {
                setStage('email')
                setError(null)
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Welcome({
  theme,
  onSignUp,
  onSignIn,
}: {
  theme: Theme
  onSignUp: () => void
  onSignIn: () => void
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.lede, { color: theme.textSoft }]}>
        Every message is routed to the cheapest model that can do the job — so you get strong
        answers without overpaying.
      </Text>
      <Pressable
        onPress={onSignUp}
        style={({ pressed }) => [styles.primary, { backgroundColor: theme.coral, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.primaryText, { color: theme.onCoral }]}>Create account</Text>
      </Pressable>
      <Pressable
        onPress={onSignIn}
        style={({ pressed }) => [
          styles.secondary,
          { borderColor: theme.lineStrong, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.secondaryText, { color: theme.text }]}>I already have an account</Text>
      </Pressable>
      <Text style={[styles.fine, { color: theme.faint }]}>
        No password needed — we’ll email you a magic sign-in code.
      </Text>
    </View>
  )
}

function EmailStep({
  theme,
  mode,
  email,
  name,
  busy,
  error,
  onEmail,
  onName,
  onSubmit,
  onSwitchMode,
  onBack,
}: {
  theme: Theme
  mode: Mode
  email: string
  name: string
  busy: boolean
  error: string | null
  onEmail: (v: string) => void
  onName: (v: string) => void
  onSubmit: () => void
  onSwitchMode: () => void
  onBack: () => void
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.heading, { color: theme.text }]}>
        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
      </Text>

      {mode === 'signup' && (
        <>
          <Text style={[styles.label, { color: theme.muted }]}>Name</Text>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}
            value={name}
            onChangeText={onName}
            placeholder="Ada Lovelace"
            placeholderTextColor={theme.faint}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </>
      )}

      <Text style={[styles.label, { color: theme.muted }]}>Email</Text>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}
        value={email}
        onChangeText={onEmail}
        placeholder="you@example.com"
        placeholderTextColor={theme.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      {error ? <Text style={[styles.error, { color: theme.coralPress }]}>{error}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: theme.coral, opacity: busy || pressed ? 0.8 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.onCoral} />
        ) : (
          <Text style={[styles.primaryText, { color: theme.onCoral }]}>Send magic code</Text>
        )}
      </Pressable>

      <Pressable onPress={onSwitchMode} hitSlop={8}>
        <Text style={[styles.switch, { color: theme.coral }]}>
          {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
        </Text>
      </Pressable>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={[styles.back, { color: theme.faint }]}>← Back</Text>
      </Pressable>
    </View>
  )
}

function CodeStep({
  theme,
  email,
  code,
  busy,
  error,
  devCode,
  onCode,
  onVerify,
  onResend,
  onUseDemoCode,
  onBack,
}: {
  theme: Theme
  email: string
  code: string
  busy: boolean
  error: string | null
  devCode?: string
  onCode: (v: string) => void
  onVerify: () => void
  onResend: () => void
  onUseDemoCode: () => void
  onBack: () => void
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.heading, { color: theme.text }]}>Check your email</Text>
      <Text style={[styles.sub, { color: theme.muted }]}>
        We sent a 6-digit code to{' '}
        <Text style={{ color: theme.text, fontWeight: '600' }}>{email}</Text>.
      </Text>

      {devCode ? (
        <Pressable
          onPress={onUseDemoCode}
          style={[styles.demo, { backgroundColor: theme.coralTint, borderColor: theme.coral }]}
        >
          <Text style={[styles.demoLabel, { color: theme.coralPress }]}>DEMO MODE</Text>
          <Text style={[styles.demoCode, { color: theme.text }]}>{devCode}</Text>
          <Text style={[styles.demoHint, { color: theme.muted }]}>
            No mail server here — tap to autofill. A real deployment emails this.
          </Text>
        </Pressable>
      ) : null}

      <TextInput
        style={[styles.codeInput, { color: theme.text, backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}
        value={code}
        onChangeText={(v) => onCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
        placeholder="••••••"
        placeholderTextColor={theme.faint}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={onVerify}
      />

      {error ? <Text style={[styles.error, { color: theme.coralPress }]}>{error}</Text> : null}

      <Pressable
        onPress={onVerify}
        disabled={busy}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: theme.coral, opacity: busy || pressed ? 0.8 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.onCoral} />
        ) : (
          <Text style={[styles.primaryText, { color: theme.onCoral }]}>Verify & continue</Text>
        )}
      </Pressable>

      <Pressable onPress={onResend} hitSlop={8} disabled={busy}>
        <Text style={[styles.switch, { color: theme.coral }]}>Resend code</Text>
      </Pressable>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={[styles.back, { color: theme.faint }]}>← Use a different email</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 28 },
  mark: { fontSize: 30, marginBottom: 6 },
  wordmark: { fontSize: 34, fontFamily: SERIF, fontWeight: '600', letterSpacing: 0.3 },
  tagline: { fontSize: 14, marginTop: 4 },
  block: { gap: 12 },
  lede: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 10 },
  heading: { fontSize: 24, fontFamily: SERIF, fontWeight: '600', marginBottom: 4 },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  codeInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 4,
  },
  primary: { borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  primaryText: { fontSize: 16.5, fontWeight: '700' },
  secondary: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryText: { fontSize: 15.5, fontWeight: '600' },
  fine: { fontSize: 12.5, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  switch: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 14 },
  back: { fontSize: 13.5, textAlign: 'center', marginTop: 10 },
  error: { fontSize: 13.5, marginTop: 4 },
  demo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
  },
  demoLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  demoCode: { fontSize: 28, fontWeight: '800', letterSpacing: 8 },
  demoHint: { fontSize: 11.5, textAlign: 'center', lineHeight: 16 },
})
