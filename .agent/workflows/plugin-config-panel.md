---
description: Implement plugin configuration panel for blueprint plugin slots
---

# Plugin Configuration Panel Implementation Workflow

This workflow implements the plugin configuration panel feature that displays plugin-specific settings when users click on a blueprint plugin slot or select a plugin from the gallery.

## Prerequisites

- App Factory project with existing `BackendBlueprintPanel.tsx`
- Existing `PropertyInspector.tsx` for element properties
- Plugin gallery with `PluginInfo` type

---

## Step 1: Create PluginConfigPanel Component

// turbo
Create file: `src/components/factory/PluginConfigPanel.tsx`

```tsx
/**
 * PluginConfigPanel - Plugin Configuration Editor
 * Displays and allows editing of plugin configuration options.
 */

import React, { useState, useCallback, useMemo } from 'react';

// Types
export interface PluginConfigOption {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'path';
  value: unknown;
  defaultValue: unknown;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: { min?: number; max?: number; pattern?: string; required?: boolean };
}

export interface PluginConfigInfo {
  id: string;
  name: string;
  version: string;
  contract: string;
  description?: string;
  config: PluginConfigOption[];
}

export interface PluginConfigPanelProps {
  plugin: PluginConfigInfo | null;
  onChange?: (key: string, value: unknown) => void;
  onApply?: (config: Record<string, unknown>) => void;
  onReset?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  className?: string;
}

// Contract colors for badges
const contractColors: Record<string, string> = {
  llm: 'bg-blue-100 text-blue-700 border-blue-200',
  tts: 'bg-purple-100 text-purple-700 border-purple-200',
  stt: 'bg-green-100 text-green-700 border-green-200',
  memory: 'bg-amber-100 text-amber-700 border-amber-200',
  database: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

export const PluginConfigPanel: React.FC<PluginConfigPanelProps> = ({
  plugin,
  onChange,
  onApply,
  onReset,
  onClose,
  readOnly = false,
  className = '',
}) => {
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const currentValues = useMemo(() => {
    if (!plugin) return {};
    const values: Record<string, unknown> = {};
    plugin.config.forEach((opt) => {
      values[opt.key] = localValues[opt.key] ?? opt.value;
    });
    return values;
  }, [plugin, localValues]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    onChange?.(key, value);
  }, [onChange]);

  const handleApply = useCallback(() => {
    if (!plugin) return;
    onApply?.(currentValues);
    setHasChanges(false);
  }, [plugin, currentValues, onApply]);

  const handleReset = useCallback(() => {
    if (!plugin) return;
    const defaults: Record<string, unknown> = {};
    plugin.config.forEach((opt) => { defaults[opt.key] = opt.defaultValue; });
    setLocalValues(defaults);
    setHasChanges(true);
    onReset?.();
  }, [plugin, onReset]);

  const getContractColor = (contract: string) => 
    contractColors[contract.toLowerCase()] || contractColors.default;

  // Empty state
  if (!plugin) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-6 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">Select a plugin to view its configuration</p>
        <p className="text-xs text-neutral-400 mt-1">Click on a plugin slot in the Blueprint panel</p>
      </div>
    );
  }

  // Render input based on type
  const renderInput = (option: PluginConfigOption) => {
    const value = currentValues[option.key];
    const baseClass = "w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed";

    switch (option.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={Boolean(value)} onChange={(e) => handleChange(option.key, e.target.checked)} disabled={readOnly} className="sr-only peer" />
            <div className="w-9 h-5 bg-neutral-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
          </label>
        );
      case 'select':
        return (
          <select value={String(value)} onChange={(e) => handleChange(option.key, e.target.value)} disabled={readOnly} className={baseClass}>
            {option.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      case 'number':
        return <input type="number" value={Number(value) || 0} onChange={(e) => handleChange(option.key, parseFloat(e.target.value))} disabled={readOnly} min={option.validation?.min} max={option.validation?.max} className={baseClass} />;
      case 'path':
        return (
          <div className="flex gap-2">
            <input type="text" value={String(value || '')} onChange={(e) => handleChange(option.key, e.target.value)} disabled={readOnly} className={`flex-1 ${baseClass} font-mono text-xs`} />
            <button type="button" disabled={readOnly} className="px-2 py-1.5 text-xs bg-neutral-100 border border-neutral-300 rounded-md hover:bg-neutral-200">📁</button>
          </div>
        );
      default:
        return <input type="text" value={String(value || '')} onChange={(e) => handleChange(option.key, e.target.value)} disabled={readOnly} className={baseClass} />;
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-800 truncate">{plugin.name}</h3>
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getContractColor(plugin.contract)}`}>
                {plugin.contract.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">v{plugin.version}</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-200" title="Close">
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {plugin.description && <p className="text-xs text-neutral-600 mt-2 line-clamp-2">{plugin.description}</p>}
      </div>

      {/* Config Options */}
      <div className="flex-1 overflow-auto p-3">
        {plugin.config.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">
            <p className="text-sm">No configuration options available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {plugin.config.map((option) => (
              <div key={option.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700">
                    {option.label}
                    {option.validation?.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {option.type === 'boolean' && renderInput(option)}
                </div>
                {option.type !== 'boolean' && renderInput(option)}
                {option.description && <p className="text-[10px] text-neutral-500">{option.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!readOnly && plugin.config.length > 0 && (
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-2">
          <div className="flex gap-2">
            <button type="button" onClick={handleApply} disabled={!hasChanges} className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50">
              Apply Changes
            </button>
            <button type="button" onClick={handleReset} className="px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200">
              Reset
            </button>
          </div>
          {hasChanges && <p className="text-[10px] text-amber-600 text-center">You have unsaved changes</p>}
        </div>
      )}
    </div>
  );
};

export default PluginConfigPanel;
```

---

## Step 2: Update App.tsx - Add Imports

Add at the top with other imports:

```tsx
import { PluginConfigPanel, type PluginConfigOption } from './components/factory/PluginConfigPanel';
```

---

## Step 3: Update App.tsx - Extend PluginInfo Type

Add after imports, before samplePlugins:

```tsx
interface PluginInfoWithConfig extends PluginInfo {
  config?: PluginConfigOption[];
}
```

---

## Step 4: Update App.tsx - Add Config to Sample Plugins

Update `samplePlugins` array to include config arrays for each plugin:

```tsx
const samplePlugins: PluginInfoWithConfig[] = [
  {
    id: 'tts_kokoro',
    name: 'Kokoro TTS',
    // ... existing fields ...
    config: [
      { key: 'voice', label: 'Voice Model', type: 'select', value: 'af_sky', defaultValue: 'af_sky',
        options: [{ value: 'af_sky', label: 'Sky (Female)' }, { value: 'am_adam', label: 'Adam (Male)' }] },
      { key: 'speed', label: 'Speed', type: 'number', value: 1.0, defaultValue: 1.0, validation: { min: 0.5, max: 2.0 } },
    ],
  },
  {
    id: 'llm_ollama',
    name: 'Ollama LLM',
    // ... existing fields ...
    config: [
      { key: 'model', label: 'Model Name', type: 'select', value: 'llama3.2', defaultValue: 'llama3.2',
        options: [{ value: 'llama3.2', label: 'Llama 3.2' }, { value: 'mistral', label: 'Mistral' }] },
      { key: 'baseUrl', label: 'Server URL', type: 'string', value: 'http://localhost:11434', defaultValue: 'http://localhost:11434' },
      { key: 'temperature', label: 'Temperature', type: 'number', value: 0.7, defaultValue: 0.7, validation: { min: 0, max: 2 } },
    ],
  },
  // ... similar for other plugins
];
```

---

## Step 5: Update App.tsx - Add State

Add with other state declarations:

```tsx
const [selectedPluginForConfig, setSelectedPluginForConfig] = useState<PluginInfoWithConfig | null>(null);
```

---

## Step 6: Update App.tsx - Update handleBlueprintSlotClick

Replace existing handler:

```tsx
const handleBlueprintSlotClick = useCallback((slot: PluginSlot) => {
  // Find matching plugin and set for config
  const matchingPlugin = (plugins as PluginInfoWithConfig[]).find(
    p => p.contract.toUpperCase() === slot.contract.toUpperCase()
  );
  if (matchingPlugin) {
    setSelectedPluginForConfig(matchingPlugin);
    setSelectedElementIds([]); // Clear canvas selection
  }
  setActiveSidebarTab('plugins');
  setPluginCategoryFilter(slot.contract.toUpperCase());
}, [plugins]);
```

---

## Step 7: Update App.tsx - Update handlePluginSelect

Replace existing handler:

```tsx
const handlePluginSelect = useCallback((plugin: PluginInfo) => {
  setSelectedPluginId(plugin.id);
  // Also set for config panel
  const pluginWithConfig = (plugins as PluginInfoWithConfig[]).find(p => p.id === plugin.id);
  if (pluginWithConfig) {
    setSelectedPluginForConfig(pluginWithConfig);
    setSelectedElementIds([]);
  }
}, [plugins]);
```

---

## Step 8: Update App.tsx - Update handleElementSelect

Replace existing handler to clear plugin selection:

```tsx
const handleElementSelect = useCallback((ids: string[]) => {
  setSelectedElementIds(ids);
  if (ids.length > 0) {
    setSelectedPluginForConfig(null); // Clear plugin config when element selected
  }
}, []);
```

---

## Step 9: Update App.tsx - Conditional Right Sidebar

Replace rightSidebar prop in FactoryLayout:

```tsx
rightSidebar={
  <div className="h-full flex flex-col">
    {selectedPluginForConfig ? (
      <PluginConfigPanel
        plugin={{
          id: selectedPluginForConfig.id,
          name: selectedPluginForConfig.name,
          version: selectedPluginForConfig.version,
          contract: selectedPluginForConfig.contract,
          description: selectedPluginForConfig.description,
          config: selectedPluginForConfig.config || [],
        }}
        onChange={(key, value) => {
          setPlugins((prev) =>
            prev.map((p) =>
              p.id === selectedPluginForConfig?.id
                ? { ...p, config: (p as PluginInfoWithConfig).config?.map((opt) =>
                    opt.key === key ? { ...opt, value } : opt
                  )}
                : p
            )
          );
        }}
        onApply={(config) => console.log('Applied:', selectedPluginForConfig?.id, config)}
        onClose={() => setSelectedPluginForConfig(null)}
      />
    ) : (
      <>
        <div className="p-3 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-700">Properties</h2>
        </div>
        <div className="flex-1 overflow-auto">
          <PropertyInspector ... />  {/* Existing PropertyInspector code */}
        </div>
      </>
    )}
  </div>
}
```

---

## Validation Checklist

- [ ] **Wired up:** `handleBlueprintSlotClick` calls `setSelectedPluginForConfig`
- [ ] **Wired up:** `handlePluginSelect` calls `setSelectedPluginForConfig`
- [ ] **Wired up:** `handleElementSelect` clears `selectedPluginForConfig`
- [ ] **Wired up:** Right sidebar conditionally renders based on `selectedPluginForConfig`
- [ ] **No duplicates:** Only one `selectedPluginForConfig` state
- [ ] **No duplicates:** Only one `PluginConfigPanel` import
- [ ] **Complete callbacks:** `onChange` updates plugin config in state
- [ ] **Complete callbacks:** `onApply` logs applied config
- [ ] **Complete callbacks:** `onClose` clears selection
- [ ] **Complete callbacks:** `onReset` resets to defaults

---

## Testing

1. Start dev server: `npm run dev`
2. Open Blueprint panel (click Blueprint button)
3. Click a plugin slot → Config panel should appear
4. Click Apply → Console log should show
5. Click Close → Should return to Properties view
6. Click plugin in Gallery → Config panel should appear
7. Click canvas element → Should switch to Properties view
