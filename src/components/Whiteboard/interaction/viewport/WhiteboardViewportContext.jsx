import React from 'react';
import { clampViewportZoom } from './viewportLimits.js';
import { WhiteboardViewportContext } from './useWhiteboardViewportZoom';



export function WhiteboardViewportProvider({ zoom, children }) {
    const value = React.useMemo(
        () => ({ zoom: clampViewportZoom(zoom) }),
        [zoom]
    );
    return (
        <WhiteboardViewportContext.Provider value={value}>
            {children}
        </WhiteboardViewportContext.Provider>
    );
}


