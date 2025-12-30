# How to Generate Interactive UATs

This guide explains how to convert a text-based User Journey (UJ) into an interactive `UAT_[ID]_Interactive.html` file using the **UAT Master Template**.

## 1. Prerequisites
- **Source Material**: A text description or existing `UAT_*.md` file defining the steps, checks, and commands.
- **Master Template**: `docs/UAT_Plans/_TEMPLATES/UAT_Master_Template.html`.

## 2. Process

### Step 1: Confirm the UJ Source
Identify the file containing the User Journey logic (e.g., `backend_plan.md`, `UAT_UJ1.1.4.md`, or a user prompt).
*Example: "I want to create a UAT for UJ-1.2.0 defined in the backend plan."*

### Step 2: Construct the Configuration JSON
Create a JSON object adhering to the following schema:

```json
{
  "id": "UJ-X.Y.Z",
  "title": "Short Title of Journey",
  "category": "Frontend / Backend  / Integration",
  "description": "High-level goal of this test.",
  "steps": [
    {
      "id": 1,
      "title": "Step Title",
      "instruction": "Detailed action for the user to take.",
      "command": "npm run dev",  // (Optional) Command to run
      "preValidated": false,     // Set to true if AI has verified this
      "evidenceImage": "img/UJX.Y.Z/step1_evidence.png", // (Optional) Path to AI screenshot
      "checks": [
        "Check 1: Something appears",
        "Check 2: Something helps"
      ]
    }
  ]
}
```

### Step 3: Create the HTML File
1.  Read the content of `UAT_Master_Template.html`.
2.  Replace the string `{{CONFIG_JSON}}` with your constructed JSON.
3.  Save the new file as `docs/UAT_Plans/UAT_[ID]_Interactive.html`.

### Step 4: Verify
1.  Open the new HTML file in a browser.
2.  Ensure steps render correctly.

## 3. Automation Protocol (The "Gold Standard" Workflow)
To fully replicate the thorough process we used, the AI must not just generate the text, but **conduct the simulation** to generate the evidence.

### Phase 1: Context & Configuration
**Prompt:**
> "I need to generate an interactive UAT HTML for [UJ ID] found in [Source File].
> 1. Read the source file and extract the steps.
> 2. Construct the `UAT_CONFIG` JSON logic.
> 3. Read `docs/UAT_Plans/_TEMPLATES/UAT_Master_Template.html`.
> 4. Generate the HTML file at `docs/UAT_Plans/UAT_[UJ ID]_Interactive.html` (Use `img/[UJ ID]/step[N].png` for image paths)."

### Phase 2: Simulation & Evidence (Crucial)
**Prompt (After Phase 1 is done):**
> "Now, perform the **Simulation Run** to populate the evidence for `UAT_[UJ ID]_Interactive.html`:
> 1. Start the app (`npm run dev` or `npm run tauri:dev`).
> 2. Use the `browser_subagent` to physically perform each step defined in the UAT.
> 3. For each step, capture a screenshot and save it to the path `docs/UAT_Plans/img/[UJ ID]/step[N].png` or `.webp` defined in the config.
>    - **CRITICAL**: If the tool saves as PNG, you **MUST** run a conversion script (e.g., Python PIL) to convert it to a valid WebP file. Simply renaming the extension is insufficient.
> 4. **Analyze Errors:** If a step fails or behaves unexpectedly (e.g. input not saving):
>    - Check console logs for system errors.
>    - Differentiate between a real APP failure vs. a SIMULATION artifact (e.g., React state not registering fast typing).
>    - If unsure, verify manually before reporting a bug.
> 5. Verify that the UAT HTML now displays these real screenshots."

### Phase 3: Validation
**Prompt:**
> "Finally, open the generated `UAT_[UJ ID]_Interactive.html` in the browser and verify:
> 1. The JSON config is valid (UI loads).
> 2. The Severity Dropdowns allow 'COSMETIC', 'FUNCTIONAL', 'BLOCKER'.
> 3. The 'Strict Blocker' logic works (try failing a step).
> 4. All evidence screenshots load correctly."
