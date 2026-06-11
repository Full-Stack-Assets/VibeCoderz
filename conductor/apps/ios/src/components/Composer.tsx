import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Theme } from '../theme'
import { radius } from '../theme'

/**
 * Bottom input bar: a growing text field, a tools (agentic) toggle, and the
 * coral send button. Send is disabled while a turn is streaming.
 */
export function Composer({
  theme,
  busy,
  agentic,
  onToggleAgentic,
  onSend,
  onStop,
}: {
  theme: Theme
  busy: boolean
  agentic: boolean
  onToggleAgentic: () => void
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0 && !busy

  const submit = () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    onSend(t)
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      <View style={styles.controls}>
        <Pressable
          onPress={onToggleAgentic}
          style={({ pressed }) => [
            styles.toolToggle,
            {
              backgroundColor: agentic ? theme.coralTint : theme.surfaceSunk,
              borderColor: agentic ? theme.coral : theme.line,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.toolText, { color: agentic ? theme.coral : theme.muted }]}>
            {agentic ? '⚒ Tools on' : '⚒ Tools off'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.inputRow, { backgroundColor: theme.surfaceSunk, borderColor: theme.line }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Message Conductor…"
          placeholderTextColor={theme.faint}
          value={text}
          onChangeText={setText}
          multiline
          editable
          onSubmitEditing={submit}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        {busy ? (
          <Pressable
            onPress={onStop}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.stopSquare, { backgroundColor: theme.muted }]} />
          </Pressable>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: canSend ? theme.coral : theme.surfaceSunk, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.sendArrow, { color: canSend ? theme.onCoral : theme.faint }]}>↑</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  controls: { flexDirection: 'row', alignItems: 'center' },
  toolToggle: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  toolText: { fontSize: 12.5, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16.5, lineHeight: 22, maxHeight: 140, paddingTop: 6, paddingBottom: 6 },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendArrow: { fontSize: 19, fontWeight: '800', lineHeight: 22 },
  stopSquare: { width: 12, height: 12, borderRadius: 3 },
})
