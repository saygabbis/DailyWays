import { useId, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useSpaceAssetUrl } from '../../../../hooks/useSpaceAssetUrl';
import { getImageObjectFit } from '../../interaction/transform/imageResize';
import { useWhiteboardViewportZoom } from '../../interaction/viewport/WhiteboardViewportContext.jsx';
import { screenPxToWorld } from '../../interaction/viewport/viewportLimits.js';
import { getAppearanceFromNode, colorWithOpacity } from '../../shared/appearanceStyle.js';
import {
    ImageOutlineFilterDef,
    getMorphologyRadius,
} from '../../shared/imageOutlineFilter.jsx';
import { WORLD_DIM_EPSILON } from '../../shared/vectorViewport.js';
import { resolveSpaceAssetStoragePath } from '../../../../services/spaceAssetService';

export default function ImageNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const url = useSpaceAssetUrl(node);
    const objectFit = getImageObjectFit(node);
    const zoom = useWhiteboardViewportZoom();
    const filterId = useId().replace(/:/g, '');
    const appearance = getAppearanceFromNode(node);
    const stroke = useMemo(() => appearance.stroke ?? {}, [appearance.stroke]);
    const w = Math.max(node.width ?? 0, WORLD_DIM_EPSILON);
    const h = Math.max(node.height ?? 0, WORLD_DIM_EPSILON);
    const opacity = (appearance.opacity ?? 100) / 100;
    const preserveAspectRatio = objectFit === 'cover' ? 'xMidYMid slice' : 'none';
    const storagePath = resolveSpaceAssetStoragePath(node);
    const isLoading = Boolean(storagePath) && !url;

    const hasOutline = stroke.visible !== false && (Number(stroke.width) || 0) > 0;
    const outlineColor = colorWithOpacity(stroke.color ?? '#4d96ff', stroke.opacity ?? 100);
    const glowColor = colorWithOpacity(stroke.color ?? '#4d96ff', Math.min(100, (stroke.opacity ?? 100) * 0.45));
    const dilateR = getMorphologyRadius(stroke, zoom);
    const filterPad = Math.max(dilateR * 2, screenPxToWorld(zoom, 12));

    const filterDef = useMemo(() => {
        if (!hasOutline || dilateR <= 0) return null;

        return (
            <ImageOutlineFilterDef
                filterId={filterId}
                stroke={stroke}
                zoom={zoom}
                outlineColor={outlineColor}
                glowColor={glowColor}
                viewW={w}
                viewH={h}
                filterPad={filterPad}
            />
        );
    }, [
        hasOutline,
        dilateR,
        filterId,
        filterPad,
        outlineColor,
        glowColor,
        stroke,
        zoom,
        w,
        h,
    ]);

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node image-node"
                style={{
                    width: w,
                    height: h,
                    overflow: 'visible',
                    background: 'transparent',
                }}
            >
                {url ? (
                    <svg
                        className="whiteboard-image-svg"
                        width={w}
                        height={h}
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="none"
                        overflow="visible"
                        style={{ display: 'block', overflow: 'visible' }}
                        aria-hidden
                    >
                        {filterDef && <defs>{filterDef}</defs>}
                        <image
                            href={url}
                            x={0}
                            y={0}
                            width={w}
                            height={h}
                            preserveAspectRatio={preserveAspectRatio}
                            opacity={opacity}
                            crossOrigin="anonymous"
                            filter={hasOutline && dilateR > 0 ? `url(#${filterId})` : undefined}
                        />
                    </svg>
                ) : (
                    <div className={`whiteboard-image-placeholder${isLoading ? ' is-loading' : ''}`}>
                        {isLoading ? 'Carregando…' : 'Sem imagem'}
                    </div>
                )}
            </div>
        </BaseNode>
    );
}
