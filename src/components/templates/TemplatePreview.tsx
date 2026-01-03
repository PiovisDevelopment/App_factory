/**
 * src/components/templates/TemplatePreview.tsx
 * ============================================
 * Renders a scaled-down live preview of a template for the thumbnail view.
 */

import React, { useMemo } from "react";
import { TemplateComponentRenderer } from "../factory/TemplateComponentRenderer";
import type { CanvasElement } from "../factory/canvasTypes";

interface TemplatePreviewProps {
    elements: CanvasElement[];
    windowSize: { width: number; height: number };
    containerWidth?: number;
    containerHeight?: number;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
    elements,
    windowSize,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(0.1);

    React.useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;

            const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
            const scaleX = containerWidth / windowSize.width;
            const scaleY = containerHeight / windowSize.height;

            // Use 90% of the available space to leave some margins
            setScale(Math.min(scaleX, scaleY) * 0.9);
        };

        // Initial calculation
        updateScale();

        // Observe resizing
        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [windowSize]);

    // Recursively render elements
    const renderElement = (element: CanvasElement) => {
        if (!element.visible && element.visible !== undefined) return null;

        return (
            <div
                key={element.id}
                style={{
                    position: "absolute",
                    left: element.bounds.x,
                    top: element.bounds.y,
                    width: element.bounds.width,
                    height: element.bounds.height,
                    zIndex: element.zIndex || 1,
                }}
                className="pointer-events-none"
            >
                <TemplateComponentRenderer
                    componentId={element.componentId || "container"}
                    props={element.props}
                    bounds={element.bounds}
                />
                {element.children?.map(renderElement)}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-neutral-100 overflow-hidden relative"
            style={{ isolation: 'isolate' }}
        >
            <div
                style={{
                    width: windowSize.width,
                    height: windowSize.height,
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    transformOrigin: "center center",
                    backgroundColor: "#fff", // App background
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
            >
                {elements.map(renderElement)}
            </div>
        </div>
    );
};
