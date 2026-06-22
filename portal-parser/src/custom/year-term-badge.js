/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Year/Term badge for the custom renderer.
 *
 * A small top-left text pill ("Y1•T1") shown only outside the Year/Term grid
 * layout mode, where position alone wouldn't otherwise convey a course's
 * year/term. Redundant inside the grid mode itself, so callers clear these
 * when switching into it (see clearYearTermBadges).
 */

import { getGraphNodes, extractCourseCodeFromNodeElement } from '../core/graph-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BADGE_CLASS = 'node-badge';
const YEAR_TERM_BADGE_CLASS = `${BADGE_CLASS}--year-term`;
const PILL_WIDTH = 34;
const PILL_HEIGHT = 15;
const PILL_INSET = 4; // pulls the badge in slightly from the exact corner

/** Draws a "Y{year}•T{term}" pill on the top-left corner of each node with year/term data */
export function applyYearTermBadges(svgElement, courseYearTermMap) {
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        nodeElement.querySelector(`.${YEAR_TERM_BADGE_CLASS}`)?.remove();

        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        const entry = courseYearTermMap.get(courseCode);
        if (!entry || entry.year == null || entry.term == null) return;

        nodeElement.appendChild(buildYearTermBadge(entry, nodeElement));
    });
}

/** Removes all year/term badges — used when entering Year/Term grid mode, where they'd be redundant */
export function clearYearTermBadges(svgElement) {
    if (!svgElement) return;
    svgElement.querySelectorAll(`.${YEAR_TERM_BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function buildYearTermBadge({ year, term }, nodeElement) {
    const width = parseFloat(nodeElement.getAttribute('data-w')) || 0;
    const height = parseFloat(nodeElement.getAttribute('data-h')) || 0;

    const badge = createElement('g');
    badge.classList.add(BADGE_CLASS, YEAR_TERM_BADGE_CLASS);
    badge.setAttribute('transform', `translate(${-width / 2 + PILL_INSET}, ${-height / 2 + PILL_INSET})`);

    const pill = createElement('rect');
    pill.setAttribute('x', -PILL_WIDTH / 2);
    pill.setAttribute('y', -PILL_HEIGHT / 2);
    pill.setAttribute('width', PILL_WIDTH);
    pill.setAttribute('height', PILL_HEIGHT);
    pill.setAttribute('rx', PILL_HEIGHT / 2);
    badge.appendChild(pill);

    const text = createElement('text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('y', '0.5');
    text.textContent = `Y${year}•T${term}`;
    badge.appendChild(text);

    return badge;
}

function createElement(tag) {
    return document.createElementNS(SVG_NS, tag);
}
