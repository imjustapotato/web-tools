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

// Padding added to each obstacle corner so routed edges don't hug node borders
const EDGE_OBSTACLE_MARGIN = 12;

/**
 * Slab (parametric) segment-AABB intersection test.
 * Returns true if segment p1→p2 crosses the interior of rect.
 * rect = { x, y, halfWidth, halfHeight } — center + half-extents.
 */
function segmentIntersectsRect(p1, p2, rect) {
    const xMin = rect.x - rect.halfWidth;
    const xMax = rect.x + rect.halfWidth;
    const yMin = rect.y - rect.halfHeight;
    const yMax = rect.y + rect.halfHeight;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let tMin = 0;
    let tMax = 1;

    const clipSlab = (dAxis, axisMin, axisMax, start) => {
        if (Math.abs(dAxis) < 1e-9) return start >= axisMin && start <= axisMax;
        const t1 = (axisMin - start) / dAxis;
        const t2 = (axisMax - start) / dAxis;
        tMin = Math.max(tMin, Math.min(t1, t2));
        tMax = Math.min(tMax, Math.max(t1, t2));
        return tMin <= tMax;
    };

    return clipSlab(dx, xMin, xMax, p1.x) && clipSlab(dy, yMin, yMax, p1.y);
}

/**
 * Dijkstra on an explicit adjacency map.
 * waypoints = [{x,y}], graph = Map<index, [{to, cost}]>
 * Returns an ordered {x,y} array for the shortest path, or null if unreachable.
 */
function shortestPath(waypoints, graph, startIndex, endIndex) {
    const count = waypoints.length;
    const distances = new Array(count).fill(Infinity);
    const previous = new Array(count).fill(-1);
    const visited = new Set();
    distances[startIndex] = 0;

    for (let step = 0; step < count; step++) {
        let current = -1;
        for (let i = 0; i < count; i++) {
            if (!visited.has(i) && distances[i] < (current === -1 ? Infinity : distances[current])) {
                current = i;
            }
        }
        if (current === -1 || distances[current] === Infinity || current === endIndex) break;
        visited.add(current);

        for (const { to, cost } of (graph.get(current) ?? [])) {
            if (!visited.has(to)) {
                const candidate = distances[current] + cost;
                if (candidate < distances[to]) {
                    distances[to] = candidate;
                    previous[to] = current;
                }
            }
        }
    }

    if (distances[endIndex] === Infinity) return null;

    const path = [];
    for (let node = endIndex; node !== -1; node = previous[node]) {
        path.unshift(waypoints[node]);
    }
    return path;
}

/**
 * Like buildStraightClippedEdge, but detours around obstacle rects that the
 * straight path crosses. Uses visibility graph + Dijkstra to find the shortest
 * non-occluding route through padded obstacle corners.
 *
 * Falls back to straight if no detour is found (should not occur in practice).
 *
 * @param {{ x, y, halfWidth, halfHeight }} sourceGeo
 * @param {{ x, y, halfWidth, halfHeight }} targetGeo
 * @param {Array<{ x, y, halfWidth, halfHeight }>} obstacleGeos — every node except source + target
 * @returns {{ points: Array<{x,y}>, d: string }}
 */
export function buildObstacleAwarePath(sourceGeo, targetGeo, obstacleGeos) {
    const exit = clipSegmentToRect(sourceGeo, targetGeo, sourceGeo.halfWidth, sourceGeo.halfHeight);
    const entry = clipSegmentToRect(targetGeo, sourceGeo, targetGeo.halfWidth, targetGeo.halfHeight);

    const blocked = obstacleGeos.filter((obstacle) => segmentIntersectsRect(exit, entry, obstacle));
    if (blocked.length === 0) {
        return { points: [exit, entry], d: buildSmoothPath([exit, entry]) };
    }

    // Padded corners of blocked obstacles become candidate waypoints
    const corners = blocked.flatMap((obstacle) => {
        const px = obstacle.halfWidth + EDGE_OBSTACLE_MARGIN;
        const py = obstacle.halfHeight + EDGE_OBSTACLE_MARGIN;
        return [
            { x: obstacle.x - px, y: obstacle.y - py },
            { x: obstacle.x + px, y: obstacle.y - py },
            { x: obstacle.x - px, y: obstacle.y + py },
            { x: obstacle.x + px, y: obstacle.y + py },
        ];
    });

    const waypoints = [exit, ...corners, entry];
    const lastIndex = waypoints.length - 1;

    // Visibility graph: connect pairs whose segment avoids ALL obstacles
    const graph = new Map(waypoints.map((_, i) => [i, []]));
    for (let i = 0; i < waypoints.length; i++) {
        for (let j = i + 1; j < waypoints.length; j++) {
            if (!obstacleGeos.some((o) => segmentIntersectsRect(waypoints[i], waypoints[j], o))) {
                const cost = Math.hypot(waypoints[j].x - waypoints[i].x, waypoints[j].y - waypoints[i].y);
                graph.get(i).push({ to: j, cost });
                graph.get(j).push({ to: i, cost });
            }
        }
    }

    const path = shortestPath(waypoints, graph, 0, lastIndex);
    if (!path) return { points: [exit, entry], d: buildSmoothPath([exit, entry]) };

    return { points: path, d: buildSmoothPath(path) };
}
