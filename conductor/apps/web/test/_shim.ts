/** Minimal localStorage + window shim so client lib modules run under node. */
export function installBrowserStorage() {
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v))
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
  ;(globalThis as unknown as { window: { localStorage: unknown } }).window = { localStorage: storage }
  return storage
}
