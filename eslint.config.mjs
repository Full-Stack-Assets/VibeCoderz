import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Next 16 ships eslint-config-next as native flat config, so we import the
// shareable configs directly rather than going through the removed `next lint`
// command or the @eslint/eslintrc FlatCompat shim.
const eslintConfig = [
  {
    // Conductor is a self-contained workspace with its own toolchain; build
    // output and generated files are never linted from the root project.
    ignores: ["conductor/**", ".next/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // eslint-plugin-react-hooks v6 (bundled by eslint-config-next 16) enables
    // the React Compiler-era rules at error severity. They flag patterns this
    // codebase uses intentionally — the canonical hydration mount-detection
    // effect, `window.location` navigation, reading a ref for display state —
    // none of which are bugs. Keep them visible as warnings rather than blocking
    // CI; promote to errors if/when we adopt the React Compiler.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
