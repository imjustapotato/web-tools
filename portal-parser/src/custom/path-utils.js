/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * SVG path builders shared between the renderer and the animation controller.
 * Keeping these here avoids circular imports between d3-renderer and animation-controller.
 */

/**
 * Builds a smooth SVG path through dagre's bend-point array using quadratic
 * bezier curves. Each interior point acts as a control point whose curve passes
 * through the midpoint to the next point, eliminating sharp kinks.
 *
 * Technique: quadratic bezier through-midpoints
 *   - M  first point
 *   - Q  Pi  midpoint(Pi, Pi+1)   for each interior point
 *   - L  last point  (straight segment ensures arrowhead lands at the exact target)
 *
 * @param {Array<{x: number, y: number}>} points - Raw bend points from dagre.
 * @returns {string} SVG path d attribute value.
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

/**
 * Builds a smooth path with the point order reversed.
 * Used by the animation controller to draw edges from the selected node
 * outward toward prerequisite nodes.
 *
 * @param {Array<{x: number, y: number}>} points - Raw bend points from dagre.
 * @returns {string} SVG path d attribute value, drawn in reverse direction.
 */
export function buildReversedSmoothPath(points) {
    return buildSmoothPath([...points].reverse());
}
