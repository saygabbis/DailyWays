import React from 'react';
import { screenPxToWorld } from '../interaction/viewport/viewportLimits.js';
import { effectiveStrokeScreenPx, strokeWidthInWorld } from './vectorViewport.js';

/**
 * Raio do feMorphology em unidades do viewBox (userSpaceOnUse).
 * Espessura visual em px de ecrã = stroke.width (após clamp), independente do zoom do canvas.
 */
export function getMorphologyRadius(stroke, zoom) {
    const effectiveScreen = effectiveStrokeScreenPx(stroke);
    if (effectiveScreen <= 0) return 0;
    const worldTh = screenPxToWorld(zoom, effectiveScreen);
    const align = stroke.align ?? 'outside';
    if (align === 'center') return worldTh * 0.5;
    if (align === 'inside') return worldTh;
    return worldTh;
}

/** Blur em unidades do viewBox, proporcional à espessura em px de ecrã. */
export function getOutlineBlurStdDev(stroke, zoom, baseRadiusWorld) {
    const style = stroke.outlineStyle ?? stroke.dash ?? 'solid';
    let smoothness = Math.max(0, Math.min(100, Number(stroke.smoothness ?? 35)));
    if (style === 'soft') smoothness = Math.max(smoothness, 55);
    if (smoothness <= 0) return 0;
    const r =
        baseRadiusWorld > 0
            ? baseRadiusWorld
            : getMorphologyRadius(stroke, zoom);
    const minWorld = screenPxToWorld(zoom, 0.5);
    return (smoothness / 100) * Math.max(r, minWorld) * 0.45;
}

function ringNodes({ align, radius, sourceIn = 'SourceAlpha', ringId = 'ring' }) {
    const r = Math.max(radius, 0.001);
    if (align === 'inside') {
        return (
            <>
                <feMorphology in={sourceIn} operator="erode" radius={r} result="innerAlpha" />
                <feComposite in={sourceIn} in2="innerAlpha" operator="out" result={ringId} />
            </>
        );
    }
    if (align === 'center') {
        return (
            <>
                <feMorphology in={sourceIn} operator="dilate" radius={r} result="outerAlpha" />
                <feMorphology in={sourceIn} operator="erode" radius={r} result="innerAlpha" />
                <feComposite in="outerAlpha" in2="innerAlpha" operator="out" result={ringId} />
            </>
        );
    }
    return (
        <>
            <feMorphology in={sourceIn} operator="dilate" radius={r} result="outerAlpha" />
            <feComposite in="outerAlpha" in2={sourceIn} operator="out" result={ringId} />
        </>
    );
}

function colorRingNodes({ ringIn, color, resultId }) {
    return (
        <>
            <feFlood floodColor={color} result={`flood_${resultId}`} />
            <feComposite in={`flood_${resultId}`} in2={ringIn} operator="in" result={resultId} />
        </>
    );
}

function blurRingNodes({ ringIn, blur, resultId }) {
    if (!blur || blur <= 0) return null;
    return <feGaussianBlur in={ringIn} stdDeviation={blur} result={resultId} />;
}

export function ImageOutlineFilterDef({
    filterId,
    stroke,
    zoom,
    outlineColor,
    glowColor,
    viewW,
    viewH,
    filterPad,
}) {
    const align = stroke.align ?? 'outside';
    const style = stroke.outlineStyle ?? stroke.dash ?? 'solid';
    const baseR = getMorphologyRadius(stroke, zoom);
    if (baseR <= 0) return null;

    const blur = getOutlineBlurStdDev(stroke, zoom, baseR);
    const pad = filterPad ?? Math.max(baseR * 2, strokeWidthInWorld(zoom, 12));
    const glowExtra = style === 'glow' ? strokeWidthInWorld(zoom, 8) : 0;

    const jsxLayers = [];
    const mergeIds = [];

    if (style === 'glow') {
        const glowR = baseR + glowExtra;
        const glowBlur = Math.max(
            blur,
            strokeWidthInWorld(zoom, effectiveStrokeScreenPx(stroke) * 0.65),
        );
        jsxLayers.push(
            <React.Fragment key="glow">
                {ringNodes({ align, radius: glowR, ringId: 'glowRing' })}
                {blurRingNodes({ ringIn: 'glowRing', blur: glowBlur, resultId: 'glowSoft' })}
                {colorRingNodes({
                    ringIn: glowBlur > 0 ? 'glowSoft' : 'glowRing',
                    color: glowColor ?? outlineColor,
                    resultId: 'glowColored',
                })}
            </React.Fragment>,
        );
        mergeIds.push('glowColored');
    }

    if (style === 'double') {
        const innerR = baseR * 0.55;
        const outerR = baseR * 1.15;
        jsxLayers.push(
            <React.Fragment key="double-outer">
                {ringNodes({ align, radius: outerR, ringId: 'ringOuter' })}
                {blurRingNodes({ ringIn: 'ringOuter', blur: blur * 0.6, resultId: 'ringOuterSoft' })}
                {colorRingNodes({
                    ringIn: blur > 0 ? 'ringOuterSoft' : 'ringOuter',
                    color: outlineColor,
                    resultId: 'outlineOuter',
                })}
            </React.Fragment>,
        );
        mergeIds.push('outlineOuter');

        jsxLayers.push(
            <React.Fragment key="double-inner">
                {ringNodes({ align, radius: innerR, ringId: 'ringInner' })}
                {blurRingNodes({ ringIn: 'ringInner', blur: blur * 0.4, resultId: 'ringInnerSoft' })}
                {colorRingNodes({
                    ringIn: blur > 0 ? 'ringInnerSoft' : 'ringInner',
                    color: outlineColor,
                    resultId: 'outlineInner',
                })}
            </React.Fragment>,
        );
        mergeIds.push('outlineInner');
    } else {
        jsxLayers.push(
            <React.Fragment key="main">
                {ringNodes({ align, radius: baseR, ringId: 'ring' })}
                {blurRingNodes({ ringIn: 'ring', blur, resultId: 'ringSoft' })}
                {colorRingNodes({
                    ringIn: blur > 0 ? 'ringSoft' : 'ring',
                    color: outlineColor,
                    resultId: 'outline',
                })}
            </React.Fragment>,
        );
        mergeIds.push('outline');
    }

    return (
        <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x={-pad}
            y={-pad}
            width={viewW + pad * 2}
            height={viewH + pad * 2}
            colorInterpolationFilters="sRGB"
        >
            {jsxLayers}
            <feMerge>
                {mergeIds.map((id) => (
                    <feMergeNode key={id} in={id} />
                ))}
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    );
}
