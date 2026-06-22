/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Declarative dimming engine for the custom renderer.
 *
 * Dimming is CSS class state — NOT GSAP opacity tweens. An element's dimmed
 * appearance is a pure function of its classes, so it can never get "stuck".
 *
 * Split: this module owns WHAT is dimmed vs lit (opacity); the animation
 * controller owns active choreography (glow, scale, edge draw).
 */

import {
    getGraphNodes,
    getGraphEdges,
    extractCourseCodeFromNodeElement,
    resolveEdgeKey
} from '../core/graph-data.js';

const ROOT_ACTIVE_CLASS = 'has-active-selection';
const NODE_CHAIN_CLASS = 'node--in-chain';
const EDGE_CHAIN_CLASS = 'edge--in-chain';

/** Marks prerequisite chain as lit, dims everything else */
export function applyDimming(svgElement, chainNodeCodes, chainEdgeKeys) {
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        nodeElement.classList.toggle(NODE_CHAIN_CLASS, chainNodeCodes.has(courseCode));
    });

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const edgeKey = resolveEdgeKey(edgeElement);
        edgeElement.classList.toggle(EDGE_CHAIN_CLASS, Boolean(edgeKey) && chainEdgeKeys.has(edgeKey));
    });

    // Engage dimming last so membership is settled before the transition fires
    svgElement.classList.add(ROOT_ACTIVE_CLASS);
}

/** Releases all dimming — CSS transitions fade everything back to full opacity */
export function clearDimming(svgElement) {
    if (!svgElement) return;

    svgElement.classList.remove(ROOT_ACTIVE_CLASS);
    getGraphNodes(svgElement).forEach((nodeElement) => nodeElement.classList.remove(NODE_CHAIN_CLASS));
    getGraphEdges(svgElement).forEach((edgeElement) => edgeElement.classList.remove(EDGE_CHAIN_CLASS));
}
