# Phase 4: Mypy Manual Fixes - Implementation Plan
**Created:** 2026-01-08T19:57:56Z  
**Phase:** 4 of 7 (Mypy Manual)  
**Target:** Resolve all 289 Mypy errors across 38 Python files  
**Methodology:** Debugging Workflow (GEMINI rules §2)

---

## Overview

| Metric | Value |
|--------|-------|
| **Total Errors** | 289 |
| **Files Affected** | 38 |
| **Estimated Batches** | 7 |
| **Risk Level** | Medium-High |

---

## Error Categorization

| Category | Count | Auto-Fix? | Risk | Priority |
|----------|-------|-----------|------|----------|
| Missing stubs (`import-untyped`) | 5 | ✅ Dependency install | None | P0 |
| Missing type annotations (`no-untyped-def`) | ~100 | Manual | Low | P1 |
| Untyped calls (`no-untyped-call`) | ~60 | Manual (cascade from P1) | Medium | P2 |
| Override mismatches (`override`) | ~15 | Manual | High | P3 |
| Import path conflicts (`attr-defined`, `arg-type`) | 8+ | Manual | High | P4 |
| Type compatibility (`assignment`, `arg-type`) | ~30 | Manual | Medium | P5 |
| Other (var-annotated, type-arg, etc.) | ~70 | Manual | Low-Medium | P6 |

---

## Batch Strategy

### **Batch 0: Prerequisites** (0 errors → enables all others)
**Purpose:** Install missing type stubs  
**Risk:** None  
**Validation:** `mypy .` shows reduction from 289 to ~284 errors

**Changes:**
1. Add `types-PyYAML` to `requirements.txt`
2. Install: `pip install types-PyYAML`

**Files Affected:**
- `requirements.txt`

**Expected Error Reduction:** 5 errors (lines with `[import-untyped]`)

---

### **Batch 1: Contract Base Methods** (~15 errors)
**Purpose:** Fix plugin contract override signature mismatches  
**Risk:** High (affects plugin architecture)  
**Validation:** `mypy .` on `contracts/` and `plugins/` directories

**Root Cause:** Base class methods in `contracts/base.py` have incorrect signatures:
- `shutdown()` should return `Coroutine[Any, Any, bool]` not `bool`
- `health_check()` should return `Coroutine[Any, Any, HealthStatus]` not `HealthStatus`
- `complete_stream()` in `llm_contract.py` incorrectly defined

**Strategy:**
1. First verify base contract signatures in `contracts/base.py`
2. Then fix plugin implementations to match

**Files to Fix:**
- `contracts/base.py` (define correct async signatures)
- `contracts/llm_contract.py:310` (`complete_stream` signature)
- `plugins/tts_example_plugin/plugin.py:97,101`
- `plugins/stt_whisper/plugin.py:131,137`
- `plugins/llm_ollama_v2/plugin.py:103,110,310`
- `plugins/tts_kokoro/plugin.py:202,212`

**Expected Error Reduction:** 15 errors

---

### **Batch 2: Import Path Conflicts** (~8 errors)
**Purpose:** Resolve `DiscoveredPlugin` import ambiguity  
**Risk:** High (could break plugin discovery)  
**Validation:** `mypy plugins/_host/` 

**Root Cause:** `DiscoveredPlugin` is defined in both:
- `plugins/_host/discovery.py`
- `plugins/_host/loader.py`

**Strategy:**
1. Determine canonical location for `DiscoveredPlugin`
2. Consolidate to single definition
3. Update all imports

**Files to Fix:**
- `plugins/_host/validator.py:465` (undefined `DiscoveredPlugin`)
- `plugins/_host/loader.py:551` (import path mismatch)
- `plugins/_host/manager.py:326,480` (import path mismatch)

**Expected Error Reduction:** 4+ errors

---

### **Batch 3: Missing Config Attributes** (~10 errors)
**Purpose:** Fix undefined module attributes  
**Risk:** High (missing constants)  
**Validation:** `mypy skills/`

**Root Cause:** Config modules missing expected attributes

**Files to Investigate & Fix:**
- `skills/ppf_create_plugin/config.py` (needs `MANIFEST_TEMPLATE`, `CONTRACT_TEMPLATE`, `PLUGIN_TEMPLATE`, `TS_INTERFACE_TEMPLATE`, `TYPE_MAP`)
- `skills/ppf_manage_dependencies/config.py` (needs `DEPENDENCY_CONFIG`)

**Strategy:**
1. View each config file to verify what's actually missing
2. Add missing attributes or fix import paths
3. If attributes intentionally removed, update executor imports

**Expected Error Reduction:** 10 errors

---

### **Batch 4: Function Return Type Annotations (Skills)** (~40 errors)
**Purpose:** Add return type annotations to skills executors  
**Risk:** Low (explicit types, no behavior change)  
**Validation:** `mypy skills/`

**Files to Fix:**
- `skills/ppf_manage_dependencies/executor.py` (25+ functions)
- `skills/ppf_create_plugin/executor.py` (15+ functions)
- `skills/ppf_create_application/executor.py` (5+ functions)
- `skills/ppf_build_application/executor.py` (5+ functions)

**Pattern:**
```python
# Before
def function_name(param: str):
    return result

# After
def function_name(param: str) -> ReturnType:
    return result
```

**Expected Error Reduction:** 40+ errors

---

### **Batch 5: Function Return Type Annotations (Plugins & Services)** (~40 errors)
**Purpose:** Add return type annotations to plugin/service functions  
**Risk:** Low-Medium (affects runtime services)  
**Validation:** `mypy plugins/ services/`

**Files to Fix:**
- `plugins/_host/__init__.py` (10+ functions)
- `plugins/_host/protocol.py` (10+ functions)
- `plugins/_host/shutdown.py` (5+ functions)
- `plugins/_host/manager.py` (5+ functions)
- `services/llm.py` (10+ functions)
- `services/voice.py` (10+ functions)

**Expected Error Reduction:** 40+ errors

---

### **Batch 6: Variable Type Annotations** (~15 errors)
**Purpose:** Add explicit type annotations to variables flagged by Mypy  
**Risk:** Low  
**Validation:** `mypy .`

**Pattern:**
```python
# Before
requirements = {}

# After
requirements: dict[str, str] = {}
```

**Files to Fix:**
- `skills/ppf_manage_dependencies/executor.py:202,232,241,366,371`
- `skills/ppf_create_application/executor.py:56`
- `skills/ppf_build_application/executor.py:63`
- `plugins/llm_ollama_v2/plugin.py:373`
- `scripts/verify_agents.py:28,40`

**Expected Error Reduction:** 15 errors

---

### **Batch 7: Type Compatibility & Narrowing** (~50 errors)
**Purpose:** Fix type mismatches, add type guards, fix generic types  
**Risk:** Medium (may require logic changes)  
**Validation:** `mypy .`

**Subcategories:**

**A. Generic Type Parameters** (~10 errors)
- `plugins/_host/validator.py:304,321,364` (add `Type[...]` parameters)
- `plugins/_host/isolation.py:394,486,639` (add `tuple[...]` / `Callable[...]` parameters)
- `plugins/_host/__init__.py:112` (add `StreamHandler[...]` parameter)
- `plugins/llm_ollama/plugin.py:25,35,46` (add `dict[...]` / `list[...]` parameters)

**B. Type Narrowing** (~10 errors)
- `services/llm.py` (check `self._plugin is not None` before accessing)
- `services/voice.py` (check plugin instances before accessing)
- `skills/ppf_create_application/executor.py:114` (check file handle not None)
- `plugins/stt_whisper/plugin.py:217` (check model not None)
- `plugins/tts_kokoro/plugin.py:266` (check voice not None)

**C. Type Compatibility** (~20 errors)
- `contracts/base.py:116,118` (fix assignment type mismatch)
- `contracts/llm_contract.py:67,234` (fix list/str mismatch)
- `plugins/_host/protocol.py:172` (fix dict/str|int mismatch)
- `plugins/_host/shutdown.py:154,155,347,349` (fix signal handler types)
- `plugins/_host/__main__.py:317,349,441,477` (fix request_id type)
- Test files with wrong result variable types

**D. Other** (~10 errors)
- `services/ai_team/agents.py` (fix pydantic-ai model/tool signatures)
- `services/ai_team/orchestrator.py` (fix graph return types)
- Remove unused `type: ignore` comments

**Expected Error Reduction:** 50+ errors

---

## Validation Gates

After each batch:
```powershell
mypy .
```

**Success Criteria:**
- Error count decreases by expected amount
- No new errors introduced
- Specific files in batch show 0 errors

**Final Validation:**
```powershell
npm run ci:all
```

---

## Risk Mitigation

1. **Batch isolation:** Each batch targets unrelated files to prevent cascading failures
2. **Contract fixes first:** Batch 1 establishes correct plugin architecture
3. **Progressive validation:** Run `mypy` after each batch to catch regressions early
4. **No behavior changes:** Type annotations are purely declarative

---

## Execution Order

```
Batch 0 (Prerequisites)
  ↓
Batch 1 (Contract Base) ← High Risk, foundational
  ↓
Batch 2 (Import Paths) ← High Risk, architectural
  ↓
Batch 3 (Missing Attributes) ← High Risk, could block others
  ↓
Batch 4 (Skills Annotations) ← Low Risk, high volume
  ↓
Batch 5 (Plugin/Service Annotations) ← Medium Risk
  ↓
Batch 6 (Variable Annotations) ← Low Risk
  ↓
Batch 7 (Type Compatibility) ← Medium Risk, cleanup
  ↓
Final Validation
```

---

## Current Status

- [x] Phase 0: ALES Configuration (completed in prior session)
- [x] Phase 1: Ruff Auto-fix (completed in prior session)
- [x] Phase 2: Clippy Auto-fix (completed in prior session)
- [x] Phase 3: TypeScript Manual (completed in prior session)
- [ ] **Phase 4: Mypy Manual** ← CURRENT
- [ ] Phase 5: Clippy Manual (pending)
- [ ] Phase 6: Safe Dependencies (pending)
- [ ] Phase 7: Major Migrations (tracked separately)

---

**END OF PLAN**
