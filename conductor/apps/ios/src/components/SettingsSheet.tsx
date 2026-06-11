import { useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Theme } from '../theme'
import { MONO, radius } from '../theme'
import { DEFAULT_BASE_URL, normalizeBaseUrl, type Settings } from '../config'
import type { User } from '../auth'

/** Account + backend URL + tool mode, with new-chat and sign-out actions. */
export function SettingsSheet({
  visible,
  theme,
  settings,
  user,
  planName,
  onClose,
  onSave,
  onNewChat,
  onManagePlan,
  onSignOut,
}: {
  visible: boolean
  theme: Theme
  settings: Settings
  user: User | null
  planName: string
  onClose: () => void
  onSave: (s: Settings) => void
  onNewChat: () => void
  onManagePlan: () => void
  onSignOut: () => void
}) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [agentic, setAgentic] = useState(settings.agentic)

  useEffect(() => {
    if (visible) {
      setBaseUrl(settings.baseUrl)
      setAgentic(settings.agentic)
    }
  }, [visible, settings])

  const commit = () => {
    const url = normalizeBaseUrl(baseUrl) || DEFAULT_BASE_URL
    onSave({ baseUrl: url, agentic })
    onClose()
  }

  const confirmNewChat = () =>
    Alert.alert('Start a new chat?', 'This clears the current conversation from memory.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New chat', style: 'destructive', onPress: onNewChat },
    ])

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your conversations stay saved on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

            {/* Account */}
            {user ? (
              <View style={[styles.account, { backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}>
                <View style={[styles.accountAvatar, { backgroundColor: theme.coral }]}>
                  <Text style={[styles.accountInitial, { color: theme.onCoral }]}>
                    {(user.name || user.email).trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountText}>
                  {user.name ? <Text style={[styles.accountName, { color: theme.text }]}>{user.name}</Text> : null}
                  <Text style={[styles.accountEmail, { color: theme.muted }]} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
                <View style={[styles.planPill, { backgroundColor: theme.coralTint }]}>
                  <Text style={[styles.planPillText, { color: theme.coralPress }]}>{planName}</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={onManagePlan}
              style={({ pressed }) => [styles.row, { borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.rowText, { color: theme.text }]}>Manage plan</Text>
              <Text style={[styles.rowChevron, { color: theme.faint }]}>›</Text>
            </Pressable>

            {/* Backend */}
            <Text style={[styles.label, { color: theme.muted }]}>Backend URL</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={DEFAULT_BASE_URL}
              placeholderTextColor={theme.faint}
            />
            <Text style={[styles.hint, { color: theme.faint }]}>
              The deployed Conductor server, or your local{' '}
              <Text style={{ fontFamily: MONO }}>next dev</Text> (e.g.{' '}
              <Text style={{ fontFamily: MONO }}>http://192.168.x.x:3000</Text>).
            </Text>
            <Pressable onPress={() => setBaseUrl(DEFAULT_BASE_URL)}>
              <Text style={[styles.reset, { color: theme.coral }]}>Reset to default</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderTopColor: theme.line }]}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Agentic tools by default</Text>
                <Text style={[styles.toggleSub, { color: theme.muted }]}>
                  Let the model run sandbox, web search & data tools.
                </Text>
              </View>
              <Switch
                value={agentic}
                onValueChange={setAgentic}
                trackColor={{ true: theme.coral, false: theme.lineStrong }}
                thumbColor={theme.surface}
              />
            </View>

            <Pressable
              onPress={confirmNewChat}
              style={({ pressed }) => [styles.outline, { borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.outlineText, { color: theme.text }]}>New chat</Text>
            </Pressable>

            <Pressable
              onPress={confirmSignOut}
              style={({ pressed }) => [styles.outline, { borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.outlineText, { color: theme.coralPress }]}>Sign out</Text>
            </Pressable>

            <Pressable
              onPress={commit}
              style={({ pressed }) => [styles.save, { backgroundColor: theme.coral, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.saveText, { color: theme.onCoral }]}>Save</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,19,0.32)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: '88%',
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 12,
  },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accountInitial: { fontSize: 18, fontWeight: '700' },
  accountText: { flex: 1 },
  accountName: { fontSize: 15.5, fontWeight: '700' },
  accountEmail: { fontSize: 13, marginTop: 1 },
  planPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  planPillText: { fontSize: 12.5, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  rowText: { fontSize: 15.5, fontWeight: '600' },
  rowChevron: { fontSize: 22, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: MONO,
  },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 7 },
  reset: { fontSize: 13, fontWeight: '600', marginTop: 9 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flexShrink: 1 },
  toggleLabel: { fontSize: 15.5, fontWeight: '600' },
  toggleSub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  outline: {
    marginTop: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineText: { fontSize: 14.5, fontWeight: '600' },
  save: { marginTop: 18, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '700' },
})
