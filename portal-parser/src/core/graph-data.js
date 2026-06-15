/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Graph data layer: shared state, course code utilities, SVG traversal helpers,
 * adjacency graph construction, and BFS/DFS traversal.
 * Engine-agnostic — no Mermaid or D3 imports.
 */

/* Internal State */
let adjacencyGraph = new Map();
let courseTitleMap = new Map();

/* State Accessors */
export function getAdjacencyGraph() { return adjacencyGraph; }
export function getCourseTitleMap() { return courseTitleMap; }

export function setCourseTitleMap(map) {
    courseTitleMap = map;
}

/** Resets only the adjacency graph (called before each render). */
export function resetAdjacencyGraph() {
    adjacencyGraph = new Map();
}

/** Full reset of both maps (called on app reset). */
export function resetGraphState() {
    adjacencyGraph = new Map();
    courseTitleMap = new Map();
}

/* Course Code Utilities */
export function normalizeCourseCode(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return null;
    const normalizedValue = rawValue.replace(/\s+/g, '').toUpperCase();
    const match = normalizedValue.match(/([A-Z]{2,4}\d{2,4}[A-Z]?)/);
    return match ? match[1] : null;
}

export function extractCourseCodesFromText(rawText) {
    if (!rawText) return [];
    const allMatches = rawText.toUpperCase().match(/[A-Z]{2,4}\s*\d{2,4}[A-Z]?/g);
    if (!allMatches) return [];
    return allMatches.map((value) => normalizeCourseCode(value)).filter(Boolean);
}

export function extractCourseCodeFromNodeId(svgNodeId) {
    if (!svgNodeId) return null;

    const flowchartMatch = svgNodeId.match(/flowchart-([A-Za-z0-9_\-]+)-\d+$/i);
    if (flowchartMatch) {
        const normalized = normalizeCourseCode(flowchartMatch[1]);
        if (normalized) return normalized;
    }

    const extractedFromId = extractCourseCodesFromText(svgNodeId);
    return extractedFromId.length > 0 ? extractedFromId[0] : null;
}

export function extractCourseCodeFromNodeElement(nodeElement) {
    // Custom engine sets this attribute directly for O(1) resolution
    const directCode = nodeElement?.getAttribute?.('data-course-code');
    if (directCode) return directCode;

    const fromId = extractCourseCodeFromNodeId(nodeElement?.id ?? '');
    if (fromId) return fromId;

    const labelElement = nodeElement?.querySelector('span.nodeLabel, .nodeLabel, text, tspan, foreignObject');
    return normalizeCourseCode(labelElement?.textContent ?? '');
}

/* Title Utilities */
export function extractCourseTitleMapFromMermaid(mermaidCode) {
    const titleMap = new Map();
    const nodePattern = /^([A-Z]{2,4}\d{2,4}[A-Z]?)\["(?:\1)<br\/?>(.+)"\]$/gm;
    let nodeMatch;

    while ((nodeMatch = nodePattern.exec(mermaidCode)) !== null) {
        const code = normalizeCourseCode(nodeMatch[1]);
        const title = nodeMatch[2]?.replace(/<[^>]+>/g, '').trim() ?? '';
        if (code && title) titleMap.set(code, title);
    }

    return titleMap;
}

export function getCourseDisplayLabel(courseCode) {
    const courseTitle = courseTitleMap.get(courseCode);
    return courseTitle ? `${courseCode} - ${courseTitle}` : courseCode;
}

/* SVG Graph Element Selectors */
export function getGraphNodes(svgElement) {
    const nodeCandidates = svgElement.querySelectorAll('g.node, g[class*="node"]');
    return Array.from(nodeCandidates).filter((nodeElement) => {
        return Boolean(nodeElement.querySelector('rect, polygon, circle, ellipse'));
    });
}

export function getGraphEdges(svgElement) {
    const edgeCandidates = svgElement.querySelectorAll('g.edge, g.edgePath, g[class*="edge"], g[id^="L-"], g[id^="L_"]');
    const uniqueEdges = new Set();

    Array.from(edgeCandidates).forEach((edgeElement) => {
        if (edgeElement.querySelector('path')) uniqueEdges.add(edgeElement);
    });

    return Array.from(uniqueEdges);
}

/* Adjacency Graph Construction */
/**
 * Builds the adjacency graph from the rendered SVG nodes and the raw Mermaid edge definitions.
 * Must be called after the SVG is injected into the DOM.
 */
export function buildAdjacencyGraph(svgElement, mermaidRawCode) {
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (courseCode && !adjacencyGraph.has(courseCode)) {
            adjacencyGraph.set(courseCode, { incoming: new Set(), outgoing: new Set() });
        }
    });

    const edgePattern = /^(\S+)\s+-->\s+(\S+)/gm;
    let edgeMatch;
    while ((edgeMatch = edgePattern.exec(mermaidRawCode)) !== null) {
        const sourceCode = normalizeCourseCode(edgeMatch[1]);
        const targetCode = normalizeCourseCode(edgeMatch[2]);
        if (!sourceCode || !targetCode) continue;

        if (!adjacencyGraph.has(sourceCode)) adjacencyGraph.set(sourceCode, { incoming: new Set(), outgoing: new Set() });
        if (!adjacencyGraph.has(targetCode)) adjacencyGraph.set(targetCode, { incoming: new Set(), outgoing: new Set() });

        adjacencyGraph.get(sourceCode).outgoing.add(targetCode);
        adjacencyGraph.get(targetCode).incoming.add(sourceCode);
    }
}

/**
 * Builds the adjacency graph directly from Mermaid code without a rendered SVG.
 * Used by the custom engine to establish graph state before dagre layout runs.
 */
export function buildAdjacencyGraphFromMermaidCode(mermaidCode) {
    // Capture isolated nodes (no edges) from explicit node definitions
    const nodeDefPattern = /^([A-Z]{2,4}\d{2,4}[A-Z]?)\[/gm;
    let nodeMatch;
    while ((nodeMatch = nodeDefPattern.exec(mermaidCode)) !== null) {
        const courseCode = normalizeCourseCode(nodeMatch[1]);
        if (courseCode && !adjacencyGraph.has(courseCode)) {
            adjacencyGraph.set(courseCode, { incoming: new Set(), outgoing: new Set() });
        }
    }

    const edgePattern = /^(\S+)\s+-->\s+(\S+)/gm;
    let edgeMatch;
    while ((edgeMatch = edgePattern.exec(mermaidCode)) !== null) {
        const sourceCode = normalizeCourseCode(edgeMatch[1]);
        const targetCode = normalizeCourseCode(edgeMatch[2]);
        if (!sourceCode || !targetCode) continue;

        if (!adjacencyGraph.has(sourceCode)) adjacencyGraph.set(sourceCode, { incoming: new Set(), outgoing: new Set() });
        if (!adjacencyGraph.has(targetCode)) adjacencyGraph.set(targetCode, { incoming: new Set(), outgoing: new Set() });

        adjacencyGraph.get(sourceCode).outgoing.add(targetCode);
        adjacencyGraph.get(targetCode).incoming.add(sourceCode);
    }
}

/* Graph Traversal */
/** Traverses upward (incoming edges) from a node to collect all ancestors and edges in the chain. */
export function collectPrerequisiteChain(startCode) {
    const visitedNodes = new Set();
    const visitedEdges = new Set();
    visitedNodes.add(startCode);

    const visitedInTraversal = new Set([startCode]);
    const stack = [startCode];

    while (stack.length > 0) {
        const currentCode = stack.pop();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) continue;

        nodeData.incoming.forEach((prerequisiteCode) => {
            visitedEdges.add(`${prerequisiteCode}->${currentCode}`);
            visitedNodes.add(prerequisiteCode);

            if (!visitedInTraversal.has(prerequisiteCode)) {
                visitedInTraversal.add(prerequisiteCode);
                stack.push(prerequisiteCode);
            }
        });
    }

    return { visitedNodes, visitedEdges };
}

export function buildPrerequisiteDistanceMap(startCode) {
    const distanceMap = new Map();
    const queue = [{ code: startCode, distance: 0 }];
    const visitedCodes = new Set([startCode]);
    distanceMap.set(startCode, 0);

    while (queue.length > 0) {
        const { code: currentCode, distance } = queue.shift();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) continue;

        nodeData.incoming.forEach((neighborCode) => {
            if (!visitedCodes.has(neighborCode)) {
                visitedCodes.add(neighborCode);
                distanceMap.set(neighborCode, distance + 1);
                queue.push({ code: neighborCode, distance: distance + 1 });
            }
        });
    }

    return distanceMap;
}

export function getOrderedPrerequisiteList(startCode) {
    const distanceMap = buildPrerequisiteDistanceMap(startCode);
    return Array.from(distanceMap.entries())
        .filter(([courseCode, distance]) => courseCode !== startCode && distance > 0)
        .sort((left, right) => {
            if (left[1] !== right[1]) return left[1] - right[1];
            return left[0].localeCompare(right[0]);
        });
}

export function buildPrerequisiteEdgeDistanceMap(startCode, visitedEdges) {
    const distanceMap = new Map();
    const queue = [{ code: startCode, distance: 0 }];
    const visitedCodes = new Set([startCode]);

    while (queue.length > 0) {
        const { code: currentCode, distance } = queue.shift();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) continue;

        const allNeighbors = Array.from(nodeData.incoming).map((neighbor) => ({
            neighbor,
            edgeKey: `${neighbor}->${currentCode}`
        }));

        allNeighbors.forEach(({ neighbor, edgeKey }) => {
            if (visitedEdges.has(edgeKey)) {
                distanceMap.set(edgeKey, distance);
                if (!visitedCodes.has(neighbor)) {
                    visitedCodes.add(neighbor);
                    queue.push({ code: neighbor, distance: distance + 1 });
                }
            }
        });
    }

    return distanceMap;
}

/* Edge Resolution */
export function isKnownEdge(sourceCode, targetCode) {
    return Boolean(adjacencyGraph.get(sourceCode)?.outgoing.has(targetCode));
}

export function buildNodeCenterLookup(svgElement) {
    const lookup = [];
    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (!courseCode) return;

        const box = nodeElement.getBBox?.();
        if (!box) return;

        lookup.push({
            courseCode,
            x: box.x + (box.width / 2),
            y: box.y + (box.height / 2)
        });
    });
    return lookup;
}

function findNearestCourseCode(point, nodeCenterLookup) {
    let closestCode = null;
    let minDistance = Number.POSITIVE_INFINITY;

    nodeCenterLookup.forEach((nodeCenter) => {
        const distance = Math.hypot(point.x - nodeCenter.x, point.y - nodeCenter.y);
        if (distance < minDistance) {
            minDistance = distance;
            closestCode = nodeCenter.courseCode;
        }
    });

    return closestCode;
}

/**
 * Edge resolution fallback strategy.
 * 0. Check data-source/data-target attributes (custom engine).
 * 1. Check LS-/LE- class tokens (standard Mermaid flowchart).
 * 2. Check IDs/Labels for "Source --> Target" patterns.
 * 3. Final fallback: infer source/target via geometric proximity to node centers.
 */
export function resolveEdgeKey(edgeElement, nodeCenterLookup = []) {
    // Custom engine: data attributes for direct O(1) resolution
    const sourceAttr = edgeElement.getAttribute('data-source');
    const targetAttr = edgeElement.getAttribute('data-target');
    if (sourceAttr && targetAttr) return `${sourceAttr}->${targetAttr}`;

    const edgePath = edgeElement.querySelector('path');

    const classTokens = `${edgeElement.getAttribute('class') ?? ''} ${edgePath?.getAttribute('class') ?? ''}`;
    const sourceClassMatch = classTokens.match(/(?:^|\s)LS-([A-Za-z0-9_\-]+)(?=\s|$)/);
    const targetClassMatch = classTokens.match(/(?:^|\s)LE-([A-Za-z0-9_\-]+)(?=\s|$)/);

    if (sourceClassMatch && targetClassMatch) {
        const sourceCode = normalizeCourseCode(sourceClassMatch[1]);
        const targetCode = normalizeCourseCode(targetClassMatch[1]);
        if (sourceCode && targetCode) return `${sourceCode}->${targetCode}`;
    }

    const rawCandidates = [
        edgeElement.id,
        edgePath?.id,
        edgeElement.getAttribute('aria-label'),
        edgeElement.getAttribute('title'),
        edgePath?.getAttribute('aria-label'),
        edgePath?.getAttribute('title'),
        edgeElement.textContent
    ].filter(Boolean);

    for (const rawCandidate of rawCandidates) {
        const arrowPattern = rawCandidate.match(/^(.+?)\s*-->\s*(.+)$/);
        if (arrowPattern) {
            const sourceCode = normalizeCourseCode(arrowPattern[1]);
            const targetCode = normalizeCourseCode(arrowPattern[2]);
            if (sourceCode && targetCode) return `${sourceCode}->${targetCode}`;
        }

        const extractedCodes = extractCourseCodesFromText(rawCandidate);
        if (extractedCodes.length < 2) continue;

        for (let index = 0; index < extractedCodes.length - 1; index += 1) {
            const sourceCode = extractedCodes[index];
            const targetCode = extractedCodes[index + 1];
            if (isKnownEdge(sourceCode, targetCode)) return `${sourceCode}->${targetCode}`;
        }

        return `${extractedCodes[0]}->${extractedCodes[1]}`;
    }

    if (edgePath && nodeCenterLookup.length > 0) {
        try {
            const totalLength = edgePath.getTotalLength();
            const startPoint = edgePath.getPointAtLength(0);
            const endPoint = edgePath.getPointAtLength(totalLength);

            const startCode = findNearestCourseCode(startPoint, nodeCenterLookup);
            const endCode = findNearestCourseCode(endPoint, nodeCenterLookup);

            if (startCode && endCode && isKnownEdge(startCode, endCode)) {
                return `${startCode}->${endCode}`;
            }
        } catch {
            // Ignore geometry fallback errors.
        }
    }

    return null;
}
