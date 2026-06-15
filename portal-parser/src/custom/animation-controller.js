/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Custom engine animation controller.
 *
 * Shockwave sequence per BFS wave:
 *   1. All edges in the wave draw simultaneously (stroke-dashoffset, selected → prereq).
 *   2. When the wave's edges finish drawing → prerequisite nodes glow.
 *   3. Repeat for the next BFS wave outward.
 *
 * Dimming is NOT handled here — it is owned by dimming-engine.js as declarative CSS
 * class state. This controller only choreographs the active effects (glow, scale,
 * edge draw) and never touches opacity, so an interrupted timeline cannot leave a
 * node stuck dim.
 */

import gsap from 'gsap';
import {
    collectPrerequisiteChain,
    buildPrerequisiteDistanceMap,
    buildPrerequisiteEdgeDistanceMap,
    getGraphNodes,
    getGraphEdges,
    extractCourseCodeFromNodeElement,
    resolveEdgeKey
} from '../core/graph-data.js';
import { applyDimming, clearDimming } from './dimming-engine.js';
import { buildSmoothPath, buildReversedSmoothPath } from './path-utils.js';

/* Timing */
const EDGE_DRAW_SECONDS = 0.4;
const NODE_GLOW_SECONDS = 0.25;
const WAVE_GAP_SECONDS = 0.05;

/* Visual tokens */
const GLOW_SELECTED = 'drop-shadow(0 0 12px #86efac) drop-shadow(0 0 24px rgba(134,239,172,0.9))';
const GLOW_DIRECT = 'drop-shadow(0 0 10px #60a5fa)';
const GLOW_OTHER = 'drop-shadow(0 0 8px #fb923c)';
const STROKE_ACTIVE_EDGE = '#60a5fa';
const STROKE_DEFAULT_NODE = '#334155';
const STROKE_DEFAULT_EDGE = '#94a3b8';

/**
 * Runs the shockwave prerequisite animation on the custom engine's SVG.
 *
 * @param {string} selectedCode - The clicked course code.
 * @param {SVGElement} svgElement - Root SVG from the custom engine.
 * @param {gsap.core.Timeline|null} activeTimeline - Existing timeline to kill before starting.
 * @returns {gsap.core.Timeline} The new running timeline.
 */
export function animateCustomNodeSelection(selectedCode, svgElement, activeTimeline) {
    if (activeTimeline) activeTimeline.kill();
    if (!svgElement) return null;

    // Clear residual inline choreography (filters, strokes, scales, reversed paths) from
    // any prior selection. Opacity is intentionally untouched — the dimming engine owns it.
    resetInlineState(svgElement);

    const { visitedNodes, visitedEdges } = collectPrerequisiteChain(selectedCode);
    const nodeDistanceMap = buildPrerequisiteDistanceMap(selectedCode);
    const edgeDistanceMap = buildPrerequisiteEdgeDistanceMap(selectedCode, visitedEdges);

    // Dimming is declarative class state, applied once and independent of the timeline
    applyDimming(svgElement, visitedNodes, visitedEdges);

    const allNodeElements = getGraphNodes(svgElement);
    const allEdgeElements = getGraphEdges(svgElement);
    const timeline = gsap.timeline();

    glowSelectedNode(svgElement, selectedCode, timeline);

    const edgesByWave = groupEdgesByWave(allEdgeElements, visitedEdges, edgeDistanceMap);
    if (edgesByWave.size === 0) return timeline;

    // Hide every chain edge up-front so none flash into view before its wave draws it
    hideChainEdges(edgesByWave, timeline);

    const maxWave = Math.max(...edgesByWave.keys());
    for (let wave = 0; wave <= maxWave; wave++) {
        // Each wave: edges draw, then the nodes at the far end glow
        const waveStart = wave * (EDGE_DRAW_SECONDS + NODE_GLOW_SECONDS + WAVE_GAP_SECONDS);
        const nodeGlowStart = waveStart + EDGE_DRAW_SECONDS;

        animateWaveEdges(edgesByWave.get(wave) ?? [], timeline, waveStart);
        animateWaveNodes(allNodeElements, nodeDistanceMap, wave + 1, timeline, nodeGlowStart);
    }

    return timeline;
}

/**
 * Resets the custom engine SVG to its default visual state on deselect.
 * Releases dimming (CSS) and clears the active choreography (GSAP/inline).
 *
 * @param {SVGElement} svgElement
 */
export function clearCustomAnimations(svgElement) {
    if (!svgElement) return;

    clearDimming(svgElement);
    gsap.killTweensOf(svgElement.querySelectorAll('rect, path, g.node, g.edge'));

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const shape = nodeElement.querySelector('rect');
        if (!shape) return;

        shape.style.filter = 'none';
        gsap.to(shape, {
            stroke: STROKE_DEFAULT_NODE,
            strokeWidth: 2,
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
            onComplete: () => gsap.set(shape, { clearProps: 'transform' })
        });
    });

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const path = edgeElement.querySelector('path');
        if (!path) return;

        restorePathDirection(path);
        path.style.filter = 'none';
        gsap.to(path, {
            stroke: STROKE_DEFAULT_EDGE,
            strokeWidth: 1.5,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: () => gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' })
        });
    });
}

/**
 * Instantly clears inline choreography (filters, strokes, scales, reversed paths) so a
 * new selection starts clean. Does NOT touch opacity — that is the dimming engine's job.
 */
function resetInlineState(svgElement) {
    gsap.killTweensOf(svgElement.querySelectorAll('rect, path, g.node, g.edge'));

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const shape = nodeElement.querySelector('rect');
        if (!shape) return;
        shape.style.filter = 'none';
        gsap.set(shape, {
            stroke: STROKE_DEFAULT_NODE,
            strokeWidth: 2,
            scale: 1,
            transformOrigin: '50% 50%'
        });
    });

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const path = edgeElement.querySelector('path');
        if (!path) return;
        restorePathDirection(path);
        path.style.filter = 'none';
        gsap.set(path, {
            stroke: STROKE_DEFAULT_EDGE,
            strokeWidth: 1.5,
            clearProps: 'strokeDasharray,strokeDashoffset'
        });
    });
}

/**
 * Restores an edge path to its canonical forward direction if a draw animation
 * reversed it mid-flight (e.g. timeline was killed before onComplete fired).
 * Uses the stored data-points to rebuild the smooth path rather than un-parsing d.
 */
function restorePathDirection(path) {
    const rawPoints = path.getAttribute('data-points');
    if (!rawPoints) return;

    try {
        const points = JSON.parse(rawPoints);
        path.setAttribute('d', buildSmoothPath(points));
    } catch { /* malformed JSON — leave d as-is */ }

    // Restore arrowhead if it was suppressed during animation
    if (path.getAttribute('marker-end') === 'none') {
        const markerId = path.closest('svg')?.querySelector('defs marker')?.id;
        if (markerId) path.setAttribute('marker-end', `url(#${markerId})`);
    }
}

/* Glow the selected node immediately (distance 0) */
function glowSelectedNode(svgElement, selectedCode, timeline) {
    const nodeElement = svgElement.querySelector(`[data-course-code="${selectedCode}"]`);
    if (!nodeElement) return;

    const shape = nodeElement.querySelector('rect');
    if (!shape) return;

    timeline.call(() => { shape.style.filter = GLOW_SELECTED; }, null, 0);
    timeline.to(shape, {
        stroke: '#86efac',
        strokeWidth: 3,
        scale: 1.05,
        duration: 0.3,
        ease: 'power2.out',
        transformOrigin: '50% 50%'
    }, 0);

    // Pulse the selected node
    timeline.to(shape, {
        scale: 1.07,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        duration: 0.8
    }, 0.3);
}

/* Group visited edges by BFS wave index (edgeDistanceMap value) */
function groupEdgesByWave(allEdgeElements, visitedEdges, edgeDistanceMap) {
    const edgesByWave = new Map();

    allEdgeElements.forEach((edgeElement) => {
        const edgeKey = resolveEdgeKey(edgeElement);
        if (!edgeKey || !visitedEdges.has(edgeKey)) return;

        const wave = edgeDistanceMap.get(edgeKey) ?? 0;
        const path = edgeElement.querySelector('path');
        if (!path) return;

        const totalLength = getSafePathLength(path);
        if (!edgesByWave.has(wave)) edgesByWave.set(wave, []);
        edgesByWave.get(wave).push({ path, totalLength });
    });

    return edgesByWave;
}

/* Hide all chain edges at t=0 (dash fully offset) so later waves draw cleanly */
function hideChainEdges(edgesByWave, timeline) {
    [...edgesByWave.values()].flat().forEach(({ path, totalLength }) => {
        timeline.set(path, {
            strokeDasharray: totalLength,
            strokeDashoffset: totalLength,
            stroke: STROKE_ACTIVE_EDGE,
            strokeWidth: 2.5
        }, 0);
    });
}

/* Animate all edges in a single wave, drawing from selected node outward to prereq */
function animateWaveEdges(waveEdges, timeline, startTime) {
    waveEdges.forEach(({ path, totalLength }) => {
        const originalD = path.getAttribute('d');
        const originalMarker = path.getAttribute('marker-end') ?? '';

        // Read raw points stored by the renderer — avoids parsing the bezier d string
        const points = JSON.parse(path.getAttribute('data-points') ?? '[]');
        const reversedD = buildReversedSmoothPath(points);

        // Swap to reversed path and suppress the arrowhead — with d reversed, marker-end
        // would point toward the selected node (wrong direction) until d is restored
        timeline.call(() => {
            path.setAttribute('d', reversedD);
            path.setAttribute('marker-end', 'none');
            gsap.set(path, { strokeDasharray: totalLength, strokeDashoffset: totalLength });
        }, null, startTime);

        timeline.to(path, {
            strokeDashoffset: 0,
            duration: EDGE_DRAW_SECONDS,
            ease: 'power2.inOut',
            onComplete() {
                // Restore original path direction and arrowhead together so neither
                // is visible in a wrong state
                path.setAttribute('d', originalD);
                if (originalMarker) {
                    path.setAttribute('marker-end', originalMarker);
                } else {
                    path.removeAttribute('marker-end');
                }
                gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' });
                path.style.filter = `drop-shadow(0 0 5px ${STROKE_ACTIVE_EDGE})`;
            }
        }, startTime);
    });
}

/* Glow all nodes at a specific BFS distance — called after that wave's edges finish */
function animateWaveNodes(allNodeElements, nodeDistanceMap, targetDistance, timeline, startTime) {
    allNodeElements.forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (nodeDistanceMap.get(courseCode) !== targetDistance) return;

        const shape = nodeElement.querySelector('rect');
        if (!shape) return;

        const glowFilter = targetDistance === 1 ? GLOW_DIRECT : GLOW_OTHER;
        const strokeColor = targetDistance === 1 ? '#60a5fa' : '#fb923c';
        const strokeWidth = targetDistance === 1 ? 2.4 : 2.2;
        const scale = targetDistance === 1 ? 1.02 : 1.01;

        timeline.call(() => { shape.style.filter = glowFilter; }, null, startTime);
        timeline.to(shape, {
            stroke: strokeColor,
            strokeWidth,
            scale,
            duration: NODE_GLOW_SECONDS,
            ease: 'power2.out',
            transformOrigin: '50% 50%'
        }, startTime);
    });
}

function getSafePathLength(pathElement) {
    try {
        const length = pathElement.getTotalLength?.() ?? 0;
        if (length > 10) return length;
    } catch { /* ignore geometry errors */ }
    return 300;
}
