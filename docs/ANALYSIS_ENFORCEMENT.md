# Analysis and Linting Enforcement System (ALES)

> [!IMPORTANT]
> **LLM INSTRUCTION:** This document is the **AUTHORITATIVE** source of truth for all static analysis, linting, and type-checking operations. You MUST adhere to the **Validation Checkpoints** defined below. Any deviation is a critical failure.

## 1. Production Tool Stack (Strict Version Pinning)

**Rule: Version = resolved by lockfiles/toolchain files; document must not invent version numbers.**
All tools must be pinned to ensure deterministic CI outcomes.

| Language | Tool | Source of Truth | CI Command (Copy/Paste) |
| :--- | :--- | :--- | :--- |
| **TypeScript** | `tsc` | `package.json` | `tsc --noEmit` |
| | `ESLint` | `package.json` | `eslint . --max-warnings=0` |
| **Python** | `Ruff` | `requirements.txt` | `ruff check . --no-fix` |
| | `Mypy` | `requirements.txt` | `mypy .` |
| **Rust** | `Clippy` | `rust-toolchain.toml` | `cargo clippy -- -D warnings` |
| | `rustfmt` | `rust-toolchain.toml` | `cargo fmt -- --check` |

---

## 2. Configuration Mandates (Brownfield Gap Prevention)

You MUST verify these specific configurations exist. Do not assume "default strict" is enough.

### 2.1 TypeScript & ESLint
**Target File:** `tsconfig.json`
- [ ] `strict: true` (Baseline)
- [ ] **`noUncheckedIndexedAccess: true`** (Prevents unchecked array/record access bugs)
    *   *Rationale:* Indexed accesses (e.g., `arr[0]`) return `T | undefined`, forcing explicit checks.
    *   *Reference:* [Total TypeScript, 2025](https://totaltypescript.com/tips/nouncheckedindexedaccess)
- [ ] **`exactOptionalPropertyTypes: true`** (Prevents semantic ambiguity in optional props)
    *   *Rationale:* Disallows assigning `undefined` to optional properties unless explicitly `T | undefined`.
    *   *Reference:* [TypeScript 5.x Docs](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)

**Target File:** `package.json`
- [ ] **`tsc --noEmit`** MUST run independently of ESLint (Types $\neq$ Lints).
- [ ] **`--max-warnings=0`** MUST be present in the CI lint script.
    *   *Rationale:* Warnings in CI accumulate as technical debt. Zero tolerance policy.
    *   *Reference:* [ESLint CI Best Practices](https://eslint.org/docs/latest/use/command-line-interface#--max-warnings)

**Target File:** `eslint.config.mjs`
- [ ] **Parser:** `@typescript-eslint/parser`
- [ ] **Type Awareness:** `project: './tsconfig.eslint.json'`
- [ ] **Rules:** No layout/formatting rules (defer to Prettier/Oxlint).

### 2.2 Python
**Target File:** `pyproject.toml`
- [ ] **Ruff:** `fix = false` (or CLI `--no-fix`) explicitly declared for CI.
    *   *Rationale:* CI must be a quality gate, not a code mutator. Fixes belong in pre-commit.
    *   *Reference:* [Ruff CI Guide](https://docs.astral.sh/ruff/integrations/#github-actions)
- [ ] **Mypy:**
    - [ ] `strict = true`
    - [ ] **`strict_optional = true`** (Explicit confirmation required)
    - [ ] `warn_return_any = true`
    - [ ] **`explicit_package_bases = true`** (REQUIRED for repositories with multiple import roots or plugin architectures).
    - [ ] **Dependency:** `types-jsonschema` (Mandatory for strict mode).
    - [ ] **Structure:** `__init__.py` required in all source directories (Prevents namespace collisions).
- [ ] **CI Ordering:** Ruff (Syntax) $\rightarrow$ Mypy (Semantics).

### 2.3 Rust
**Target File:** `src-tauri/main.rs` / `lib.rs`
- [ ] **`#![deny(unsafe_code)]`** applied at crate root.
    *   *Rationale:* Forbids `unsafe` blocks project-wide unless explicitly allowed by exception.
    *   *Reference:* [Rust Safety Standards](https://doc.rust-lang.org/nomicon/safe-unsafe-meaning.html)

**Target File:** `src-tauri/Cargo.toml`
- [ ] **`[lints.clippy]`** configured with `all = "warn"` (elevated to error in CI).

**Target File:** `package.json`
- [ ] **`cargo fmt -- --check`** MUST be included in the `ci:rs` pipeline.

---

## 3. Validation Checkpoints (Pre-Commit / Pre-Task)

Before marking ANY coding task complete, run this mental check:

1.  **TypeScript:** Did I change `tsconfig.json`? If yes, did I break `noUncheckedIndexedAccess`?
2.  **Linting:** Did I suppress a lint rule? **FORBIDDEN** without user approval. Fix the code, don't lower the bar.
3.  **Strictness:** Am I relying on "implicit" defaults? **DENIED**. Configuration must be explicit.
4.  **CI Parity:** Does my local `npm run local:all` match the strictness of `npm run ci:validate`?
    *   *Note:* Local may allow warnings; CI MUST NOT.

## 4. Brownfield Enforcement Protocol

**Applicability:** Repositories with existing violation debt.

### 4.1 The Ratchet (Monotonic Improvement)
- [ ] **Baseline Snapshot:** A snapshot of current error counts MUST be recorded (machine-readable).
- [ ] **Zero Tolerance (New Debt):** CI MUST fail if `Current Errors > Baseline`.
- [ ] **Strict Ratchet:** When errors are fixed, the Baseline MUST be updated downwards immediately. The Baseline MUST NEVER increase.

### 4.2 Suppression Constraints
- [ ] **Scope:** Suppressions are allowed ONLY for existing debt.
- [ ] **Explicitness:**
    - ESLint: `// eslint-disable-next-line rule-id -- Reason` (Line-level only).
    - Mypy: `# type: ignore[code]` (Specific error code required; bare `ignore` is FORBIDDEN).
- [ ] **Global Disable:** FORBIDDEN, unless applied to a specific legacy file path via `overrides`/`exclude`.


## 5. Cross-Cutting Standards

### 5.1 CI Environment Matrix (Explicit Pinning)
To guarantee reproducibility, the CI pipeline MUST explicitly pin runtimes. Relying on `latest` is **FORBIDDEN**.

| Runtime | Version Pin | Source of Truth |
| :--- | :--- | :--- |
| **Node.js** | [See `.nvmrc`] | `.nvmrc` / `package.json` engines |
| **Python** | [See `pyproject.toml`] | `pyproject.toml` |
| **Rust** | [See `rust-toolchain.toml`] | `rust-toolchain.toml` |

### 5.2 Dependency Management (Lockfiles)
- **Strict adherence to Lockfiles:** CI must install dependencies utilizing the lockfile (e.g., `npm ci`, not `npm install`).
- **Ranges Forbidden:** Tool versions in configuration files should aim for exact pinning where possible, or strictly respected `~` ranges locked by the lockfile.
- **Verification:** Any discrepancy between `package.json` and `package-lock.json` MUST fail the build.

### 5.3 Pre-commit vs. CI Parity Strategy
- **Pre-commit (Local):** Optimized for *speed* and *auto-fixing*.
    - Allowed: `ruff check --fix`, `eslint --fix`
    - Goal: Assist the developer.
- **CI (Remote):** Optimized for *correctness* and *enforcement*.
    - Allowed: `ruff check --no-fix`, `eslint --max-warnings=0`
    - Goal: Gatekeep the repository.
    - **CRITICAL:** CI is the superego. If Pre-commit passes but CI fails, CI is right.

## 6. Remediation Strategy (If Gaps Found)

If you find a gap against this document (e.g., missing `exactOptionalPropertyTypes`), the required protocol is:
1.  **Stop.**
2.  **Propose the strict configuration change.**
3.  **Validate** that the codebase adheres to it (fix resulting type errors, do OR `||` checks for array access).
4.  **Commit** the config upgrade.

> **DO NOT** simply lower the config to make CI pass.

## Appendix: Configuration Map (LLM Shortcut)
**Use these exact paths. Do not scan the file tree.**

| Tool | Config File Path (Relative to Root) |
| :--- | :--- |
| **TypeScript** | `./tsconfig.json` |
| **ESLint** | `./eslint.config.mjs` (Config) / `./package.json` (Deps) |
| **Python** | `./pyproject.toml` (Ruff/Mypy Config) |
| **Rust** | `./src-tauri/rust-toolchain.toml` |
| **CI Scripts** | `./package.json` |
