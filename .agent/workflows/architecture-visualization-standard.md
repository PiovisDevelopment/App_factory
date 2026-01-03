---
description: Standard practice for implementing Architecture Blueprint Visualizations in App Factory applications.
---

# Architecture Visualization Standard

This standard defines the mandatory design patterns and implementation logic for the "Architecture Blueprint" view. This view is **required** for all new "Complete App" templates and projects to visualizes the internal data flow of the application.

## 1. Design Pillars (The "Why")

Any architecture visualization must adhere to these four pillars:

1.  **Visual Excellence**: Use glassmorphism (`backdrop-blur`, `bg-white/80`), subtle gradients, and rounded aesthetics. The UI should look premium, not like a dry diagram.
2.  **Spatial Logic (The "Borders" Rule)**: Connections must clearly bridge distinct zones. Arrows must connect to the **borders** of cards, not arbitrary center points. This requires precise layout coordination (see Section 3).
3.  **Information Density**: Never truncate text. Cards must expand or scroll (`overflow-y-auto`) to accommodate their content.
4.  **Narrative Animation**: The animation isn't just movement; it's a story. Use steps (Step 1, Step 2...) with simple, non-technical descriptions (e.g., "User types a prompt") to explain the flow to non-developers.

## 2. Implementation Pattern (The "How")

### Component Structure
The visualization consists of three layers:
1.  **SVG Overlay (`z-0`)**: Handle all connections and animations here. It is fluid and precise.
2.  **Grid Layout (`z-10`)**: The DOM elements (cards) that sit *above* the lines.
3.  **Header Controller**: Manages the animation state and displays the current step description.

### The Layout Contract (Critical)
To ensure the SVG lines connect perfectly to the DOM card borders, you **MUST** use a percentage-based grid that matches your SVG `viewBox`.

**Standard Ratio:**
- **SVG ViewBox**: `0 0 1000 300`
- **Grid Columns**: `[10%_28%_28%_28%]` with `gap-[2%]`

| Zone | Grid Width | SVG Start X | SVG End X | Connection X |
| :--- | :--- | :--- | :--- | :--- |
| **User** | 10% | 0 | 100 | ~85 (Right Edge) |
| **Gap 1** | 2% | 100 | 120 | **85 -> 125** |
| **Frontend** | 28% | 120 | 400 | ~125 (Left), ~385 (Right) |
| **Gap 2** | 2% | 400 | 420 | **385 -> 425** |
| **IPC** | 28% | 420 | 700 | ~425 (Left), ~685 (Right) |
| **Gap 3** | 2% | 700 | 720 | **685 -> 725** |
| **Plugin** | 28% | 720 | 1000 | ~725 (Left) |

### Animation Logic
1.  **State**: `activeStep` (number | null).
2.  **Loop**: Use `setTimeout` with **3000ms** (slow pace) to cycle through steps.
3.  **Data Structure**:
    ```typescript
    interface DataFlow {
      step: number;
      from: 'zone_a' | 'zone_b';
      to: 'zone_b' | 'zone_c';
      label: string; // Internal
      description: string; // "Step 1: User does X"
    }
    ```

## 3. Standard Code Template

When creating a new `*BlueprintPanel.tsx`, start with this structure:

```tsx
// Standard Imports
import { type CanvasElement } from './CanvasEditor';

// ... (Types & Helper Functions)

export const BlueprintPanel = ({ elements }) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  // ... (Animation Loop @ 3000ms)

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* HEADER: Centered Description */}
      <div className="relative ...">
         {/* ... Title ... */}
         {/* CENTERED DESCRIPTION */}
         <div className="absolute left-1/2 top-1/2 -translate-x-1/2 ...">
            {currentFlow.description}
         </div>
      </div>

      {/* BODY: SVG + Grid */}
      <div className="relative flex-1 ...">
         {/* LAYER 1: SVG OVERLAY */}
         <div className="absolute inset-x-6 ...">
            <svg viewBox="0 0 1000 300">
               {/* Connections using specific coordinates (85->125, etc.) */}
            </svg>
         </div>

         {/* LAYER 2: GRID CONTENT */}
         <div className="grid grid-cols-[10%_28%_28%_28%] gap-[2%] ...">
            {/* Zones ... */}
         </div>
      </div>
    </div>
  )
}
```

## 4. Integration Checklist
- [ ] Connect the panel to the App's main view toggle.
- [ ] Pass the live list of components/plugins to the panel.
- [ ] Verify alignment at multiple window sizes (flexibility check).
- [ ] Ensure step descriptions are simple and non-technical.
