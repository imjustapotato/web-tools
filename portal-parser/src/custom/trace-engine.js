/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Declarative branch-tracing engine for the custom renderer.
 *
 * Tracing follows the FORWARD dependency direction (outgoing edges) — "if I pass
 * this course, what does it unlock?" — distinct from selection (backward prereq chain).
 *
 * Trace is expressed purely as CSS class state, never GSAP tweens. Uses separate
 * root classes from selection; the orchestrator ensures they never coexist.
 *
 * Also owns lightweight hover preview (immediate edges of a hovered node).
 */

import {
    getGraphNodes,
    getGraphEdges,
    extractCourseCodeFromNodeElement,
    resolveEdgeKey
} from '../core/graph-data.js';

const ROOT_TRACE_CLASS = 'has-active-trace';
const NODE_TRACE_CLASS = 'node--in-trace';
const EDGE_TRACE_CLASS = 'edge--in-trace';
const EDGE_HOVER_CLASS = 'edge--hover-linked';

/** Lights the forward dependent strand and dims everything else */
export function applyTrace(svgElement, traceNodeCodes, traceEdgeKeys) {
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        nodeElement.classList.toggle(NODE_TRACE_CLASS, traceNodeCodes.has(courseCode));
    });

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const edgeKey = resolveEdgeKey(edgeElement);
        edgeElement.classList.toggle(EDGE_TRACE_CLASS, Boolean(edgeKey) && traceEdgeKeys.has(edgeKey));
    });

    // Engage dimming last so membership is settled before the transition fires
    svgElement.classList.add(ROOT_TRACE_CLASS);
}

/** Releases trace — CSS transitions fade everything back to full opacity */
export function clearTrace(svgElement) {
    if (!svgElement) return;

    svgElement.classList.remove(ROOT_TRACE_CLASS);
    getGraphNodes(svgElement).forEach((nodeElement) => nodeElement.classList.remove(NODE_TRACE_CLASS));
    getGraphEdges(svgElement).forEach((edgeElement) => {
        edgeElement.classList.remove(EDGE_TRACE_CLASS);
        edgeElement.classList.remove(EDGE_HOVER_CLASS);
    });
}

/** Brightens immediate edges of hovered node — declarative class toggle, no dimming */
export function applyHoverPreview(svgElement, hoveredCode) {
    if (!svgElement) return;

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const isLinked = edgeElement.getAttribute('data-source') === hoveredCode
            || edgeElement.getAttribute('data-target') === hoveredCode;
        edgeElement.classList.toggle(EDGE_HOVER_CLASS, isLinked);
    });
}

/** Removes the hover preview from every edge. */
export function clearHoverPreview(svgElement) {
    if (!svgElement) return;
    getGraphEdges(svgElement).forEach((edgeElement) => edgeElement.classList.remove(EDGE_HOVER_CLASS));
}
