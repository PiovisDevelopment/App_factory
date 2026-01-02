# FE AI Canvas Quick Start Guide

## What's New?

The Frontend AI can now **make changes to your canvas UI** with your approval.

## Two Modes

### 💬 Chat Mode (Read-Only)
- Ask questions about your UI
- AI analyzes but doesn't change anything
- Great for learning and planning

**Example:**
```
User: "What buttons do I have?"
AI: "I see a Submit button at x:100 y:200 and a Cancel button at x:300 y:200"
(No changes made)
```

### ✏️ Change Mode (Executable with Approval)
- Ask AI to modify your canvas
- AI presents a plan for approval
- You approve or reject
- Changes are applied only after approval

**Example:**
```
User: "Make the submit button wider"

[AI analyzes canvas and responds with a plan]

Approval Modal Appears:
"Resize element [btn_123] to width: 300px, height: 40px"

[You click Approve]

Changes Applied!
```

## Getting Started

### Step 1: Switch to Change Mode
Look at the AI panel on the left sidebar:
- Toggle button at top: **chat** | **change**
- Click **change** to enable modifications

### Step 2: Select Scope
Below the mode toggle:
- **BE** - Backend (plugins, services)
- **FE** - Frontend (canvas UI) ← Use this for canvas changes
- **Full** - Both (architect mode)

Click **FE** for canvas modifications.

### Step 3: Ask for Changes
Type your request in the chat:
- "Add a button in the top right"
- "Make the panel wider"
- "Change the header color to blue"
- "Delete the unused input field"

### Step 4: Review & Approve
When AI proposes a plan:
1. Modal appears showing the changes
2. Review the summary
3. Click **Approve** to apply
4. Or click **Reject** if you want something different

Alternatively, just type:
- "yes" or "approve" or "go" or "proceed" to approve
- "no" or "reject" or "cancel" to reject

### Step 5: See Results
Canvas updates with your AI-suggested changes!

---

## What the AI Can Do

✅ **Can Do:**
- Add new elements (buttons, inputs, containers)
- Move elements to new positions
- Resize elements
- Update element properties (label, color, etc.)
- Delete unused elements
- Clear the entire canvas
- Suggest layouts based on what you show it

❌ **Cannot Do:**
- Edit App Factory code (only your loaded app)
- Change themes (use Theme panel for that)
- Create AI plugins (use the AI App Chat for planning)
- Edit the backend (use BE scope for that)

---

## Tips & Tricks

### Tip 1: Show the Canvas
The AI can only see the canvas when it's loaded. To help:
1. Switch to FE scope
2. Ask your question - AI will see the current canvas screenshot

### Tip 2: Be Specific
Instead of: "Make it better"
Try: "Add a search button at the top left and make the main panel wider"

### Tip 3: Use "No" to Iterate
If the plan isn't quite right:
1. Click "Reject" in the approval modal
2. Type: "Actually, can you make it even wider?"
3. AI suggests again

### Tip 4: Check Element Names
If AI can't find an element:
- The element might be hidden or locked
- Try describing what you want instead of the element name
- AI will suggest which elements to modify

### Tip 5: Watch the Status
In the approval modal:
- ✓ Success = change was applied
- ✗ Failed = something went wrong
- Check the error message for details

---

## Common Workflows

### Workflow 1: Build a New Layout
```
1. Start with empty canvas
2. Change mode → FE scope
3. "Create a header bar with a title"
   [Approve] → Header appears
4. "Add a main content area below it"
   [Approve] → Content panel appears
5. "Add a footer with copyright"
   [Approve] → Footer appears
```

### Workflow 2: Refine an Existing UI
```
1. Open your saved project
2. Change mode → FE scope
3. "The buttons are too small, make them 50px taller"
   [Approve] → Buttons resize
4. "Space them out more horizontally"
   [Approve] → Buttons spread out
5. Done! Save your project
```

### Workflow 3: Learn from AI
```
1. Chat mode → FE scope
2. "Why is this layout inefficient?"
   AI explains UX issues
3. Switch to Change mode
4. "Fix those issues"
   [Approve] → Better layout
```

---

## Troubleshooting

### Approval Modal Won't Appear
- Make sure mode is **change** (not chat)
- Make sure scope is **FE** or **Full** (not BE)
- Make sure AI's response actually proposed changes

### AI Says "Element Not Found"
- Element might be hidden (eye icon in inspector)
- Element might have a different name
- Try describing the element visually instead

### Changes Didn't Apply
- Click "Approve" in the modal (not just close it)
- Check the execution results for errors
- Try a simpler change first

### AI Responds Slowly
- It's analyzing your canvas screenshot
- This is normal for vision-capable AI
- Chat without vision (BE scope) is faster

### AI Suggestions Are Wrong
- Tell it what you wanted: "No, make it center-aligned instead"
- AI learns from your feedback in the conversation
- Third time's usually the charm!

---

## What Happens Behind the Scenes?

When you use Change mode:

1. **You type** → "Add a button"
2. **AI analyzes** → Canvas screenshot sent to AI
3. **AI plans** → Generates action list (add, move, resize, etc.)
4. **You review** → See summary in approval modal
5. **You approve** → Click "Approve" button
6. **Changes apply** → Canvas updates immediately
7. **You see results** → AI reports success/failures

The approval step keeps YOU in control. AI suggests, you approve.

---

## Need More Help?

See the full documentation:
- **FE_AI_CANVAS_INTEGRATION.md** - Detailed technical guide
- **TROUBLESHOOTING.md** - More troubleshooting tips
- Ask the AI in Chat mode: "How does the canvas work?"

Happy designing! 🎨
