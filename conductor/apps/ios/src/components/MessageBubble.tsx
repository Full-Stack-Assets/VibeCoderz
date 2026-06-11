import { StyleSheet, Text, View } from 'react-native'
import type { Msg } from '../types'
import type { Theme } from '../theme'
import { radius } from '../theme'
import { DecisionPill } from './DecisionPill'
import { ToolStepView } from './ToolStepView'
import { TypingDots } from './TypingDots'

/**
 * One chat row. User turns are right-aligned clay bubbles; assistant turns are
 * left-aligned flowing text, prefaced by the routing pill and any tool steps —
 * matching the Claude-iOS web shell.
 */
export function MessageBubble({ msg, theme }: { msg: Msg; theme: Theme }) {
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: theme.userBubble }]}>
          <Text style={[styles.userText, { color: theme.text }]}>{msg.content}</Text>
        </View>
      </View>
    )
  }

  const waiting = msg.pending && !msg.content && (!msg.steps || msg.steps.length === 0)

  return (
    <View style={styles.assistantRow}>
      {msg.decision ? (
        <DecisionPill decision={msg.decision} simulated={msg.simulated} theme={theme} />
      ) : null}

      {msg.steps?.map((s, i) => (
        <ToolStepView key={i} step={s} theme={theme} />
      ))}

      {waiting ? (
        <TypingDots theme={theme} />
      ) : msg.content ? (
        <Text
          style={[
            styles.assistantText,
            { color: msg.error ? theme.coralPress : theme.text },
            msg.steps && msg.steps.length ? { marginTop: 10 } : null,
          ]}
        >
          {msg.content}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', marginVertical: 7 },
  userBubble: {
    maxWidth: '86%',
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  userText: { fontSize: 16, lineHeight: 23 },
  assistantRow: { alignItems: 'flex-start', marginVertical: 9, width: '100%' },
  assistantText: { fontSize: 16.5, lineHeight: 25 },
})
