import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Theme } from '../theme'
import { radius } from '../theme'
import type { Attachment } from '../types'
import { MAX_ATTACHMENTS, pickImages } from '../imagePicker'

/**
 * Bottom input bar: image attachments, a growing text field, a tools (agentic)
 * toggle, and the coral send button. Send is enabled when there's text OR at
 * least one image, and disabled while a turn is streaming.
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
  onSend: (text: string, attachments: Attachment[]) => void
  onStop: () => void
}) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !busy

  const addImages = async () => {
    if (busy) return
    const remaining = MAX_ATTACHMENTS - attachments.length
    if (remaining <= 0) return
    const picked = await pickImages(remaining)
    if (picked.length) setAttachments((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS))
  }

  const removeImage = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  const submit = () => {
    const t = text.trim()
    if ((!t && attachments.length === 0) || busy) return
    setText('')
    setAttachments([])
    onSend(t, attachments)
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      {attachments.length > 0 ? (
        <View style={styles.thumbs}>
          {attachments.map((a) => (
            <View key={a.id} style={styles.thumbWrap}>
              <Image source={{ uri: a.dataUrl }} style={[styles.thumb, { borderColor: theme.line }]} />
              <Pressable
                onPress={() => removeImage(a.id)}
                hitSlop={8}
                style={[styles.thumbRemove, { backgroundColor: theme.text }]}
              >
                <Text style={[styles.thumbRemoveText, { color: theme.bg }]}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

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
        <Pressable
          onPress={addImages}
          disabled={busy || attachments.length >= MAX_ATTACHMENTS}
          hitSlop={8}
          style={({ pressed }) => [styles.attach, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text
            style={[
              styles.attachIcon,
              { color: attachments.length >= MAX_ATTACHMENTS ? theme.faint : theme.muted },
            ]}
          >
            ＋
          </Text>
        </Pressable>
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
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: 58, height: 58 },
  thumb: { width: 58, height: 58, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { fontSize: 14, fontWeight: '800', lineHeight: 16 },
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
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
  },
  attach: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  attachIcon: { fontSize: 22, fontWeight: '500', lineHeight: 24 },
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
