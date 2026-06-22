/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * "By Year/Term" grid layout engine.
 * Positions nodes on a fixed grid (columns = term, rows = year) instead of
 * running dagre's automatic layout. Produces a plain dagre.graphlib.Graph so
 * the existing d3-renderer (renderDagreLayout) can render it unchanged —
 * edge bend points are intentionally left unset here; the caller routes them
 * with obstacle-aware pathfinding after the SVG is in the DOM.
 */
import dagre from '@dagrejs/dagre';
import { getAdjacencyGraph, getCourseTitleMap, getCourseYearTermMap } from '../core/graph-data.js';
import { measureNodeWidth, NODE_HEIGHT } from './dagre-layout.js';

const MARGIN_X = 72; // wide enough to fit a row header label ("Year 1") without crowding the grid
const MARGIN_Y = 72; // wide enough to fit a column header label ("Term 1") without crowding the grid
const COLUMN_GAP = 110; // mirrors dagre's default ranksep, for visual parity with Default mode
const ROW_GAP = 90;
const STACK_GAP = 16;   // vertical gap between courses stacked in the same (year, term) cell
const ROW_LABEL_X = MARGIN_X / 2;  // centered within the left margin band
const COL_LABEL_Y = MARGIN_Y / 2;  // centered within the top margin band

/** Groups course codes by year/term; courses missing either value fall into one "unscheduled" bucket */
function groupCoursesByCell(courseCodes, courseYearTermMap) {
    const realCells = new Map(); // "year-term" -> string[]
    const unscheduledCodes = [];

    courseCodes.forEach((courseCode) => {
        const entry = courseYearTermMap.get(courseCode);
        if (!entry || entry.year == null || entry.term == null) {
            unscheduledCodes.push(courseCode);
            return;
        }

        const cellKey = `${entry.year}-${entry.term}`;
        if (!realCells.has(cellKey)) realCells.set(cellKey, []);
        realCells.get(cellKey).push(courseCode);
    });

    return { realCells, unscheduledCodes };
}

/** Builds a dagre.graphlib.Graph with node positions computed from the year/term grid (no dagre.layout() call) */
export function buildYearTermLayout() {
    const adjacencyGraph = getAdjacencyGraph();
    const courseTitleMap = getCourseTitleMap();
    const courseYearTermMap = getCourseYearTermMap();
    const courseCodes = Array.from(adjacencyGraph.keys());

    const { realCells, unscheduledCodes } = groupCoursesByCell(courseCodes, courseYearTermMap);

    const years = new Set();
    const terms = new Set();
    realCells.forEach((_, cellKey) => {
        const [year, term] = cellKey.split('-').map(Number);
        years.add(year);
        terms.add(term);
    });

    const rowOrder = Array.from(years).sort((a, b) => a - b);
    const colOrder = Array.from(terms).sort((a, b) => a - b);
    const unscheduledRowSlot = unscheduledCodes.length > 0 ? rowOrder.length : -1;

    // Cells keyed by grid slot indices (not raw year/term) so rows/columns with no courses cost no space
    const slotCells = new Map(); // "rowSlot-colSlot" -> string[]
    realCells.forEach((codes, cellKey) => {
        const [year, term] = cellKey.split('-').map(Number);
        const rowSlot = rowOrder.indexOf(year);
        const colSlot = colOrder.indexOf(term);
        slotCells.set(`${rowSlot}-${colSlot}`, [...codes].sort());
    });
    if (unscheduledRowSlot >= 0) {
        slotCells.set(`${unscheduledRowSlot}-0`, [...unscheduledCodes].sort());
    }

    const totalRowSlots = unscheduledRowSlot >= 0 ? rowOrder.length + 1 : rowOrder.length;
    const totalColSlots = Math.max(colOrder.length, 1);

    const nodeWidths = new Map();
    courseCodes.forEach((courseCode) => {
        const title = courseTitleMap.get(courseCode) ?? '';
        nodeWidths.set(courseCode, measureNodeWidth(courseCode, title));
    });
    const columnWidth = Math.max(...nodeWidths.values(), 0);

    // Row heights depend on the tallest stack among that row's cells
    const rowStackCounts = new Array(totalRowSlots).fill(1);
    slotCells.forEach((codes, slotKey) => {
        const rowSlot = Number(slotKey.split('-')[0]);
        rowStackCounts[rowSlot] = Math.max(rowStackCounts[rowSlot], codes.length);
    });
    const rowHeights = rowStackCounts.map((count) => count * NODE_HEIGHT + (count - 1) * STACK_GAP);

    const rowTopY = [];
    let cursorY = MARGIN_Y;
    rowHeights.forEach((height) => {
        rowTopY.push(cursorY);
        cursorY += height + ROW_GAP;
    });
    const totalHeight = cursorY - ROW_GAP + MARGIN_Y;
    const totalWidth = MARGIN_X * 2 + totalColSlots * columnWidth + (totalColSlots - 1) * COLUMN_GAP;

    // Header labels for the grid-headers-layer (d3-renderer draws these in the margin bands).
    // Computed from the same row/col slot math as node placement, so labels always line up.
    const rowHeaders = rowOrder.map((year, rowSlot) => ({
        label: `Year ${year}`,
        x: ROW_LABEL_X,
        y: rowTopY[rowSlot] + rowHeights[rowSlot] / 2
    }));
    if (unscheduledRowSlot >= 0) {
        rowHeaders.push({
            label: 'Unscheduled',
            x: ROW_LABEL_X,
            y: rowTopY[unscheduledRowSlot] + rowHeights[unscheduledRowSlot] / 2
        });
    }
    const colHeaders = colOrder.map((term, colSlot) => ({
        label: `Term ${term}`,
        x: MARGIN_X + colSlot * (columnWidth + COLUMN_GAP) + columnWidth / 2,
        y: COL_LABEL_Y
    }));

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ width: totalWidth, height: totalHeight, marginx: 0, marginy: 0, rowHeaders, colHeaders });
    graph.setDefaultEdgeLabel(() => ({}));

    slotCells.forEach((codes, slotKey) => {
        const [rowSlot, colSlot] = slotKey.split('-').map(Number);
        const cellCenterX = MARGIN_X + colSlot * (columnWidth + COLUMN_GAP) + columnWidth / 2;
        const cellCenterY = rowTopY[rowSlot] + rowHeights[rowSlot] / 2;

        codes.forEach((courseCode, stackIndex) => {
            const offsetY = (stackIndex - (codes.length - 1) / 2) * (NODE_HEIGHT + STACK_GAP);
            const title = courseTitleMap.get(courseCode) ?? '';
            graph.setNode(courseCode, {
                courseCode,
                title,
                x: cellCenterX,
                y: cellCenterY + offsetY,
                width: nodeWidths.get(courseCode),
                height: NODE_HEIGHT
            });
        });
    });

    adjacencyGraph.forEach((nodeData, sourceCode) => {
        nodeData.outgoing.forEach((targetCode) => {
            graph.setEdge(sourceCode, targetCode);
        });
    });

    return graph;
}
