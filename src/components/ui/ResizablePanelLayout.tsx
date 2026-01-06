/**
 * ResizablePanelLayout.tsx
 * ========================
 * A reusable three-panel layout with draggable dividers.
 * 
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * 
 * Features:
 * - Initial split: 25% | 50% | 25%
 * - Min/max constraints to prevent over-shrinking
 * - Mouse drag events for resize
 * - Full height layout for modal content
 */

import React, { useState, useRef, useCallback, type ReactNode } from 'react';

interface PanelConfig {
    minWidth: number;  // Minimum width in pixels
    initialPercent: number;  // Initial width as percentage
}

interface ResizablePanelLayoutProps {
    leftPanel: ReactNode;
    centerPanel: ReactNode;
    rightPanel: ReactNode;
    leftConfig?: Partial<PanelConfig>;
    rightConfig?: Partial<PanelConfig>;
    className?: string;
}

const DEFAULT_LEFT_CONFIG: PanelConfig = {
    minWidth: 200,
    initialPercent: 25,
};

const DEFAULT_RIGHT_CONFIG: PanelConfig = {
    minWidth: 250,
    initialPercent: 25,
};

/**
 * Divider component for dragging between panels.
 */
const Divider: React.FC<{
    onMouseDown: (e: React.MouseEvent) => void;
    isActive: boolean;
}> = ({ onMouseDown, isActive }) => (
    <div
        className={`
            w-1 cursor-col-resize transition-colors duration-150
            ${isActive ? 'bg-primary-500' : 'bg-neutral-700 hover:bg-neutral-600'}
            flex-shrink-0
        `}
        onMouseDown={onMouseDown}
    >
        {/* Visual grip indicator */}
        <div className="h-full w-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-neutral-500 rounded-full opacity-50" />
        </div>
    </div>
);

export const ResizablePanelLayout: React.FC<ResizablePanelLayoutProps> = ({
    leftPanel,
    centerPanel,
    rightPanel,
    leftConfig = {},
    rightConfig = {},
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const mergedLeftConfig = { ...DEFAULT_LEFT_CONFIG, ...leftConfig };
    const mergedRightConfig = { ...DEFAULT_RIGHT_CONFIG, ...rightConfig };

    // Panel widths as percentages
    const [leftPercent, setLeftPercent] = useState(mergedLeftConfig.initialPercent);
    const [rightPercent, setRightPercent] = useState(mergedRightConfig.initialPercent);

    // Track which divider is being dragged
    const [activeDivider, setActiveDivider] = useState<'left' | 'right' | null>(null);

    // Handle mouse down on left divider
    const handleLeftDividerMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setActiveDivider('left');
    }, []);

    // Handle mouse down on right divider
    const handleRightDividerMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setActiveDivider('right');
    }, []);

    // Handle mouse move for resizing
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!activeDivider || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = e.clientX - containerRect.left;
        const mousePercent = (mouseX / containerWidth) * 100;

        if (activeDivider === 'left') {
            // Constrain left panel
            const minPercent = (mergedLeftConfig.minWidth / containerWidth) * 100;
            const maxPercent = 100 - rightPercent - 20; // Leave at least 20% for center
            const newPercent = Math.max(minPercent, Math.min(maxPercent, mousePercent));
            setLeftPercent(newPercent);
        } else if (activeDivider === 'right') {
            // Constrain right panel
            const minPercent = (mergedRightConfig.minWidth / containerWidth) * 100;
            const rightEdgePercent = 100 - mousePercent;
            const maxPercent = 100 - leftPercent - 20; // Leave at least 20% for center
            const newPercent = Math.max(minPercent, Math.min(maxPercent, rightEdgePercent));
            setRightPercent(newPercent);
        }
    }, [activeDivider, leftPercent, rightPercent, mergedLeftConfig.minWidth, mergedRightConfig.minWidth]);

    // Handle mouse up to stop resizing
    const handleMouseUp = useCallback(() => {
        setActiveDivider(null);
    }, []);

    // Add/remove global mouse listeners
    React.useEffect(() => {
        if (activeDivider) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [activeDivider, handleMouseMove, handleMouseUp]);

    // Calculate center panel width
    const centerPercent = 100 - leftPercent - rightPercent;

    return (
        <div
            ref={containerRef}
            className={`flex h-full w-full overflow-hidden ${className}`}
        >
            {/* Left Panel */}
            <div
                className="h-full overflow-hidden flex-shrink-0"
                style={{ width: `${leftPercent}%` }}
            >
                {leftPanel}
            </div>

            {/* Left Divider */}
            <Divider
                onMouseDown={handleLeftDividerMouseDown}
                isActive={activeDivider === 'left'}
            />

            {/* Center Panel */}
            <div
                className="h-full overflow-hidden flex-grow"
                style={{ width: `${centerPercent}%` }}
            >
                {centerPanel}
            </div>

            {/* Right Divider */}
            <Divider
                onMouseDown={handleRightDividerMouseDown}
                isActive={activeDivider === 'right'}
            />

            {/* Right Panel */}
            <div
                className="h-full overflow-hidden flex-shrink-0"
                style={{ width: `${rightPercent}%` }}
            >
                {rightPanel}
            </div>
        </div>
    );
};

ResizablePanelLayout.displayName = 'ResizablePanelLayout';

export default ResizablePanelLayout;
