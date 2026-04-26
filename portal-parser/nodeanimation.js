/**
 * Manages graph animations using GSAP.
 * Visualizes course dependencies and selection states for clear feedback.
 */
import gsap from 'gsap';

/* 1. Animation Constants & Tokens */
const TRAIL_STEP_SECONDS = 0.15;
const GLOW_SELECTED = 'drop-shadow(0 0 12px #86efac) drop-shadow(0 0 24px rgba(134,239,172,0.9))';
const GLOW_DIRECT = 'drop-shadow(0 0 10px #60a5fa)';
const GLOW_OTHER = 'drop-shadow(0 0 8px #fb923c)';

/* 2. Global Reset Logic */
/**
 * Resets the graph to its default visual state.
 * Prevents animation artifacts when switching selections.
 */
export function clearAllNodeHighlights(svgElement, { getGraphNodes, getGraphEdges, setNodeGlow, getNodeTextElements }) {
    if (!svgElement) return;

    const allNodes = getGraphNodes(svgElement);
    const allEdges = getGraphEdges(svgElement);

    gsap.killTweensOf(svgElement.querySelectorAll('rect, polygon, circle, ellipse, path, g.node, g.edgePath, text, tspan, span, div'));

    // Reset nodes and shapes
    allNodes.forEach((nodeElement) => {
        nodeElement.classList.remove('node-selected');
        const shape = nodeElement.querySelector('rect, polygon, circle, ellipse');
        const textElements = getNodeTextElements(nodeElement);

        if (shape) {
            setNodeGlow(shape, 'none');
            gsap.to(shape, {
                duration: 0.3,
                ease: 'power2.out',
                scale: 1,
                stroke: '#334155',
                strokeWidth: 2,
                transformOrigin: '50% 50%'
            });
        }

        gsap.to(nodeElement, {
            duration: 0.3,
            ease: 'power2.out',
            opacity: 1
        });

        if (textElements.length > 0) {
            gsap.to(textElements, {
                duration: 0.3,
                ease: 'power2.out',
                color: '#f8fafc',
                fill: '#f8fafc'
            });
        }
    });

    // Reset edge paths
    allEdges.forEach((edgeElement) => {
        const path = edgeElement.querySelector('path');
        if (path) {
            path.style.filter = 'none';
            path.style.pointerEvents = 'auto';
            gsap.to(path, {
                duration: 0.3,
                ease: 'power2.out',
                opacity: 1,
                stroke: '#94a3b8',
                strokeWidth: 1.5,
                strokeDasharray: 'none',
                strokeDashoffset: 0
            });
        }
    });
}

/* 3. Selection Orchestration */
/**
 * Animates the prerequisite hierarchy for a selected course.
 * Uses staggered delays to show the directional flow of dependencies.
 */
export function animateNodeSelection(selectedCourseCode, context) {
    const { svgElement, activeSelectionTimeline } = context;
    if (!svgElement) return null;

    ensureArrowheadMarkerExists(svgElement);

    if (activeSelectionTimeline) {
        activeSelectionTimeline.kill();
    }

    const { visitedNodes, visitedEdges } = context.collectPrerequisiteChain(selectedCourseCode);
    const nodeDistanceMap = context.buildPrerequisiteDistanceMap(selectedCourseCode);
    const edgeDistanceMap = context.buildPrerequisiteEdgeDistanceMap(selectedCourseCode, visitedEdges);

    const timeline = gsap.timeline();
    const allNodes = context.getGraphNodes(svgElement);
    const allEdges = context.getGraphEdges(svgElement);

    // Step 1: Animate node selection and glow
    animateNodesInChain(allNodes, timeline, {
        ...context,
        visitedNodes,
        nodeDistanceMap
    });

    // Step 2: Animate directional edge highlights
    animateEdgesInChain(allEdges, timeline, {
        ...context,
        visitedEdges,
        edgeDistanceMap,
        nodeCenterLookup: context.buildNodeCenterLookup(svgElement)
    });

    return timeline;
}

/* 4. SVG Marker Utilities */
/**
 * Ensures SVG markers exist for edge arrowheads.
 * Keeps marker setup isolated from animation logic.
 */
function ensureArrowheadMarkerExists(svgElement) {
    if (svgElement.querySelector('#arrowhead')) return;

    const defs = svgElement.querySelector('defs') || (() => {
        const d = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.prepend(d);
        return d;
    })();

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.id = 'arrowhead';
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,7 L9,3.5 z');
    path.setAttribute('fill', '#60a5fa');
    marker.appendChild(path);
    defs.appendChild(marker);
}

/* 5. Node State Management */
/**
 * Transforms nodes based on their role in the current selection.
 * Distinguishes between active chain members and background nodes.
 */
function animateNodesInChain(nodes, timeline, context) {
    const { 
        visitedNodes, 
        nodeDistanceMap, 
        extractCourseCodeFromNodeElement, 
        getNodeTextElements, 
        setNodeGlow 
    } = context;

    nodes.forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        const shape = nodeElement.querySelector('rect, polygon, circle, ellipse');
        const textElements = getNodeTextElements(nodeElement);
        if (!shape) return;

        const distance = nodeDistanceMap.get(courseCode);

        if (!visitedNodes.has(courseCode) || distance === undefined) {
            applyBackgroundNodeState(nodeElement, shape, textElements, timeline, setNodeGlow);
            return;
        }

        applyActiveNodeState(nodeElement, shape, textElements, timeline, distance, setNodeGlow);
    });
}

/**
 * Dims nodes outside the active prerequisite chain.
 * Reduces visual noise to focus on the selected path.
 */
function applyBackgroundNodeState(nodeElement, shape, textElements, timeline, setNodeGlow) {
    nodeElement.classList.remove('node-selected');
    setNodeGlow(shape, 'none');

    timeline.set(nodeElement, { opacity: 1 }, 0);
    timeline.to(shape, {
        duration: 0.3,
        ease: 'power2.out',
        scale: 1,
        stroke: '#1f2937',
        strokeWidth: 1.6,
        transformOrigin: '50% 50%'
    }, 0);

    if (textElements.length > 0) {
        timeline.to(textElements, {
            duration: 0.3,
            ease: 'power2.out',
            color: '#64748b',
            fill: '#64748b'
        }, 0);
    }
}

/**
 * Highlights nodes within the active chain.
 * Staggers animations based on distance to simulate dependency flow.
 */
function applyActiveNodeState(nodeElement, shape, textElements, timeline, distance, setNodeGlow) {
    const arrivalDelay = distance <= 0 ? 0 : distance * TRAIL_STEP_SECONDS;
    const config = getActiveNodeVisualConfig(distance);

    nodeElement.classList.toggle('node-selected', distance === 0);

    timeline.to(nodeElement, { duration: 0.2, opacity: 1 }, 0);
    timeline.to(shape, {
        duration: 0.2,
        stroke: '#475569',
        strokeWidth: 2,
        transformOrigin: '50% 50%'
    }, 0);

    if (textElements.length > 0) {
        timeline.to(textElements, { duration: 0.2, color: '#ffffff', fill: '#ffffff' }, 0);
    }

    timeline.call(() => setNodeGlow(shape, config.glow), null, arrivalDelay);
    
    timeline.to(shape, {
        duration: 0.3,
        ease: 'power2.out',
        scale: config.scale,
        stroke: config.stroke,
        strokeWidth: config.strokeWidth,
        transformOrigin: '50% 50%'
    }, arrivalDelay);

    if (distance === 0) {
        timeline.to(shape, {
            scale: 1.07,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
            duration: 0.8
        }, arrivalDelay);
    }
}

/**
 * Returns specific visual tokens based on the node's proximity to the selection.
 */
function getActiveNodeVisualConfig(distance) {
    if (distance === 0) {
        return { glow: GLOW_SELECTED, scale: 1.05, stroke: '#86efac', strokeWidth: 3 };
    }
    if (distance === 1) {
        return { glow: GLOW_DIRECT, scale: 1.02, stroke: '#60a5fa', strokeWidth: 2.4 };
    }
    return { glow: GLOW_OTHER, scale: 1.01, stroke: '#fb923c', strokeWidth: 2.2 };
}

/* 6. Edge State Management */
/**
 * Animates edges to illustrate the direction of dependency.
 */
function animateEdgesInChain(edges, timeline, context) {
    const { visitedEdges, edgeDistanceMap, resolveEdgeKey, nodeCenterLookup } = context;

    edges.forEach((edgeElement) => {
        const edgeKey = resolveEdgeKey(edgeElement, nodeCenterLookup);
        const path = edgeElement.querySelector('path');
        if (!path) return;

        if (edgeKey && visitedEdges.has(edgeKey)) {
            const distance = edgeDistanceMap.get(edgeKey) ?? 0;
            const delay = distance * TRAIL_STEP_SECONDS;

            path.style.pointerEvents = 'auto';
            timeline.to(path, {
                duration: 0.3,
                ease: 'power2.out',
                stroke: '#60a5fa',
                strokeWidth: 2.8,
                opacity: 1
            }, delay);

            timeline.call(() => {
                path.style.filter = 'drop-shadow(0 0 5px #60a5fa)';
            }, null, delay);
        } else {
            applyBackgroundEdgeState(path, timeline);
        }
    });
}

/**
 * Resets edges that are not part of the active path to a neutral state.
 */
function applyBackgroundEdgeState(path, timeline) {
    path.style.filter = 'none';
    path.style.pointerEvents = 'none';
    timeline.set(path, { 
        opacity: 1, 
        stroke: '#94a3b8', 
        strokeWidth: 1.5, 
        strokeDasharray: 'none', 
        strokeDashoffset: 0 
    }, 0);
}
