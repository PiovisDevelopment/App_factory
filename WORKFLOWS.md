# Developer Workflows & Safety Policy

## Local Developer Workflow (Speed & Early Signal)

**Purpose**: Fast feedback, checking for obvious mistakes without blocking on deep analysis.

### JavaScript / TypeScript
*   **Fast syntax & basic logic**: `npm run local:js`
    *   Command: `oxlint .`
    *   *Note: Oxlint is advisory only.*
*   **Type Checking**: `npm run local:ts`
    *   Command: `tsc --noEmit`
    *   *Run when touching types or public APIs.*

### Python
*   **Linting**: `npm run local:py`
    *   Command: `ruff check .`

### Rust
*   **Linting**: `npm run local:rs`
    *   Command: `cargo clippy`

---

## CI Workflow (Authoritative Correctness Gate)

**Purpose**: Prevent regressions, enforce semantic correctness, and block unsafe refactors.

### Step 1: TypeScript Compiler (Hard Gate)
*   **Command**: `npm run ci:js:types`
*   **Why**: Verified as the most trusted first signal for failures.

### Step 2: ESLint (Typed, Full Accuracy)
*   **Command**: `npm run ci:js:lint`
*   **Flags**: `--max-warnings=0`
*   **Requirements**:
    *   `@typescript-eslint/parser` enabled
    *   `parserOptions.project` enabled
    *   React + hooks rules active
*   **Policy**: Non-negotiable for React/Zustand/MUI refactors.

### Step 3: Python Correctness
*   **Command**: `npm run ci:py`
*   **Composition**: `ruff check .` AND `mypy .`
*   **Why**: Ruff catches syntax/style; Mypy is the semantic gate.

### Step 4: Rust (Tauri)
*   **Command**: `npm run ci:rs`
*   **Flags**: `-D warnings` (Fail on warnings)

---

## ⛔ Explicit Prohibitions (Do NOT Do This)

1.  ❌ **Do not run typed ESLint on every save.** (Too slow, disrupts flow)
2.  ❌ **Do not allow Oxlint to pass CI without ESLint.** (Oxlint is not authoritative)
3.  ❌ **Do not merge if tsc fails**, even if ESLint passes.
4.  ❌ **Do not mix formatting fixes with refactor commits.**
