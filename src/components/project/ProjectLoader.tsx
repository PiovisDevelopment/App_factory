/**
 * D063 - src/components/project/ProjectLoader.tsx
 * ================================================
 * Component for loading and managing existing projects.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D014 (Panel.tsx), D015 (Modal.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Project metadata structure.
 */
export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  description?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  plugins: ProjectPluginInfo[];
  screens: ProjectScreenInfo[];
  thumbnail?: string;
  status: "ready" | "loading" | "error" | "outdated";
}

/**
 * Plugin info within a project.
 */
export interface ProjectPluginInfo {
  id: string;
  name: string;
  contract: string;
  version: string;
  enabled: boolean;
}

/**
 * Screen info within a project.
 */
export interface ProjectScreenInfo {
  id: string;
  name: string;
  route: string;
  componentCount: number;
}

/**
 * ProjectLoader component props.
 */
export interface ProjectLoaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Available projects */
  projects: ProjectInfo[];
  /** Currently selected project ID */
  selectedProjectId?: string;
  /** Callback when project is selected */
  onSelectProject?: (project: ProjectInfo) => void;
  /** Callback when project is opened */
  onOpenProject?: (project: ProjectInfo) => void;
  /** Callback when project is deleted */
  onDeleteProject?: (project: ProjectInfo) => void;
  /** Callback when browse for project is clicked */
  onBrowseProject?: () => void;
  /** Callback when new project is requested */
  onNewProject?: () => void;
  /** Whether loading projects */
  isLoading?: boolean;
  /** Loading error message */
  errorMessage?: string;
}

/**
 * Folder icon.
 */
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Plus icon.
 */
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Folder open icon.
 */
const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1" />
    <path d="M5 12h14l-2 7H7l-2-7z" />
  </svg>
);

/**
 * Trash icon.
 */
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

/**
 * External link icon.
 */
const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/**
 * Clock icon.
 */
const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Alert circle icon.
 */
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/**
 * Status badge colors.
 */
const statusColors: Record<ProjectInfo["status"], string> = {
  ready: "bg-success-50 text-success-700 border-success-200",
  loading: "bg-warning-50 text-warning-700 border-warning-200",
  error: "bg-error-50 text-error-700 border-error-200",
  outdated: "bg-info-50 text-info-700 border-info-200",
};

/**
 * Status labels.
 */
const statusLabels: Record<ProjectInfo["status"], string> = {
  ready: "Ready",
  loading: "Loading",
  error: "Error",
  outdated: "Outdated",
};

/**
 * Format date for display.
 */
const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
    }
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
};

/**
 * ProjectLoader component.
 *
 * Displays a list of available projects with options to load, create,
 * or browse for existing projects.
 *
 * @example
 * ```tsx
 * <ProjectLoader
 *   projects={availableProjects}
 *   selectedProjectId={selectedId}
 *   onSelectProject={(project) => setSelectedId(project.id)}
 *   onOpenProject={(project) => loadProject(project)}
 *   onNewProject={() => showNewProjectWizard()}
 *   onBrowseProject={() => openFilePicker()}
 * />
 * ```
 */
export const ProjectLoader: React.FC<ProjectLoaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenProject,
  onDeleteProject,
  onBrowseProject,
  onNewProject,
  isLoading = false,
  errorMessage,
  className = "",
  ...props
}) => {
  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Sort by updated date (most recent first)
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }, [filteredProjects]);

  // Handle project selection
  const handleSelect = useCallback(
    (project: ProjectInfo) => {
      onSelectProject?.(project);
    },
    [onSelectProject]
  );

  // Handle project open
  const handleOpen = useCallback(
    (project: ProjectInfo) => {
      if (project.status !== "error") {
        onOpenProject?.(project);
      }
    },
    [onOpenProject]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(
    (project: ProjectInfo) => {
      onDeleteProject?.(project);
      setDeleteConfirmId(null);
    },
    [onDeleteProject]
  );

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "h-full",
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "overflow-hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Projects</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBrowseProject}
              className={[
                "inline-flex",
                "items-center",
                "gap-1.5",
                "px-3",
                "py-1.5",
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
              <FolderOpenIcon className="h-4 w-4" />
              Browse
            </button>
            <button
              type="button"
              onClick={onNewProject}
              className={[
                "inline-flex",
                "items-center",
                "gap-1.5",
                "px-3",
                "py-1.5",
                "text-sm",
                "font-medium",
                "text-white",
                "bg-primary-600",
                "rounded-md",
                "hover:bg-primary-700",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              <PlusIcon className="h-4 w-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className={[
              "w-full",
              "pl-10",
              "pr-4",
              "py-2",
              "text-sm",
              "bg-white",
              "border",
              "border-neutral-300",
              "rounded-md",
              "focus:outline-none",
              "focus:ring-2",
              "focus:ring-primary-500",
              "focus:border-primary-500",
            ].join(" ")}
          />
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-4 bg-error-50 border-b border-error-200">
          <div className="flex items-center gap-2 text-error-700">
            <AlertCircleIcon className="h-5 w-5 shrink-0" />
            <p className="text-sm">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FolderIcon className="h-16 w-16 text-neutral-300 mb-4" />
            <p className="text-sm text-neutral-500 mb-4">
              {searchQuery
                ? "No projects match your search"
                : "No projects yet. Create a new project or browse for an existing one."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onNewProject}
                className={[
                  "inline-flex",
                  "items-center",
                  "gap-1.5",
                  "px-4",
                  "py-2",
                  "text-sm",
                  "font-medium",
                  "text-white",
                  "bg-primary-600",
                  "rounded-md",
                  "hover:bg-primary-700",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
              >
                <PlusIcon className="h-4 w-4" />
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {sortedProjects.map((project) => (
              <li key={project.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(project)}
                  onDoubleClick={() => handleOpen(project)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOpen(project);
                    if (e.key === " ") handleSelect(project);
                  }}
                  className={[
                    "p-4",
                    "cursor-pointer",
                    "transition-colors",
                    "duration-150",
                    selectedProjectId === project.id
                      ? "bg-primary-50"
                      : "hover:bg-neutral-50",
                    "focus:outline-none",
                    "focus:bg-primary-50",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail or folder icon */}
                    <div
                      className={[
                        "flex",
                        "items-center",
                        "justify-center",
                        "h-12",
                        "w-12",
                        "rounded-lg",
                        "bg-neutral-100",
                        "shrink-0",
                      ].join(" ")}
                    >
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <FolderIcon className="h-6 w-6 text-neutral-400" />
                      )}
                    </div>

                    {/* Project info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-neutral-900 truncate">
                          {project.name}
                        </h3>
                        <span
                          className={[
                            "px-1.5",
                            "py-0.5",
                            "text-xs",
                            "font-medium",
                            "rounded",
                            "border",
                            statusColors[project.status],
                          ].join(" ")}
                        >
                          {statusLabels[project.status]}
                        </span>
                      </div>

                      {project.description && (
                        <p className="mt-0.5 text-xs text-neutral-500 truncate">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          {formatDate(project.updatedAt)}
                        </span>
                        <span>v{project.version}</span>
                        <span>{project.plugins.length} plugins</span>
                        <span>{project.screens.length} screens</span>
                      </div>

                      <p className="mt-1 text-xs text-neutral-400 truncate font-mono">
                        {project.path}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpen(project);
                        }}
                        disabled={project.status === "error"}
                        className={[
                          "p-2",
                          "rounded-md",
                          "text-neutral-400",
                          "hover:text-primary-600",
                          "hover:bg-primary-50",
                          "disabled:opacity-50",
                          "disabled:cursor-not-allowed",
                          "transition-colors",
                          "duration-150",
                        ].join(" ")}
                        title="Open project"
                      >
                        <ExternalLinkIcon className="h-4 w-4" />
                      </button>

                      {deleteConfirmId === project.id ? (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConfirm(project);
                            }}
                            className={[
                              "px-2",
                              "py-1",
                              "text-xs",
                              "font-medium",
                              "text-white",
                              "bg-error-600",
                              "rounded",
                              "hover:bg-error-700",
                              "transition-colors",
                              "duration-150",
                            ].join(" ")}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className={[
                              "px-2",
                              "py-1",
                              "text-xs",
                              "font-medium",
                              "text-neutral-600",
                              "bg-neutral-100",
                              "rounded",
                              "hover:bg-neutral-200",
                              "transition-colors",
                              "duration-150",
                            ].join(" ")}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(project.id);
                          }}
                          className={[
                            "p-2",
                            "rounded-md",
                            "text-neutral-400",
                            "hover:text-error-600",
                            "hover:bg-error-50",
                            "transition-colors",
                            "duration-150",
                          ].join(" ")}
                          title="Delete project"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer with stats */}
      {projects.length > 0 && (
        <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          {filteredProjects.length === projects.length
            ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
            : `${filteredProjects.length} of ${projects.length} projects`}
        </div>
      )}
    </div>
  );
};

ProjectLoader.displayName = "ProjectLoader";

export default ProjectLoader;
