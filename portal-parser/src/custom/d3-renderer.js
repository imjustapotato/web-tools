/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Custom engine SVG renderer.
 * Takes a dagre-positioned graph and produces an SVG element with full DOM
 * ownership — every node and edge element is directly addressable for GSAP animation.
 *
 * SVG structure designed for compatibility with graph-data.js selectors:
 *   - Nodes: <g class="node" data-course-code="..."> with <rect> child
 *   - Edges: <g class="edge" data-source="..." data-target="..."> with <path> child
 */

import { getCourseTitleMap } from '../core/graph-data.js';
import { buildSmoothPath } from './path-utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TITLE_MAX_CHARS = 26;

/* Visual tokens — mirrors the Mermaid theme for visual parity */
const STYLE = {
    nodeFill: '#1e293b',
    nodeStroke: '#334155',
    nodeStrokeWidth: 2,
    nodeRadius: 8,
    codeColor: '#f8fafc',
    codeFontSize: 12,
    codeFontWeight: '700',
    titleColor: '#94a3b8',
    titleFontSize: 10,
    edgeStroke: '#94a3b8',
    edgeStrokeWidth: 1.5,
    arrowFill: '#94a3b8',
    arrowMarkerId: 'ce-arrowhead',
    font: 'Inter, sans-serif',
};

/**
 * Renders a dagre-positioned graph into `container` as a self-contained SVG.
 * Clears and replaces container contents on each call.
 *
 * @param {dagre.graphlib.Graph} layoutGraph - Output from buildDagreLayout().
 * @param {HTMLElement} container - DOM element that receives the SVG.
 * @returns {SVGElement} The root SVG element.
 */
export function renderDagreLayout(layoutGraph, container) {
    const graphMeta = layoutGraph.graph();
    const svgWidth = (graphMeta.width ?? 0) + (graphMeta.marginx ?? 0) * 2;
    const svgHeight = (graphMeta.height ?? 0) + (graphMeta.marginy ?? 0) * 2;

    const svg = createElement('svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.classList.add('custom-engine-svg');

    svg.appendChild(buildDefs());

    const edgesLayer = createElement('g');
    edgesLayer.classList.add('edges-layer');
    layoutGraph.edges().forEach(({ v: sourceCode, w: targetCode }) => {
        const edgeData = layoutGraph.edge({ v: sourceCode, w: targetCode });
        edgesLayer.appendChild(buildEdgeElement(sourceCode, targetCode, edgeData));
    });

    const nodesLayer = createElement('g');
    nodesLayer.classList.add('nodes-layer');
    layoutGraph.nodes().forEach((courseCode) => {
        const nodeData = layoutGraph.node(courseCode);
        nodesLayer.appendChild(buildNodeElement(nodeData));
    });

    // Edges first so nodes render on top
    svg.appendChild(edgesLayer);
    svg.appendChild(nodesLayer);

    container.innerHTML = '';
    container.appendChild(svg);

    return svg;
}

/* Node Builder */
function buildNodeElement(nodeData) {
    const { courseCode, title, x, y, width, height } = nodeData;
    const courseTitleMap = getCourseTitleMap();
    const resolvedTitle = title || courseTitleMap.get(courseCode) || '';
    const displayTitle = resolvedTitle.length > TITLE_MAX_CHARS
        ? `${resolvedTitle.slice(0, TITLE_MAX_CHARS)}…`
        : resolvedTitle;

    const group = createElement('g');
    group.classList.add('node');
    group.setAttribute('data-course-code', courseCode);
    group.setAttribute('id', `ce-node-${courseCode}`);
    group.setAttribute('transform', `translate(${x}, ${y})`);

    const rect = createElement('rect');
    rect.setAttribute('x', -width / 2);
    rect.setAttribute('y', -height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', STYLE.nodeRadius);
    rect.setAttribute('fill', STYLE.nodeFill);
    rect.setAttribute('stroke', STYLE.nodeStroke);
    rect.setAttribute('stroke-width', STYLE.nodeStrokeWidth);
    group.appendChild(rect);

    // Course code — vertically centered if no title, shifted up if title present
    const codeY = displayTitle ? '-8' : '4';
    group.appendChild(buildText(courseCode, codeY, STYLE.codeColor, STYLE.codeFontSize, STYLE.codeFontWeight));

    if (displayTitle) {
        group.appendChild(buildText(displayTitle, '12', STYLE.titleColor, STYLE.titleFontSize, '400'));
    }

    return group;
}

/* Edge Builder */
function buildEdgeElement(sourceCode, targetCode, edgeData) {
    const group = createElement('g');
    group.classList.add('edge');
    group.setAttribute('data-source', sourceCode);
    group.setAttribute('data-target', targetCode);

    const points = edgeData?.points ?? [];
    const path = createElement('path');
    path.setAttribute('d', buildSmoothPath(points));
    // Store raw points so the animation controller can reverse the path without
    // parsing the SVG d string (which would be fragile with bezier commands).
    path.setAttribute('data-points', JSON.stringify(points));
    path.setAttribute('stroke', STYLE.edgeStroke);
    path.setAttribute('stroke-width', STYLE.edgeStrokeWidth);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#${STYLE.arrowMarkerId})`);
    group.appendChild(path);

    return group;
}

/* SVG Helpers */
function buildDefs() {
    const defs = createElement('defs');

    const marker = createElement('marker');
    marker.setAttribute('id', STYLE.arrowMarkerId);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');

    const arrowPath = createElement('path');
    arrowPath.setAttribute('d', 'M0,0 L0,7 L9,3.5 z');
    arrowPath.setAttribute('fill', STYLE.arrowFill);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    return defs;
}

function buildText(content, y, fill, fontSize, fontWeight) {
    const text = createElement('text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'auto');
    text.setAttribute('y', y);
    text.setAttribute('fill', fill);
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-weight', fontWeight);
    text.setAttribute('font-family', STYLE.font);
    text.textContent = content;
    return text;
}

function createElement(tag) {
    return document.createElementNS(SVG_NS, tag);
}
