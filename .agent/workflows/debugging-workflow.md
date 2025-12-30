---
description: A workflow for debugging root causes of issues following the anti-bias protocols
---

# Debugging Workflow

This workflow ensures systematic debugging following the Anti-Bias Protocols from the global rules.

## 1. Problem Definition

- [ ] Read the traceability matrix to understand the requirement context
- [ ] Identify the specific EUR/REQ being debugged
- [ ] Document the expected behavior vs actual behavior

## 2. Root Cause Analysis

- [ ] Search codebase for relevant files (components, hooks, services)
- [ ] View file outlines to understand structure
- [ ] View specific code sections related to the issue
- [ ] Trace the data/control flow from input to output
- [ ] Identify the exact location where behavior diverges from expectation

## 3. Hypothesis Formation

- [ ] Formulate a clear hypothesis about the root cause
- [ ] Document evidence supporting the hypothesis

## 4. Implementation Plan

- [ ] Create implementation plan with proposed changes
- [ ] Map changes to specific files and line ranges
- [ ] Document verification steps

## 5. User Approval Gate

- [ ] HALT → Present plan → Await explicit user "GO" / "APPROVED" / "PROCEED"
- [ ] Do NOT proceed until user explicitly approves

## 6. Implementation

- [ ] Execute changes per the approved plan
- [ ] Verify each change before proceeding to next

## 7. Verification

- [ ] Run verification steps from the plan
- [ ] Capture evidence of fix
- [ ] Update traceability registry if applicable
