import { register } from 'node:module'

// Registered via `node --import ./test/register.mjs` so the resolver hook is
// active before any test module loads.
register('./resolver.mjs', import.meta.url)
