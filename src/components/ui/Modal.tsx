/**
 * D014 - src/components/ui/Modal.tsx
 * ===================================
 * Atomic modal component using design tokens only.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing tokens
 *   - Fully typed props with TypeScript
 *   - Accessible by default (ARIA, focus trap, keyboard navigation)
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

/**
 * Modal size presets.
 */
const sizes = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  full: "max-w-full mx-4",
} as const;

/**
 * Modal component props.
 */
export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title (displayed in header) */
  title?: ReactNode;
  /** Modal content */
  children: ReactNode;
  /** Size preset */
  size?: keyof typeof sizes;
  /** Footer content (typically action buttons) */
  footer?: ReactNode;
  /** Whether to show close button in header */
  showCloseButton?: boolean;
  /** Whether clicking overlay closes modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Whether to center modal vertically */
  centered?: boolean;
  /** Custom className for modal content */
  className?: string;
  /** Whether modal should scroll internally */
  scrollBehavior?: "inside" | "outside";
  /** ID for accessibility */
  id?: string;
}

/**
 * Close icon for modal header.
 */
const CloseIcon = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Modal component.
 *
 * A fully accessible modal dialog with support for headers, footers,
 * focus trapping, and keyboard navigation. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={() => setIsOpen(false)}>
 *         Cancel
 *       </Button>
 *       <Button variant="primary" onClick={handleConfirm}>
 *         Confirm
 *       </Button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  centered = true,
  className = "",
  scrollBehavior = "inside",
  id,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the modal content after a short delay for animation
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus trap implementation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: If on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: If on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    []
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Don't render if not open
  if (!isOpen) return null;

  // Overlay styles
  const overlayStyles = [
    "fixed",
    "inset-0",
    "z-50",
    "bg-black/50",
    "backdrop-blur-sm",
    "flex",
    centered ? "items-center" : "items-start pt-20",
    "justify-center",
    "p-4",
    scrollBehavior === "outside" ? "overflow-y-auto" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Modal content styles
  const contentStyles = [
    "relative",
    "w-full",
    sizes[size],
    "bg-white",
    "rounded-lg",
    "shadow-xl",
    "flex",
    "flex-col",
    scrollBehavior === "inside" ? "max-h-[calc(100vh-2rem)]" : "",
    "focus:outline-none",
    "animate-in",
    "fade-in-0",
    "zoom-in-95",
    "duration-200",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Header styles
  const headerStyles = [
    "flex",
    "items-center",
    "justify-between",
    "px-6",
    "py-4",
    "border-b",
    "border-neutral-200",
    "shrink-0",
  ].join(" ");

  // Body styles
  const bodyStyles = [
    "px-6",
    "py-4",
    scrollBehavior === "inside" ? "overflow-y-auto" : "",
    "flex-1",
  ]
    .filter(Boolean)
    .join(" ");

  // Footer styles
  const footerStyles = [
    "flex",
    "items-center",
    "justify-end",
    "gap-3",
    "px-6",
    "py-4",
    "border-t",
    "border-neutral-200",
    "bg-neutral-50",
    "rounded-b-lg",
    "shrink-0",
  ].join(" ");

  // Title styles
  const titleStyles = [
    "text-lg",
    "font-semibold",
    "text-neutral-900",
  ].join(" ");

  // Close button styles
  const closeButtonStyles = [
    "inline-flex",
    "items-center",
    "justify-center",
    "p-1",
    "rounded-md",
    "text-neutral-400",
    "hover:text-neutral-600",
    "hover:bg-neutral-100",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-primary-500",
    "focus:ring-offset-2",
    "transition-colors",
    "duration-150",
  ].join(" ");

  const modalContent = (
    <div
      className={overlayStyles}
      onClick={handleOverlayClick}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id || "modal"}-title` : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={contentStyles}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={headerStyles}>
            {title && (
              <h2 id={`${id || "modal"}-title`} className={titleStyles}>
                {title}
              </h2>
            )}
            {!title && <div />}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className={closeButtonStyles}
                aria-label="Close modal"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={bodyStyles}>{children}</div>

        {/* Footer */}
        {footer && <div className={footerStyles}>{footer}</div>}
      </div>
    </div>
  );

  // Use portal to render modal at document root
  return createPortal(modalContent, document.body);
};

Modal.displayName = "Modal";

export default Modal;
