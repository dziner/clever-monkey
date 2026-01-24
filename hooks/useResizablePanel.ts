// Fix: Use namespace import for React to resolve potential JSX-related issues.
import * as React from 'react';

export const useResizablePanel = (
    initialWidth: number = 288, // w-72
    minWidth: number = 240,     // w-60
    maxWidth: number = 500,
    direction: 'left' | 'right' = 'left'
) => {
    const [width, setWidth] = React.useState(initialWidth);
    const isResizingRef = React.useRef(false);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
    }, []);

    const handleMouseUp = React.useCallback(() => {
        isResizingRef.current = false;
    }, []);

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
        if (!isResizingRef.current) {
            return;
        }
        
        let newWidth;
        if (direction === 'left') {
             newWidth = e.clientX;
        } else { // 'right'
            newWidth = window.innerWidth - e.clientX;
        }
       
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
        }
    }, [minWidth, maxWidth, direction]);

    React.useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return { width, handleMouseDown };
};