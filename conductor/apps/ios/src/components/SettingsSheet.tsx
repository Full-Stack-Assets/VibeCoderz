import { useEffect, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import type { Theme } from '../theme'
import { MONO, radius } from '../theme'
import { DEFAULT_BASE_URL, normalizeBaseUrl, type Settings } from '../config'

/** Editable backend URL + default tool mode, plus a clear-conversation action. */
export function SettingsSheet({
  visible,
  theme,
  settings,
  onClose,
  onSave,
  onClear,
}: {
  visible: boolean
  theme: Theme
  settings: Settings
  onClose: () => void
  onSave: (s: Settings) => void
  onClear: () => void
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

          <Text style={[styles.label, { color: theme.muted }]}>Backend URL</Text>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surfaceSunk, borderColor: theme.line },
            ]}
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
            onPress={onClear}
            style={({ pressed }) => [styles.clear, { borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.clearText, { color: theme.coralPress }]}>Clear conversation</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('https://code.claude.com/docs/en/claude-code-on-the-web')}
          >
            <Text style={[styles.docLink, { color: theme.faint }]}>About Conductor</Text>
          </Pressable>

          <Pressable
            onPress={commit}
            style={({ pressed }) => [styles.save, { backgroundColor: theme.coral, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.saveText, { color: theme.onCoral }]}>Save</Text>
          </Pressable>
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
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
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
  clear: {
    marginTop: 20,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearText: { fontSize: 14.5, fontWeight: '600' },
  docLink: { fontSize: 13, textAlign: 'center', marginTop: 16 },
  save: { marginTop: 16, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '700' },
})
