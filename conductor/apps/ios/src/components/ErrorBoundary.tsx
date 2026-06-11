/**
 * Top-level crash guard. A render error anywhere below is caught here and shown
 * as a recoverable screen instead of a white/blank death — and because the
 * conversation is persisted to memory, "Try again" remounts the tree and the
 * chat reloads intact.
 */
import { Component, type ReactNode } from 'react'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // A real build would forward this to crash reporting (Sentry, etc.).
    // eslint-disable-next-line no-console
    console.warn('Conductor caught a render error:', error?.message)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.box}>
          <Text style={styles.mark}>⚠</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Your conversation is saved — tap below to reload it.
          </Text>
          <Text style={styles.detail} numberOfLines={3}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf9f5', alignItems: 'center', justifyContent: 'center' },
  box: { paddingHorizontal: 36, alignItems: 'center', gap: 10 },
  mark: { fontSize: 38, color: '#d97757' },
  title: { fontSize: 22, fontWeight: '700', color: '#141413', fontFamily: 'Georgia' },
  body: { fontSize: 15, lineHeight: 22, color: '#73726c', textAlign: 'center' },
  detail: { fontSize: 12, color: '#b0aea5', textAlign: 'center', marginTop: 2 },
  button: {
    marginTop: 12,
    backgroundColor: '#d97757',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
