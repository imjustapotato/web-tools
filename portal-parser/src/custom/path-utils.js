/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/** SVG path builders shared between renderer and animation controller — avoids circular imports */

/**
 * Smooth SVG path through dagre's bend-point array using quadratic bezier.
 * Each interior point acts as a control point whose curve passes through the
 * midpoint to the next point, eliminating sharp kinks.
 */
export function buildSmoothPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

    const [first, ...rest] = points;
    const last = rest[rest.length - 1];
    const interior = rest.slice(0, -1);

    const curves = interior.map((point, index) => {
        const nextPoint = rest[index + 1];
        const midX = (point.x + nextPoint.x) / 2;
        const midY = (point.y + nextPoint.y) / 2;
        return `Q${point.x},${point.y} ${midX},${midY}`;
    });

    return [`M${first.x},${first.y}`, ...curves, `L${last.x},${last.y}`].join(' ');
}

/** Builds reversed smooth path — used to draw edges from selected node outward toward prereqs */
export function buildReversedSmoothPath(points) {
    return buildSmoothPath([...points].reverse());
}

/**
 * Finds the point on `from` rectangle's border along the ray toward `to`.
 * Used when a node is dragged: connected edges redraw as straight lines clipped
 * to node borders so arrowheads land on the boundary.
 */
export function clipSegmentToRect(from, to, halfWidth, halfHeight) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    // Degenerate: centers coincide — nothing to clip against
    if (deltaX === 0 && deltaY === 0) return { x: from.x, y: from.y };

    // Scale the ray so it just reaches the nearest vertical/horizontal border.
    // The smaller scale wins — that's the side the ray exits through.
    const scaleX = deltaX === 0 ? Infinity : halfWidth / Math.abs(deltaX);
    const scaleY = deltaY === 0 ? Infinity : halfHeight / Math.abs(deltaY);
    const scale = Math.min(scaleX, scaleY);

    return {
        x: from.x + deltaX * scale,
        y: from.y + deltaY * scale
    };
}

/** Builds straight edge path between two node geometries, clipped to both borders */
export function buildStraightClippedEdge(sourceGeo, targetGeo) {
    const exit = clipSegmentToRect(sourceGeo, targetGeo, sourceGeo.halfWidth, sourceGeo.halfHeight);
    const entry = clipSegmentToRect(targetGeo, sourceGeo, targetGeo.halfWidth, targetGeo.halfHeight);
    const points = [exit, entry];
    return { points, d: buildSmoothPath(points) };
}
