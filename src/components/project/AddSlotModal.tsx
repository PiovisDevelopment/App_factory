/**
 * D067 - src/components/project/AddSlotModal.tsx
 * ===============================================
 * Modal for adding a new component/plugin slot to a project.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D012 (Select.tsx), D014 (Modal.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Slot configuration options.
 */
export interface SlotConfig {
  name: string;
  contract: string;
  description?: string;
  position: "header" | "sidebar" | "main" | "footer" | "overlay" | "custom";
  isRequired: boolean;
  isMultiple: boolean;
  priority: number;
  defaultPluginId?: string;
  fallbackPluginId?: string;
}

/**
 * Available contract type.
 */
export interface ContractType {
  id: string;
  name: string;
  description: string;
  methods: string[];
  availablePlugins: number;
}

/**
 * AddSlotModal component props.
 */
export interface AddSlotModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when slot is created */
  onCreateSlot: (config: SlotConfig) => void;
  /** Available contract types */
  contractTypes: ContractType[];
  /** Existing slot names (for validation) */
  existingSlotNames?: string[];
  /** Default position */
  defaultPosition?: SlotConfig["position"];
  /** Default priority */
  defaultPriority?: number;
}

/**
 * Close icon.
 */
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Check icon.
 */
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Info icon.
 */
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Alert icon.
 */
const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/**
 * Contract type icons.
 */
const ContractIcons: Record<string, React.FC<{ className?: string }>> = {
  tts: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  stt: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  llm: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  mcp: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  default: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
};

/**
 * Position labels and descriptions.
 */
const positionOptions = [
  { value: "header", label: "Header", description: "Top of the screen" },
  { value: "sidebar", label: "Sidebar", description: "Side panel area" },
  { value: "main", label: "Main", description: "Primary content area" },
  { value: "footer", label: "Footer", description: "Bottom of the screen" },
  { value: "overlay", label: "Overlay", description: "Floating over content" },
  { value: "custom", label: "Custom", description: "Custom positioning" },
] as const;

/**
 * Contract colors.
 */
const contractColors: Record<string, string> = {
  tts: "border-primary-200 bg-primary-50 text-primary-700",
  stt: "border-success-200 bg-success-50 text-success-700",
  llm: "border-warning-200 bg-warning-50 text-warning-700",
  mcp: "border-info-200 bg-info-50 text-info-700",
  default: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

/**
 * AddSlotModal component.
 *
 * Modal dialog for creating a new plugin slot with configuration options.
 *
 * @example
 * ```tsx
 * <AddSlotModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCreateSlot={(config) => createSlot(config)}
 *   contractTypes={availableContracts}
 *   existingSlotNames={currentSlotNames}
 * />
 * ```
 */
export const AddSlotModal: React.FC<AddSlotModalProps> = ({
  isOpen,
  onClose,
  onCreateSlot,
  contractTypes,
  existingSlotNames = [],
  defaultPosition = "main",
  defaultPriority = 0,
}) => {
  // Form state
  const [name, setName] = useState("");
  const [contract, setContract] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState<SlotConfig["position"]>(defaultPosition);
  const [isRequired, setIsRequired] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [priority, setPriority] = useState(defaultPriority);

  // Current step (0: contract, 1: details)
  const [step, setStep] = useState(0);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setContract("");
      setDescription("");
      setPosition(defaultPosition);
      setIsRequired(false);
      setIsMultiple(false);
      setPriority(defaultPriority);
      setStep(0);
      setErrors({});
    }
  }, [isOpen, defaultPosition, defaultPriority]);

  // Selected contract type
  const selectedContract = useMemo(
    () => contractTypes.find((c) => c.id === contract),
    [contractTypes, contract]
  );

  // Validate name
  const validateName = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return "Name is required";
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
        return "Name must start with a letter and contain only letters, numbers, and underscores";
      }
      if (existingSlotNames.includes(value)) {
        return "A slot with this name already exists";
      }
      return "";
    },
    [existingSlotNames]
  );

  // Handle name change
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      const error = validateName(value);
      setErrors((prev) => ({ ...prev, name: error }));
    },
    [validateName]
  );

  // Handle contract selection
  const handleContractSelect = useCallback((contractId: string) => {
    setContract(contractId);
    setStep(1);
  }, []);

  // Handle create
  const handleCreate = useCallback(() => {
    // Validate
    const nameError = validateName(name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    // Create slot config
    const config: SlotConfig = {
      name,
      contract,
      description: description || undefined,
      position,
      isRequired,
      isMultiple,
      priority,
    };

    onCreateSlot(config);
    onClose();
  }, [name, contract, description, position, isRequired, isMultiple, priority, validateName, onCreateSlot, onClose]);

  // Handle back
  const handleBack = useCallback(() => {
    setStep(0);
    setContract("");
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={[
        "fixed",
        "inset-0",
        "z-modal",
        "flex",
        "items-center",
        "justify-center",
        "p-4",
        "bg-black/50",
        "backdrop-blur-sm",
      ].join(" ")}
      onClick={handleClose}
    >
      <div
        className={[
          "w-full",
          "max-w-lg",
          "bg-white",
          "rounded-lg",
          "shadow-xl",
          "overflow-hidden",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Add Plugin Slot
            </h2>
            <p className="text-sm text-neutral-500">
              {step === 0 ? "Select a contract type" : "Configure slot details"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={[
              "p-1",
              "rounded-md",
              "text-neutral-400",
              "hover:text-neutral-600",
              "hover:bg-neutral-100",
              "transition-colors",
              "duration-150",
            ].join(" ")}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 0 ? (
            /* Step 1: Contract selection */
            <div className="space-y-3">
              {contractTypes.length === 0 ? (
                <div className="text-center py-8">
                  <InfoIcon className="mx-auto h-12 w-12 text-neutral-300" />
                  <p className="mt-2 text-sm text-neutral-500">
                    No contract types available
                  </p>
                </div>
              ) : (
                contractTypes.map((ct) => {
                  const Icon = ContractIcons[ct.id] || ContractIcons.default;
                  const colors = contractColors[ct.id] || contractColors.default;

                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => handleContractSelect(ct.id)}
                      className={[
                        "w-full",
                        "flex",
                        "items-start",
                        "gap-4",
                        "p-4",
                        "rounded-lg",
                        "border-2",
                        "text-left",
                        "transition-all",
                        "duration-150",
                        "hover:shadow-md",
                        contract === ct.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-neutral-200 hover:border-neutral-300",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "flex",
                          "items-center",
                          "justify-center",
                          "h-12",
                          "w-12",
                          "rounded-lg",
                          "border",
                          colors,
                        ].join(" ")}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-neutral-900">
                          {ct.name}
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {ct.description}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                          <span>{ct.methods.length} methods</span>
                          <span>{ct.availablePlugins} plugins available</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* Step 2: Details configuration */
            <div className="space-y-4">
              {/* Selected contract badge */}
              {selectedContract && (
                <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                  {(() => {
                    const Icon = ContractIcons[selectedContract.id] || ContractIcons.default;
                    return <Icon className="h-5 w-5 text-neutral-500" />;
                  })()}
                  <span className="text-sm font-medium text-neutral-700">
                    {selectedContract.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="ml-auto text-xs text-primary-600 hover:text-primary-700"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Name input */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Slot Name <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="my_slot_name"
                  className={[
                    "w-full",
                    "px-3",
                    "py-2",
                    "text-sm",
                    "bg-white",
                    "border",
                    errors.name ? "border-error-500" : "border-neutral-300",
                    "rounded-md",
                    "focus:outline-none",
                    "focus:ring-2",
                    errors.name ? "focus:ring-error-500" : "focus:ring-primary-500",
                  ].join(" ")}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-error-600 flex items-center gap-1">
                    <AlertIcon className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this slot's purpose"
                  rows={2}
                  className={[
                    "w-full",
                    "px-3",
                    "py-2",
                    "text-sm",
                    "bg-white",
                    "border",
                    "border-neutral-300",
                    "rounded-md",
                    "focus:outline-none",
                    "focus:ring-2",
                    "focus:ring-primary-500",
                  ].join(" ")}
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Position
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {positionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPosition(opt.value)}
                      className={[
                        "px-3",
                        "py-2",
                        "text-sm",
                        "rounded-md",
                        "border",
                        "transition-colors",
                        "duration-150",
                        position === opt.value
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-300",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                  min={0}
                  max={100}
                  className={[
                    "w-24",
                    "px-3",
                    "py-2",
                    "text-sm",
                    "bg-white",
                    "border",
                    "border-neutral-300",
                    "rounded-md",
                    "focus:outline-none",
                    "focus:ring-2",
                    "focus:ring-primary-500",
                  ].join(" ")}
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Lower numbers = higher priority (rendered first)
                </p>
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">Required</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMultiple}
                    onChange={(e) => setIsMultiple(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">Allow Multiple</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          {step === 0 ? (
            <button
              type="button"
              onClick={handleClose}
              className={[
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-neutral-700",
                "bg-white",
                "border",
                "border-neutral-300",
                "rounded-md",
                "hover:bg-neutral-50",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBack}
                className={[
                  "px-4",
                  "py-2",
                  "text-sm",
                  "font-medium",
                  "text-neutral-700",
                  "bg-white",
                  "border",
                  "border-neutral-300",
                  "rounded-md",
                  "hover:bg-neutral-50",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || !!errors.name}
                className={[
                  "inline-flex",
                  "items-center",
                  "gap-2",
                  "px-4",
                  "py-2",
                  "text-sm",
                  "font-medium",
                  "text-white",
                  "bg-primary-600",
                  "rounded-md",
                  "hover:bg-primary-700",
                  "disabled:opacity-50",
                  "disabled:cursor-not-allowed",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
              >
                <CheckIcon className="h-4 w-4" />
                Create Slot
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

AddSlotModal.displayName = "AddSlotModal";

export default AddSlotModal;
