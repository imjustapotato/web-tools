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
 * Dimming is expressed purely as CSS class state — NOT as imperative GSAP opacity
 * tweens. The dimmed appearance of any element is therefore a pure function of its
 * current classes, so it can never get "stuck" by an interrupted or half-killed
 * timeline: applying a selection sets membership classes, clearing it removes them,
 * and CSS transitions handle the fade in both directions.
 *
 * Responsibility split:
 *   - This module owns WHAT is dimmed vs. lit (opacity).
 *   - The animation controller owns the active choreography (glow, scale, edge draw).
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

/**
 * Marks the prerequisite chain as lit and engages dimming on everything else.
 *
 * @param {SVGElement} svgElement
 * @param {Set<string>} chainNodeCodes - Course codes that belong to the chain.
 * @param {Set<string>} chainEdgeKeys - Edge keys ("SRC->TGT") that belong to the chain.
 */
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

/**
 * Releases all dimming. CSS transitions fade every element back to full opacity.
 *
 * @param {SVGElement} svgElement
 */
export function clearDimming(svgElement) {
    if (!svgElement) return;

    svgElement.classList.remove(ROOT_ACTIVE_CLASS);
    getGraphNodes(svgElement).forEach((nodeElement) => nodeElement.classList.remove(NODE_CHAIN_CLASS));
    getGraphEdges(svgElement).forEach((edgeElement) => edgeElement.classList.remove(EDGE_CHAIN_CLASS));
}
