# UAT & Simulation FAQ / Troubleshooting

This document compiles unique challenges encountered during the creation of the UAT Framework and their solutions to prevent recurrence.

## 1. Simulation Environment Issues
### Issue: "Browser subagent cannot connect to localhost"
**Context:** When attempting to simulate user steps, the agent receives `ERR_CONNECTION_REFUSED`.
*   **Cause:** The development server (`npm run dev`) was not started, or the agent attempted to connect before the server was ready.
*   **Prevention:**
    *   **Always** explicitly run `npm run dev` (or `npm run tauri:dev`) in the background *before* invoking the browser subagent.
    *   Use `curl` or a `sleep` command to wait for the port (e.g., 1420) to be active.

### Issue: "Tauri commands (invoke) fail in Browser simulation"
**Context:** The app depends on `window.__TAURI__.invoke` to talk to the backend, which doesn't exist in a standard Chrome/Edge browser.
*   **Cause:** Missing backend interface.
*   **Solution (Implemented):** A **Mock Layer** (`src/mocks/tauri-v1.8-mock.js`) was created.
*   **Prevention:** Ensure the mock layer is injected in `main.tsx`. If you add new backend commands, **you must update the mock file** to handle them, otherwise the simulation will hang or error.
*   **Crucial Distinction:** This Mock Layer allows **Simulation** in a browser. It does **NOT** execute real backend logic (e.g., Python AI plugins). To verify **Real** functionality, you must run the app in Desktop Mode (`npm run tauri:dev`) where `window.__TAURI_IPC__` is natively provided.

### Issue: "Mock data polluting Production"
**Context:** Concern that test data (e.g., "Kokoro TTS") might show up in the real released app.
*   **Solution (Implemented):** The import in `main.tsx` is guarded:
    ```javascript
    if (typeof window !== 'undefined' && !window.__TAURI__) {
       import('./mocks/tauri-v1.8-mock');
    }
    ```
*   **Prevention:** NEVER remove this guard. Always verify "Production Mode" by running the real Tauri app to ensure mocks are absent.

## 2. Template & Logic Issues
### Issue: "Critical failures didn't stop the test"
**Context:** In early templates, if step 2 failed blockage, the user still had to click through steps 3, 4, 5.
*   **Solution:** Implemented **Blocking Logic**.
    *   Added "Strict Blocker" option in Severity Dropdown.
    *   Added checkbox: "This stops me from doing the next steps".
    *   Logic: If blocked, all subsequent steps are auto-marked as `SKIPPED_BLOCKED`.
*   **Prevention:** Use the **UAT Master Template** (`_TEMPLATES/UAT_Master_Template.html`). Do not attempt to write UAT logic from scratch; always inject JSON into the Master Template.

### Issue: "TypeScript Linter Errors on Mock Files"
**Context:** Importing a `.js` mock file into a `.tsx` project caused "Could not find declaration file".
*   **Solution:** Created `src/mocks/tauri-v1.8-mock.d.ts`.
*   **Prevention:** When adding new JS mocks, always create a corresponding `.d.ts` file immediately to keep the build clean.

## 3. Evidence Capture
### Issue: "Simulation finished but no screenshots found"
**Context:** The agent performed the steps but didn't save evidence.
*   **Cause:** The "Simulation Phase" instructions were implicit, not explicit.
*   **Prevention:** Follow **Phase 2** of `How_To_Generate_UAT.md`. You must explicitly instruct the `browser_subagent` to:
    1.  Perform Action.
    2.  **Take Screenshot**.
    3.  **Save to** `docs/UAT_Plans/img/[UJ-ID]/step[N].png`.

## 4. Automation & React/Tauri Nuances
### Issue: "Input field updated by script but React didn't 'see' it"
**Context:** The automation script set `input.value = "Red Theme"` and clicked Save, but the app behaved as if the input was empty (Save button didn't trigger or saved empty string).
*   **Cause:** Direct DOM manipulation (`.value = ...`) often bypasses React's `onChange` event listeners, leaving the component state unchanged.
*   **Solution:**
    *   **Try dispatching events:** `input.dispatchEvent(new Event('input', { bubbles: true }));`
    *   **Fallback:** If automation fails, explicitly mark the step instructions with **"Manually type..."** and set `preValidated: false`.
    *   **Documentation:** Update the UAT step instruction to warn the user (e.g., "NOTE: Automation failed here, type manually").

### Issue: "Browser Subagent saved images to wrong folder"
**Context:** You requested a specific path `.../docs/img/...` but the tool saved it to the internal `artifacts` directory.
*   **Cause:** The browser tool might enforce sandboxing or default paths.
*   **Solution:** always include a **Verification/Copy Step** in your process.
    *   After simulation, run a command to move/copy the files: `Copy-Item [ArtifactPath] -Destination [ProjectPath]`.

### Issue: "Connection Refused on Port 5173"
**Context:** Tried to connect to `http://localhost:5173` (Vite default) but failed.
*   **Cause:** Tauri applications typically serve on **port 1420**.
*   **Solution:** Always verify the running port in the terminal output of `npm run dev`. Default to **1420** for Tauri, **5173** for pure Vite.

## 5. Visual / Benign Errors
### Issue: "Red 404 Error for favicon.ico"
**Context:** In the console, you see `Failed to load resource: the server responded with a status of 404 (Not Found)`.
*   **Cause:** The browser automatically requests a website icon (`favicon.ico`). If one isn't provided in the `public` folder, this error appears.
*   **Impact:** **None**. This is purely cosmetic and does not affect app functionality. It can be safely ignored during UAT.
