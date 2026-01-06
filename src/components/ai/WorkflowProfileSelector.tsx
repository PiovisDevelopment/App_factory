/**
 * WorkflowProfileSelector.tsx
 * ===========================
 * Dropdown component for selecting workflow profiles (FE, BE, Full Stack, etc.)
 * 
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

import React, { useCallback } from 'react';
import { useAiTeamStore, type WorkflowProfileId } from '../../stores/aiTeamStore';

interface WorkflowProfileSelectorProps {
    className?: string;
    disabled?: boolean;
}

export const WorkflowProfileSelector: React.FC<WorkflowProfileSelectorProps> = ({
    className = '',
    disabled = false,
}) => {
    const {
        workflowProfiles,
        selectedProfileId,
        applyProfile,
        isWorkflowRunning,
    } = useAiTeamStore();

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const profileId = e.target.value as WorkflowProfileId;
        applyProfile(profileId);
    }, [applyProfile]);

    const isDisabled = disabled || isWorkflowRunning;

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <label
                htmlFor="workflow-profile"
                className="text-sm font-medium text-neutral-300 whitespace-nowrap"
            >
                Workflow:
            </label>
            <select
                id="workflow-profile"
                value={selectedProfileId}
                onChange={handleChange}
                disabled={isDisabled}
                className={`
                    flex-1 max-w-xs px-3 py-2 
                    bg-neutral-800 border border-neutral-700 
                    rounded-lg text-neutral-100 text-sm
                    focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                `}
            >
                {workflowProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name}
                    </option>
                ))}
            </select>
            {isWorkflowRunning && (
                <span className="text-xs text-yellow-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    Running...
                </span>
            )}
        </div>
    );
};

WorkflowProfileSelector.displayName = 'WorkflowProfileSelector';

export default WorkflowProfileSelector;
