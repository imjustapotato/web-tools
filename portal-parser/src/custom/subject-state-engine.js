/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Subject state engine for the custom renderer.
 *
 * Colors each node by the student's real completion status (passed/active/
 * pending/failed), fed by the Companion extension's Network Map scrape.
 * Declarative CSS class state — composes with dimming/trace/selection
 * layers instead of fighting them (see styles.css).
 *
 * Also draws a small corner badge per node. Icons are plain SVG primitives
 * (not <foreignObject>+Iconify) so they rasterize correctly for the planned
 * PNG export — foreignObject content is known to drop out of canvas-based
 * SVG-to-PNG conversion.
 */

import { getGraphNodes, extractCourseCodeFromNodeElement } from '../core/graph-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SUBJECT_STATES = ['passed', 'active', 'pending', 'failed'];
const STATE_CLASSES = SUBJECT_STATES.map((state) => `node--${state}`);
const BADGE_CLASS = 'node-badge';
const BADGE_RADIUS = 9;
const BADGE_INSET = 4; // pulls the badge in slightly from the exact corner

/** Colors each node matching the state map and draws/clears its badge; nodes with no entry are left uncolored */
export function applySubjectState(svgElement, stateMap) {
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        const state = stateMap.get(courseCode);

        nodeElement.classList.remove(...STATE_CLASSES);
        nodeElement.querySelector(`.${BADGE_CLASS}--subject-state`)?.remove();

        if (!state || !SUBJECT_STATES.includes(state)) return;

        nodeElement.classList.add(`node--${state}`);
        nodeElement.appendChild(buildSubjectStateBadge(state, nodeElement));
    });
}

/** Builds the top-right corner badge for one node's subject state */
function buildSubjectStateBadge(state, nodeElement) {
    const width = parseFloat(nodeElement.getAttribute('data-w')) || 0;
    const height = parseFloat(nodeElement.getAttribute('data-h')) || 0;

    const badge = createElement('g');
    badge.classList.add(BADGE_CLASS, `${BADGE_CLASS}--subject-state`, `${BADGE_CLASS}--${state}`);
    badge.setAttribute('transform', `translate(${width / 2 - BADGE_INSET}, ${-height / 2 + BADGE_INSET})`);

    const circle = createElement('circle');
    circle.setAttribute('r', BADGE_RADIUS);
    badge.appendChild(circle);

    const icon = buildStateIcon(state);
    if (icon) badge.appendChild(icon);

    return badge;
}

/** Plain SVG primitives standing in for the mdi: icon shapes — no Iconify/foreignObject involved */
function buildStateIcon(state) {
    if (state === 'passed') {
        const check = createElement('polyline');
        check.setAttribute('points', '-4,0 -1,3.5 4.5,-3.5');
        check.setAttribute('fill', 'none');
        check.setAttribute('stroke', '#0f172a');
        check.setAttribute('stroke-width', '1.8');
        check.setAttribute('stroke-linecap', 'round');
        check.setAttribute('stroke-linejoin', 'round');
        return check;
    }

    if (state === 'pending') {
        // Right half of the badge circle, filled — a "half circle" glyph (mdi:circle-half-full)
        const halfCircle = createElement('path');
        halfCircle.setAttribute('d', `M0,${-BADGE_RADIUS} A${BADGE_RADIUS},${BADGE_RADIUS} 0 0 1 0,${BADGE_RADIUS} Z`);
        halfCircle.setAttribute('fill', '#0f172a');
        return halfCircle;
    }

    if (state === 'failed') {
        const group = createElement('g');
        group.setAttribute('stroke', '#0f172a');
        group.setAttribute('stroke-width', '1.8');
        group.setAttribute('stroke-linecap', 'round');

        const lineA = createElement('line');
        lineA.setAttribute('x1', '-3.5'); lineA.setAttribute('y1', '-3.5');
        lineA.setAttribute('x2', '3.5'); lineA.setAttribute('y2', '3.5');

        const lineB = createElement('line');
        lineB.setAttribute('x1', '-3.5'); lineB.setAttribute('y1', '3.5');
        lineB.setAttribute('x2', '3.5'); lineB.setAttribute('y2', '-3.5');

        group.appendChild(lineA);
        group.appendChild(lineB);
        return group;
    }

    // 'active' — mdi:circle is just a filled circle; the badge's own background circle already is one.
    return null;
}

function createElement(tag) {
    return document.createElementNS(SVG_NS, tag);
}
