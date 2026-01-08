/**
 * D074 - src/components/gallery/GalleryManager.tsx
 * =================================================
 * Gallery CRUD management interface for plugins and components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D012, D014, D015
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Panel } from "../ui/Panel";
import { Modal } from "../ui/Modal";

/**
 * Gallery item status.
 */
export type GalleryItemStatus = "active" | "draft" | "archived" | "deprecated";

/**
 * Gallery item type.
 */
export type GalleryItemType = "plugin" | "component" | "template" | "contract";

/**
 * Gallery item structure.
 */
export interface GalleryItem {
  /** Unique item identifier */
  id: string;
  /** Item name */
  name: string;
  /** Item description */
  description: string;
  /** Item type */
  type: GalleryItemType;
  /** Item status */
  status: GalleryItemStatus;
  /** Category/tag */
  category: string;
  /** Version string */
  version: string;
  /** Author/creator */
  author: string;
  /** Creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
  /** Thumbnail/preview image URL */
  thumbnail?: string;
  /** Tags for search */
  tags: string[];
  /** Download/install count */
  downloads?: number;
  /** Rating (0-5) */
  rating?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Gallery manager props.
 */
export interface GalleryManagerProps {
  /** Array of gallery items */
  items: GalleryItem[];
  /** Callback when item is created */
  onCreate?: (item: Omit<GalleryItem, "id" | "createdAt" | "updatedAt">) => Promise<GalleryItem>;
  /** Callback when item is updated */
  onUpdate?: (id: string, updates: Partial<GalleryItem>) => Promise<GalleryItem>;
  /** Callback when item is deleted */
  onDelete?: (id: string) => Promise<void>;
  /** Callback when item is selected */
  onSelect?: (item: GalleryItem) => void;
  /** Callback when item is installed/added */
  onInstall?: (item: GalleryItem) => Promise<void>;
  /** Callback for batch install of multiple items */
  onBatchInstall?: (items: GalleryItem[]) => Promise<void>;
  /** Callback for batch uninstall of multiple items */
  onBatchUninstall?: (items: GalleryItem[]) => Promise<void>;
  /** Callback when import is requested */
  onImport?: () => void;
  /** Available categories */
  categories?: SelectOption[];
  /** Whether in read-only mode */
  readOnly?: boolean;
  /** Whether multi-select mode is enabled */
  multiSelect?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Default categories.
 */
const defaultCategories: SelectOption[] = [
  { value: "all", label: "All Categories" },
  { value: "tts", label: "Text-to-Speech" },
  { value: "stt", label: "Speech-to-Text" },
  { value: "llm", label: "Language Models" },
  { value: "vision", label: "Computer Vision" },
  { value: "audio", label: "Audio Processing" },
  { value: "ui", label: "UI Components" },
  { value: "utility", label: "Utilities" },
];

/**
 * Status options.
 */
const statusOptions: SelectOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
  { value: "deprecated", label: "Deprecated" },
];

/**
 * Type options.
 */
const typeOptions: SelectOption[] = [
  { value: "all", label: "All Types" },
  { value: "plugin", label: "Plugins" },
  { value: "component", label: "Components" },
  { value: "template", label: "Templates" },
  { value: "contract", label: "Contracts" },
];

/**
 * Sort options.
 */
const sortOptions: SelectOption[] = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "updated-desc", label: "Recently Updated" },
  { value: "updated-asc", label: "Oldest Updated" },
  { value: "downloads-desc", label: "Most Downloads" },
  { value: "rating-desc", label: "Highest Rated" },
];

/**
 * Search icon.
 */
const SearchIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/**
 * Plus icon.
 */
const PlusIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Edit icon.
 */
const EditIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/**
 * Trash icon.
 */
const TrashIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/**
 * Download icon.
 */
const DownloadIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/**
 * Grid icon.
 */
const GridIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

/**
 * List icon.
 */
const ListIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * Import/Upload icon.
 */
const ImportIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/**
 * Checkbox unchecked icon.
 */
const CheckboxIcon: React.FC<{ checked: boolean }> = ({ checked }) => (
  <div
    className={[
      "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
      checked
        ? "bg-primary-500 border-primary-500 text-white"
        : "bg-white border-neutral-300 hover:border-primary-400",
    ].join(" ")}
  >
    {checked && (
      <svg
        className="h-3 w-3"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </div>
);

/**
 * Star icon for ratings.
 */
const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    className={`h-4 w-4 ${filled ? "text-warning-500 fill-warning-500" : "text-neutral-300"}`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/**
 * Rating display component.
 */
const RatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <StarIcon key={star} filled={star <= rating} />
    ))}
  </div>
);

/**
 * Status badge component.
 */
const StatusBadge: React.FC<{ status: GalleryItemStatus }> = ({ status }) => {
  const styles = {
    active: "bg-success-100 text-success-700 border-success-200",
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
    archived: "bg-neutral-100 text-neutral-500 border-neutral-200",
    deprecated: "bg-warning-100 text-warning-700 border-warning-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

/**
 * Type badge component.
 */
const TypeBadge: React.FC<{ type: GalleryItemType }> = ({ type }) => {
  const styles = {
    plugin: "bg-primary-100 text-primary-700",
    component: "bg-info-100 text-info-700",
    template: "bg-success-100 text-success-700",
    contract: "bg-warning-100 text-warning-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type]}`}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
};

/**
 * Gallery item card component (grid view).
 */
const ItemCard: React.FC<{
  item: GalleryItem;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onInstall?: () => void;
  readOnly?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showCheckbox?: boolean;
}> = ({ item, onSelect, onEdit, onDelete, onInstall, readOnly, isSelected, onToggleSelect, showCheckbox }) => {
  return (
    <div
      className={[
        "group",
        "bg-white",
        "border",
        "rounded-lg",
        "overflow-hidden",
        "hover:shadow-md",
        "transition-all",
        "duration-200",
        isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-neutral-200 hover:border-primary-300",
        onSelect ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-neutral-100 relative">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
            <GridIcon />
          </div>
        )}
        {/* Checkbox for multi-select */}
        {showCheckbox && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            <CheckboxIcon checked={isSelected || false} />
          </div>
        )}
        <div className={["absolute top-2 flex gap-1", showCheckbox ? "left-9" : "left-2"].join(" ")}>
          <TypeBadge type={item.type} />
        </div>
        <div className="absolute top-2 right-2">
          <StatusBadge status={item.status} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-neutral-900 truncate">
          {item.name}
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">v{item.version}</p>
        <p className="text-sm text-neutral-600 mt-2 line-clamp-2">
          {item.description}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-xs text-neutral-400">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            {item.downloads !== undefined && (
              <span className="flex items-center gap-1">
                <DownloadIcon />
                {item.downloads.toLocaleString()}
              </span>
            )}
            {item.rating !== undefined && <RatingDisplay rating={item.rating} />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {onInstall && (
            <Button
              variant="primary"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onInstall();
              }}
              leftIcon={<DownloadIcon />}
            >
              Install
            </Button>
          )}
          {!readOnly && onEdit && (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              iconOnly
              aria-label="Edit"
            >
              <EditIcon />
            </Button>
          )}
          {!readOnly && onDelete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              iconOnly
              aria-label="Delete"
              className="text-error-500 hover:text-error-600"
            >
              <TrashIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Gallery item row component (list view).
 */
const ItemRow: React.FC<{
  item: GalleryItem;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onInstall?: () => void;
  readOnly?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showCheckbox?: boolean;
}> = ({ item, onSelect, onEdit, onDelete, onInstall, readOnly, isSelected, onToggleSelect, showCheckbox }) => {
  return (
    <div
      className={[
        "flex",
        "items-center",
        "gap-4",
        "p-4",
        "bg-white",
        "border",
        "rounded-lg",
        "hover:bg-neutral-50",
        "transition-all",
        "duration-200",
        isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-neutral-200 hover:border-primary-300",
        onSelect ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={onSelect}
    >
      {/* Checkbox for multi-select */}
      {showCheckbox && (
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
        >
          <CheckboxIcon checked={isSelected || false} />
        </div>
      )}

      {/* Thumbnail */}
      <div className="w-16 h-16 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <GridIcon />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 truncate">
            {item.name}
          </h3>
          <TypeBadge type={item.type} />
          <StatusBadge status={item.status} />
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          v{item.version} by {item.author}
        </p>
        <p className="text-sm text-neutral-600 mt-1 line-clamp-1">
          {item.description}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0">
        {item.downloads !== undefined && (
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <DownloadIcon />
            {item.downloads.toLocaleString()}
          </span>
        )}
        {item.rating !== undefined && <RatingDisplay rating={item.rating} />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onInstall && (
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onInstall();
            }}
            leftIcon={<DownloadIcon />}
          >
            Install
          </Button>
        )}
        {!readOnly && onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            iconOnly
            aria-label="Edit"
          >
            <EditIcon />
          </Button>
        )}
        {!readOnly && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            iconOnly
            aria-label="Delete"
            className="text-error-500 hover:text-error-600"
          >
            <TrashIcon />
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Item form modal for create/edit.
 */
const ItemFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  item?: GalleryItem;
  onSave: (data: Partial<GalleryItem>) => void;
  categories: SelectOption[];
  isLoading?: boolean;
}> = ({ isOpen, onClose, item, onSave, categories, isLoading }) => {
  const [formData, setFormData] = useState<Partial<GalleryItem>>(
    item || {
      name: "",
      description: "",
      type: "plugin",
      status: "draft",
      category: "",
      version: "1.0.0",
      author: "",
      tags: [],
    }
  );
  const [tagInput, setTagInput] = useState("");

  const handleSave = () => {
    onSave(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit Item" : "Create New Item"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={!!isLoading}
            disabled={!formData.name?.trim()}
          >
            {item ? "Save Changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={formData.name || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="My Plugin"
          fullWidth
          isRequired
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            options={typeOptions.filter((o) => o.value !== "all")}
            value={formData.type || "plugin"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, type: e.target.value as GalleryItemType }))
            }
            fullWidth
          />
          <Select
            label="Status"
            options={statusOptions.filter((o) => o.value !== "all")}
            value={formData.status || "draft"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, status: e.target.value as GalleryItemStatus }))
            }
            fullWidth
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            options={categories.filter((o) => o.value !== "all")}
            value={formData.category || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            fullWidth
          />
          <Input
            label="Version"
            value={formData.version || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, version: e.target.value }))}
            placeholder="1.0.0"
            fullWidth
          />
        </div>

        <Input
          label="Author"
          value={formData.author || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
          placeholder="Your Name"
          fullWidth
        />

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe your item..."
            rows={3}
            className={[
              "w-full",
              "px-4",
              "py-2",
              "text-base",
              "text-neutral-900",
              "placeholder:text-neutral-400",
              "border",
              "border-neutral-300",
              "rounded-md",
              "focus:outline-none",
              "focus:ring-2",
              "focus:ring-primary-500",
              "focus:border-primary-500",
              "resize-none",
            ].join(" ")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Tags
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              fullWidth
            />
            <Button variant="secondary" onClick={addTag}>
              Add
            </Button>
          </div>
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 text-neutral-700 text-sm rounded"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

/**
 * GalleryManager component.
 *
 * A comprehensive gallery management interface for plugins, components,
 * templates, and contracts with CRUD operations, filtering, and search.
 *
 * @example
 * ```tsx
 * <GalleryManager
 *   items={galleryItems}
 *   onCreate={async (item) => {
 *     return await api.createItem(item);
 *   }}
 *   onUpdate={async (id, updates) => {
 *     return await api.updateItem(id, updates);
 *   }}
 *   onDelete={async (id) => {
 *     await api.deleteItem(id);
 *   }}
 *   onSelect={(item) => openItemDetails(item)}
 * />
 * ```
 */
export const GalleryManager: React.FC<GalleryManagerProps> = ({
  items,
  onCreate,
  onUpdate,
  onDelete,
  onSelect,
  onInstall,
  onBatchInstall,
  onBatchUninstall,
  onImport,
  categories = defaultCategories,
  readOnly = false,
  multiSelect = false,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | undefined>();
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GalleryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggle item selection
  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Select all visible items
  const handleSelectAll = useCallback(() => {
    const allIds = items.map((item) => item.id);
    setSelectedIds(new Set(allIds));
  }, [items]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  // Batch install handler
  const handleBatchInstall = useCallback(async () => {
    if (selectedItems.length === 0 || !onBatchInstall) return;
    setIsLoading(true);
    try {
      await onBatchInstall(selectedItems);
      setSelectedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedItems, onBatchInstall]);

  // Batch uninstall handler
  const handleBatchUninstall = useCallback(async () => {
    if (selectedItems.length === 0 || !onBatchUninstall) return;
    setIsLoading(true);
    try {
      await onBatchUninstall(selectedItems);
      setSelectedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedItems, onBatchUninstall]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((item) => item.category === selectedCategory);
    }

    // Type filter
    if (selectedType !== "all") {
      result = result.filter((item) => item.type === selectedType);
    }

    // Status filter
    if (selectedStatus !== "all") {
      result = result.filter((item) => item.status === selectedStatus);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "updated-desc":
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case "updated-asc":
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        case "downloads-desc":
          return (b.downloads || 0) - (a.downloads || 0);
        case "rating-desc":
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, selectedCategory, selectedType, selectedStatus, sortBy]);

  const handleCreate = useCallback(async () => {
    setEditingItem(undefined);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((item: GalleryItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: Partial<GalleryItem>) => {
      setIsLoading(true);
      try {
        if (editingItem && onUpdate) {
          await onUpdate(editingItem.id, data);
        } else if (onCreate) {
          await onCreate(data as Omit<GalleryItem, "id" | "createdAt" | "updatedAt">);
        }
        setIsFormOpen(false);
        setEditingItem(undefined);
      } finally {
        setIsLoading(false);
      }
    },
    [editingItem, onCreate, onUpdate]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmItem || !onDelete) return;
    setIsLoading(true);
    try {
      await onDelete(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    } finally {
      setIsLoading(false);
    }
  }, [deleteConfirmItem, onDelete]);

  const containerStyles = ["space-y-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerStyles}>
      {/* Header/Toolbar */}
      <Panel variant="default" padding="md" radius="lg">
        <div className="space-y-4">
          {/* Search and actions row */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search gallery..."
                leftElement={<SearchIcon />}
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                iconOnly
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <GridIcon />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                iconOnly
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <ListIcon />
              </Button>
              {onImport && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onImport}
                  leftIcon={<ImportIcon />}
                >
                  Import
                </Button>
              )}
              {!readOnly && onCreate && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  leftIcon={<PlusIcon />}
                >
                  Add New
                </Button>
              )}
            </div>
          </div>

          {/* Batch actions toolbar - shown when items are selected */}
          {multiSelect && selectedIds.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary-700">
                  {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleClearSelection}
                  className="text-primary-600"
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleSelectAll}
                  className="text-primary-600"
                >
                  Select All
                </Button>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {onBatchInstall && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleBatchInstall}
                    loading={isLoading}
                    leftIcon={<DownloadIcon />}
                  >
                    Install ({selectedIds.size})
                  </Button>
                )}
                {onBatchUninstall && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBatchUninstall}
                    loading={isLoading}
                  >
                    Uninstall ({selectedIds.size})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="flex items-center gap-4">
            <Select
              options={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              size="sm"
            />
            <Select
              options={typeOptions}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              size="sm"
            />
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              size="sm"
            />
            <div className="flex-1" />
            <Select
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              size="sm"
            />
          </div>
        </div>
      </Panel>

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Showing {filteredItems.length} of {items.length} items
        </span>
      </div>

      {/* Items grid/list */}
      {filteredItems.length === 0 ? (
        <Panel variant="default" padding="lg" radius="lg">
          <div className="text-center py-12">
            <div className="text-neutral-400 mb-2">
              <GridIcon />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">No items found</h3>
            <p className="text-sm text-neutral-500 mt-1">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Get started by adding your first item"}
            </p>
            {!readOnly && onCreate && !searchQuery && (
              <Button
                variant="primary"
                size="md"
                onClick={handleCreate}
                leftIcon={<PlusIcon />}
                className="mt-4"
              >
                Add First Item
              </Button>
            )}
          </div>
        </Panel>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              {...(onSelect ? { onSelect: () => onSelect(item) } : {})}
              {...(onUpdate ? { onEdit: () => handleEdit(item) } : {})}
              {...(onDelete ? { onDelete: () => setDeleteConfirmItem(item) } : {})}
              {...(onInstall ? { onInstall: () => onInstall(item) } : {})}
              readOnly={readOnly}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleSelect(item.id)}
              showCheckbox={multiSelect}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              {...(onSelect ? { onSelect: () => onSelect(item) } : {})}
              {...(onUpdate ? { onEdit: () => handleEdit(item) } : {})}
              {...(onDelete ? { onDelete: () => setDeleteConfirmItem(item) } : {})}
              {...(onInstall ? { onInstall: () => onInstall(item) } : {})}
              readOnly={readOnly}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleSelect(item.id)}
              showCheckbox={multiSelect}
            />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <ItemFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(undefined);
        }}
        {...(editingItem ? { item: editingItem } : {})}
        onSave={handleSave}
        categories={categories}
        isLoading={isLoading}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteConfirmItem}
        onClose={() => setDeleteConfirmItem(null)}
        title="Delete Item"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={isLoading}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-neutral-700">
          Are you sure you want to delete <strong>{deleteConfirmItem?.name}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

GalleryManager.displayName = "GalleryManager";

export default GalleryManager;
