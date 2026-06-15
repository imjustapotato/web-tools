/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Dagre layout engine wrapper.
 * Converts the adjacency graph + title map into a dagre Graph with
 * computed x/y positions for every node and edge bend point set.
 */
import dagre from '@dagrejs/dagre';
import { getAdjacencyGraph, getCourseTitleMap } from '../core/graph-data.js';

const CHAR_WIDTH_PX = 7.2;
const NODE_HEIGHT = 54;
const NODE_MIN_WIDTH = 140;
const NODE_PADDING_X = 28;
const TITLE_MAX_CHARS = 26;

/**
 * Estimates node width from its label content.
 * Dagre needs static dimensions before running layout.
 */
function measureNodeWidth(courseCode, title) {
    const truncatedTitle = title.length > TITLE_MAX_CHARS
        ? `${title.slice(0, TITLE_MAX_CHARS)}…`
        : title;
    const longestLine = Math.max(courseCode.length, truncatedTitle.length);
    return Math.max(NODE_MIN_WIDTH, longestLine * CHAR_WIDTH_PX + NODE_PADDING_X);
}

/**
 * Builds a dagre Graph from the current adjacency graph and course title map,
 * runs the layout algorithm, and returns the positioned graph.
 *
 * @param {object} options - Layout options passed to dagre.
 * @returns {dagre.graphlib.Graph} Positioned graph with node x/y and edge points.
 */
export function buildDagreLayout(options = {}) {
    const {
        rankdir = 'LR',
        ranksep = 110,
        nodesep = 50,
        marginx = 32,
        marginy = 32
    } = options;

    const adjacencyGraph = getAdjacencyGraph();
    const courseTitleMap = getCourseTitleMap();

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir, ranksep, nodesep, marginx, marginy });
    graph.setDefaultEdgeLabel(() => ({}));

    adjacencyGraph.forEach((_, courseCode) => {
        const title = courseTitleMap.get(courseCode) ?? '';
        const width = measureNodeWidth(courseCode, title);
        graph.setNode(courseCode, { courseCode, title, width, height: NODE_HEIGHT });
    });

    adjacencyGraph.forEach((nodeData, sourceCode) => {
        nodeData.outgoing.forEach((targetCode) => {
            graph.setEdge(sourceCode, targetCode);
        });
    });

    dagre.layout(graph);
    return graph;
}
