# Bulletproof Remediation Strategy
> **Generated:** 2026-01-08T18:56:54Z  
> **Last Updated:** 2026-01-08T21:30:00Z  
> **Scope:** Static Analysis + Dependency + Security Audit  
> **Methodology:** Pattern-based, Risk-tiered, Atomic Phases  
> **Current Status:** Phase 4 IN PROGRESS (24% complete)

---

## Executive Summary

| Dimension | Initial | Current | Status |
|-----------|---------|---------|--------|
| TypeScript Static Analysis | 117 errors | 0 errors | ✅ Phase 3 DONE |
| ESLint | 791 problems | 791 problems | ⏳ PENDING |
| Python Ruff | ~1500+ errors | ~340 errors | ✅ Phase 1 DONE |
| Python Mypy | 289 errors | 206 errors | 🔄 Phase 4 IN PROGRESS (24%) |
| Rust Clippy | ~150+ errors | ~100 errors | ✅ Phase 2 DONE |
| NPM Outdated | 16 packages | 16 packages | ⏳ PENDING |
| NPM Security | 2 moderate | 2 moderate | ⏳ PENDING |
| Build Status | — | ✅ PASSING | — |

---

## Part A: Dependency Audit Findings

### A.1 NPM Security Vulnerabilities (PRIORITY: MEDIUM)

| Package | Severity | CVE/Advisory | Fix Available |
|---------|----------|--------------|---------------|
| `esbuild` ≤0.24.2 | Moderate | GHSA-67mh-4wv8-2f99 | Upgrade `vite` to 7.3.1 |
| `vite` 0.11.0–6.1.6 | Moderate | (transitive via esbuild) | Upgrade to 7.3.1 |

**Root Cause:** `vite@5.4.21` depends on vulnerable `esbuild` version.  
**Impact:** Development server can leak information to malicious websites.  
**Fix:** Requires major version upgrade of Vite (5.x → 7.x). This is a **BREAKING CHANGE**.

### A.2 NPM Outdated Packages (16 packages)

| Priority | Package | Current | Latest | Breaking? | Action |
|----------|---------|---------|--------|-----------|--------|
| 🔴 HIGH | `vite` | 5.4.21 | 7.3.1 | YES | Defer to dedicated upgrade phase |
| 🔴 HIGH | `@tauri-apps/api` | 1.6.0 | 2.9.1 | YES | Requires Tauri v2 migration |
| 🔴 HIGH | `@tauri-apps/cli` | 1.6.3 | 2.9.6 | YES | Requires Tauri v2 migration |
| 🔴 HIGH | `react` | 18.3.1 | 19.2.3 | YES | Major version, defer |
| 🔴 HIGH | `react-dom` | 18.3.1 | 19.2.3 | YES | Major version, defer |
| 🔴 HIGH | `@types/react` | 18.3.27 | 19.2.7 | YES | Coupled to React upgrade |
| 🔴 HIGH | `@types/react-dom` | 18.3.7 | 19.2.3 | YES | Coupled to React upgrade |
| 🔴 HIGH | `zustand` | 4.5.7 | 5.0.9 | YES | Major version API changes |
| 🔴 HIGH | `tailwindcss` | 3.4.19 | 4.1.18 | YES | Major version, defer |
| 🔴 HIGH | `@vitejs/plugin-react` | 4.7.0 | 5.1.2 | YES | Coupled to Vite upgrade |
| 🟡 MEDIUM | `oxlint` | 1.0.0 | 1.38.0 | Unlikely | Safe to update |
| 🟡 MEDIUM | `eslint` | 9.6.0 | 9.39.2 | Unlikely | Safe to update |
| 🟡 MEDIUM | `reactflow` | 11.10.1 | 11.11.4 | No | Safe to update |
| 🟡 MEDIUM | `typescript-eslint/*` | 8.51.0 | 8.52.0 | No | Safe to update |
| 🟢 LOW | `@mui/material` | 7.3.6 | 7.3.7 | No | Patch update |

### A.3 Pip Outdated Analysis

**⚠️ WARNING:** The pip outdated report contains ~260 packages which is the **global Python environment**, not just project dependencies.

**Project-Relevant Packages (from `requirements.txt`):**

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| `PyYAML` | 6.0.2 | 6.0.3 | Safe patch update |
| `jsonschema` | 4.23.0 | 4.26.0 | Safe minor update |
| `ruff` | 0.9.4 | 0.14.10 | **PINNED at 0.14.9** in requirements.txt |
| `mypy` | (system) | (system) | Already constrained >=1.9,<2.0 |
| `pydantic-ai` | 0.0.18 | 1.40.0 | **MAJOR BREAKING** |
| `pydantic-graph` | 1.39.0 | 1.40.0 | Safe minor update |
| `python-dotenv` | 1.1.1 | 1.2.1 | Safe minor update |
| `httpx` | 0.27.2 | 0.28.1 | Safe minor update |

### A.4 Rust Audit Tools

**Status:** `cargo-outdated` and `cargo-audit` are **not installed**.

**Recommendation:** Install these tools in a future phase:
```powershell
cargo install cargo-outdated cargo-audit
```

---

## Part B: Static Analysis Remediation Strategy

### B.1 Risk Hierarchy Principles

| Principle | Description |
|-----------|-------------|
| **Zero Risk First** | Auto-fixable issues with `--fix` flags (local only, never CI) |
| **Atomic Commits** | Each pattern = one commit for easy rollback |
| **Validation Gates** | CI must pass between each phase |
| **No Cross-Contamination** | FE fixes never touch BE; BE fixes never touch FE |
| **Configuration Before Code** | Fix config gaps before code errors |

### B.2 Remediation Phases

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: ALES Configuration Compliance ✅ COMPLETE                  │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Auto-Fixable Python (Ruff --fix) ✅ COMPLETE               │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Auto-Fixable Rust (clippy --fix) ✅ COMPLETE               │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Manual TypeScript Fixes → 18 remaining 🔄 IN PROGRESS     │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Manual Python Mypy Fixes → 289 errors ⏳ PENDING          │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Manual Rust Clippy Fixes → ~100 errors ⏳ PENDING         │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 6: Dependency Updates (Non-breaking) → ~10 packages ⏳        │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 7: Major Dependency Migrations (Separate Tracked Work) ⏳     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: ALES Configuration Compliance

**Goal:** Bring configuration files into full ALES compliance before fixing any code errors.

### 0.1 TypeScript Configuration (`tsconfig.json`)

| Gap | Fix | Risk |
|-----|-----|------|
| Missing `noUncheckedIndexedAccess` | Add `"noUncheckedIndexedAccess": true` | **May introduce new errors** |
| Missing `exactOptionalPropertyTypes` | Add `"exactOptionalPropertyTypes": true` | **May introduce new errors** |

**Recommended Approach:**
1. Add flags
2. Run `npm run ci:js:types`
3. Document new error count
4. Proceed to Phase 3 with full error awareness

### 0.2 Python Configuration (`pyproject.toml`)

| Gap | Fix | Risk |
|-----|-----|------|
| Missing explicit `fix = false` for Ruff CI | Add to `[tool.ruff.lint]` section | None |
| Missing explicit `strict_optional = true` for Mypy | Add to `[tool.mypy]` section | None (implied by `strict=true`) |
| Missing `types-PyYAML` dependency | Add to `requirements.txt` | None |

### 0.3 Rust Configuration

| Gap | Fix | Risk |
|-----|-----|------|
| Missing `#![deny(unsafe_code)]` | Add at top of `src-tauri/src/main.rs` | None (no unsafe code exists) |
| Missing `rust-toolchain.toml` | Create file with `channel = "stable"` | None |

---

## Phase 1: Auto-Fixable Python (Ruff)

**Command:** `ruff check . --fix`

**Patterns Fixed Automatically:**

| Pattern Code | Description | Est. Count |
|--------------|-------------|------------|
| `UP006`, `UP007`, `UP035` | Modern type syntax (`List[X]` → `list[X]`) | ~350 |
| `W291`, `W293` | Trailing whitespace | ~750 |
| `I001` | Import sorting | ~30 |
| `F401` | Unused imports (some) | ~30 |

**Estimated Reduction:** ~1160 errors

**Execution:**
```powershell
# Local only - NEVER in CI
ruff check . --fix --unsafe-fixes
ruff format .
```

**Validation Gate:**
```powershell
ruff check . --no-fix
# Expected: ~340 remaining errors (manual fixes needed)
```

---

## Phase 2: Auto-Fixable Rust (Clippy)

**Command:** `cargo clippy --fix --allow-dirty --allow-staged`

**Patterns Fixed Automatically:**

| Pattern | Description | Est. Count |
|---------|-------------|------------|
| `uninlined_format_args` | `format!("{}", x)` → `format!("{x}")` | ~40 |
| `redundant_closure_for_method_calls` | `.map(\|x\| x.to_string())` → `.map(ToString::to_string)` | ~5 |

**Estimated Reduction:** ~45 errors

**Validation Gate:**
```powershell
cargo clippy -- -D warnings
# Expected: ~105 remaining errors
```

---

## Phase 3: Manual TypeScript Fixes

**Initial Errors:** 117 (after ALES config update)  
**Current Errors:** 18  
**Progress:** 85% complete (99 errors fixed)  
**Status:** 🔄 IN PROGRESS

**Remaining Error Distribution (as of 2026-01-08T21:09:00Z):**

| Pattern | Count | Fix Strategy |
|---------|-------|-------------|
| `TS2375` | 4 | Add `\| undefined` to optional props |
| `TS2322` | 4 | Type narrowing, explicit casts |
| `TS6133` | 4 | Delete unused variables (still flagged after _-prefix) |
| `TS2345` | 2 | Type narrowing |
| `TS18048` | 1 | Null checks |
| `TS2532` | 1 | Null checks |
| `TS2379` | 1 | Conditional spread |
| `TS2769` | 1 | Fix callback types |

**Files with Remaining Errors:**
- `src/components/factory/TemplateComponentRenderer.tsx` - TS2322
- `src/components/gallery/GalleryManager.tsx` - TS2375 (3 instances)
- `src/components/templates/TemplatePreview.tsx` - TS2375
- `src/components/testing/HealthDashboard.tsx` - TS6133
- `src/components/testing/LogViewer.tsx` - TS6133
- `src/components/testing/MethodInvoker.tsx` - TS6133
- `src/components/testing/PluginTester.tsx` - TS2322
- `src/components/ui/ThemePreview.tsx` - TS2322 (2 instances)
- `src/components/wizard/ImportWizard.tsx` - TS2345
- `src/hooks/useIpc.ts` - TS6133 (2 instances)
- `src/hooks/usePlugin.ts` - TS6133, TS2322
- `src/stores/projectStore.ts` - TS2322, TS2532

**Files Modified This Session (30+ files):**
- `src/components/ai/LiveComponentPreview.tsx`
- `src/components/ai/RegisterContractWizard.tsx`
- `src/components/factory/ComponentGallery.tsx`
- `src/components/factory/PluginGallery.tsx`
- `src/components/project/ComponentEditor.tsx`
- `src/components/ui/SettingsPanel.tsx`
- `src/components/wizard/DependencySelector.tsx`
- `src/hooks/useComponentGenerator.ts`
- `src/utils/backup.ts`
- `src/utils/exporter.ts`
- (plus 20+ UI component files with displayName additions)

**Checkpoint Artifact:** `outputs/ts_errors_current.txt`

**Validation Gate:**
```powershell
npm run ci:js:types
# Expected: 0 errors (currently 18)
```

---

## Phase 4: Manual Python Mypy Fixes

**Total Errors:** 289

**Pattern Groups:**

| Pattern | Root Cause | Fix Strategy | Count |
|---------|------------|--------------|-------|
| `[no-untyped-def]` | Missing function annotations | Add return types + params | ~100 |
| `[no-untyped-call]` | Calling untyped functions | Fix callees first | ~60 |
| `[override]` | Contract signature mismatch | Align with base class | ~15 |
| `[import-untyped]` | Missing type stubs | Add `types-*` packages | 5 |
| `[attr-defined]` | Missing module attributes | Fix imports or add stubs | ~10 |
| `[misc]` | Various type issues | Case-by-case | ~99 |

**Fix Order (by dependency):**
1. **`[import-untyped]`** - Add `types-PyYAML` to requirements.txt
2. **`[no-untyped-def]`** - Add annotations (largest batch)
3. **`[override]`** - Align contract methods
4. **`[no-untyped-call]`** - Naturally resolved after #2

**Validation Gate:**
```powershell
mypy .
# Expected: 0 errors
```

---

## Phase 5: Manual Rust Clippy Fixes

**Total Errors:** ~105 (after Phase 2)

**Pattern Groups:**

| Pattern | Root Cause | Fix Strategy | Count |
|---------|------------|--------------|-------|
| `doc_markdown` | Missing backticks in docs | Add \`code\` formatting | ~50 |
| `needless_pass_by_value` | `String` instead of `&str` | Change to borrows | ~20 |
| `unnecessary_wraps` | Unnecessary `Result` | Return value directly | ~5 |
| `unreadable_literal` | `1000000` → `1_000_000` | Add underscores | ~10 |
| Other pedantic | Various | Case-by-case | ~20 |

**Validation Gate:**
```powershell
cargo clippy -- -D warnings
# Expected: 0 errors
```

---

## Phase 6: Non-Breaking Dependency Updates

**Safe Updates (No API Changes):**

| Ecosystem | Package | From | To |
|-----------|---------|------|-----|
| NPM | `@mui/material` | 7.3.6 | 7.3.7 |
| NPM | `reactflow` | 11.10.1 | 11.11.4 |
| NPM | `eslint` | 9.6.0 | 9.39.2 |
| NPM | `typescript-eslint/*` | 8.51.0 | 8.52.0 |
| NPM | `oxlint` | 1.0.0 | 1.38.0 |
| Pip | `PyYAML` | 6.0.2 | 6.0.3 |
| Pip | `jsonschema` | 4.23.0 | 4.26.0 |
| Pip | `pydantic-graph` | 1.39.0 | 1.40.0 |
| Pip | `python-dotenv` | 1.1.1 | 1.2.1 |
| Pip | `httpx` | 0.27.2 | 0.28.1 |

**Execution:**
```powershell
# NPM
npm update @mui/material reactflow eslint typescript-eslint oxlint

# Pip
pip install --upgrade PyYAML jsonschema pydantic-graph python-dotenv httpx
```

---

## Phase 7: Major Dependency Migrations (TRACKED WORK)

**⚠️ These require dedicated migration plans with their own validation cycles:**

| Migration | Current | Target | Complexity | Estimate |
|-----------|---------|--------|------------|----------|
| Vite 5→7 | 5.4.21 | 7.3.1 | **HIGH** | 4-8 hours |
| Tauri v1→v2 | 1.6.x | 2.x | **VERY HIGH** | 16-32 hours |
| React 18→19 | 18.3.1 | 19.x | **HIGH** | 8-16 hours |
| Zustand 4→5 | 4.5.7 | 5.0.9 | **MEDIUM** | 2-4 hours |
| TailwindCSS 3→4 | 3.4.19 | 4.x | **HIGH** | 4-8 hours |
| pydantic-ai | 0.0.18 | 1.40.0 | **VERY HIGH** | 8-16 hours |

**Recommendation:** Create separate task items for each migration.

---

## Part C: Execution Checklist

### Pre-Flight Checks

- [ ] All changes are committed (clean working directory)
- [ ] CI is currently passing on main/develop branch
- [ ] Backup branch created: `git checkout -b backup/pre-remediation`

### B. The Index Access Mandate
**Old Habit:**
```typescript
const item = items[index];
```
**New Invariant:**
Always handle the `undefined` case.
```typescript
const item = items[index];
if (!item) throw new Error("Invariant failed");
// OR
const item = items[index]!; // ONLY if index logic is structurally guaranteed
```

### C. The Interface Extension Mandate
**Old Habit:**
```typescript
interface Props extends HTMLAttributes<div change> { ... }
```
**New Invariant:**
Always `Omit` conflicting keys explicitly before extending.
```typescript
interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onReset'> { ... }
```

### D. The Verification Loop
1. **Read:** `view_file` to confirm exact context.
2. **Plan:** Write the strict pattern mentally first.
3. **Execute:** `replace_file_content`.
4. **Verify:** Use `tsc` on the single file immediately if complex.
