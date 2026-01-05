# Quality Gate Issues Log

**Last Updated:** 2026-01-05T15:38:00Z  
**Phase:** 4.1 (Critical Blockers) - Partially Complete

---

## Summary

| Gate | Status | Critical | High | Medium | Low | Notes |
|------|--------|----------|------|--------|-----|-------|
| **TypeScript Types** | ❌ FAIL | 0 | 0 | 0 | 54 | Only unused variables remain |
| **ESLint** | ❌ FAIL | 0 | TBD | TBD | TBD | Re-running to get count |
| **Mypy** | ❌ FAIL | 6 | 0 | 0 | 0 | Namespace collision in `plugins/_host` |
| **Clippy** | ✅ PASS | 0 | 0 | 0 | 0 | **FIXED** |
| **Vite Build** | ✅ PASS | 0 | 0 | 0 | 0 | **PASSED** (warnings only) |
| **Ruff** | ❌ FAIL | 0 | 0 | 21800+ | 0 | Not yet addressed |

---

## Phase 4.1 Fixes Applied

### ✅ Completed
1. **Rust Clippy** - Fixed lint priority conflicts + build.rs semicolon → **PASSING**
2. **TypeScript Critical Errors** - Fixed 4 critical type errors:
   - `setTimeout` return type (number vs Timeout)
   - `getComponentCode` return type (null vs undefined)
   - `templateName` prop type (null vs undefined)
   - `ComponentFramework` import added
3. **ESLint Parsing Errors** - Extended `tsconfig.eslint.json` to include:
   - `debug_eslint.mjs`
   - `eslint.config.mjs`
   - `scripts/**/*.js`

### ⚠️ Partially Fixed
4. **Mypy Duplicate Module** - Added `__init__.py` to skill directories, but **NEW ERRORS** appeared in `plugins/_host/`

---

## Remaining Critical Issues (6 total)

### Mypy Errors (6 errors in 5 files)

#### Error 1: Library Stubs Not Installed
**File:** `plugins/_host/discovery.py:31`  
**Error:** `Library stubs not installed for "jsonschema"`  
**Fix:** Run `pip install types-jsonschema`  
**Severity:** Medium (type checking only)

#### Error 2-6: Namespace Collision
**Files:**
- `plugins/_host/__init__.py`
- `plugins/_host/discovery.py`
- `plugins/_host/health.py`
- `plugins/_host/ipc.py`
- (1 more file)

**Error:** `Source file found twice under different module names: "_host" and "plugins._host"`

**Root Cause:** Mypy is detecting the `plugins/_host/` directory as both:
- A top-level module `_host` (incorrect)
- A submodule `plugins._host` (correct)

**Possible Fixes:**
1. Add `plugins/__init__.py` to make `plugins` a proper package
2. Use `--explicit-package-bases` flag in Mypy config
3. Exclude `plugins/_host` from Mypy checking (not ideal)

**Severity:** High (blocks all Mypy checking)

---

## Remaining Low-Severity Issues

### TypeScript Unused Variables (54 errors)
All remaining TypeScript errors are **TS6133** (unused variables/imports) or **TS6196** (unused type declarations).

**Examples:**
- `src/components/ai/ChatInterface.tsx:361` - 'headerActions' declared but never used
- `src/components/ai/FixSuggestions.tsx:17` - 'Modal' imported but never used
- `src/components/factory/CanvasEditor.tsx:26` - All imports unused

**Remediation:** Batch removal (can be automated)  
**Severity:** Low (code cleanliness, no runtime impact)

---

## Next Steps

### Immediate (Phase 4.1 Completion)
1. ✅ Fix Mypy namespace collision:
   - Create `plugins/__init__.py`
   - OR add `--explicit-package-bases` to `pyproject.toml`
2. ✅ Install missing type stubs: `pip install types-jsonschema`
3. ✅ Re-run all gates to verify monotonic decrease

### Phase 4.2 (High-Severity Correctness)
- React hooks violations (~6 errors)
- Floating promises (~20 errors)
- Misused promises (~20 errors)

### Phase 4.3 (Medium-Severity Type Safety)
- Unsafe `any` usage (~196 errors)
- Python import organization (~3000 violations)

### Phase 4.4 (Low-Severity Cleanup)
- Remove TypeScript unused variables (54 errors)
- Auto-fix Python whitespace (~15000 violations)
- Auto-fix ESLint stylistic (~975 errors)

---

## Monotonic Decrease Verification

**Rule:** Error counts must decrease (or stay at 0) after each phase.

| Gate | Baseline | Current | Delta | Status |
|------|----------|---------|-------|--------|
| TS Types | 58 | 54 | -4 | ✅ DECREASED |
| ESLint | 1225 | TBD | TBD | ⏳ PENDING |
| Mypy | 1 | 6 | +5 | ❌ **INCREASED** |
| Clippy | Build Failed | 0 | N/A | ✅ FIXED |
| Build | PASS | PASS | 0 | ✅ MAINTAINED |
| Ruff | 21800+ | 21800+ | 0 | ⏸️ NOT ADDRESSED |

**Phase 4.1 Status:** ❌ **NOT COMPLETE** - Mypy errors increased from 1 to 6.

**Action Required:** Fix Mypy namespace collision before proceeding to Phase 4.2.
