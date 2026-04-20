import gsap from 'gsap';

const TRAIL_STEP_SECONDS = 0.15;
const EDGE_TRAVEL_SECONDS = 0.35;
const GLOW_SELECTED = 'drop-shadow(0 0 12px #86efac) drop-shadow(0 0 24px rgba(134,239,172,0.9))';
const GLOW_DIRECT = 'drop-shadow(0 0 10px #60a5fa)';
const GLOW_OTHER = 'drop-shadow(0 0 8px #fb923c)';

export function clearAllNodeHighlights(svgElement, { getGraphNodes, getGraphEdges, setNodeGlow, getNodeTextElements }) {
    if (!svgElement) return;

    const allNodes = getGraphNodes(svgElement);
    const allEdges = getGraphEdges(svgElement);

    gsap.killTweensOf(svgElement.querySelectorAll('rect, polygon, circle, ellipse, path, g.node, g.edgePath, text, tspan, span, div'));

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

export function animateNodeSelection(selectedCourseCode, context) {
    const {
        svgElement,
        activeSelectionTimeline,
        collectPrerequisiteChain,
        buildPrerequisiteDistanceMap,
        buildPrerequisiteEdgeDistanceMap,
        getGraphNodes,
        getGraphEdges,
        extractCourseCodeFromNodeElement,
        setNodeGlow,
        getNodeTextElements,
        buildNodeCenterLookup,
        resolveEdgeKey,
        getSafePathLength
    } = context;

    if (!svgElement) return null;

    // Ensure arrowhead marker exists
    if (!svgElement.querySelector('#arrowhead')) {
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

    if (activeSelectionTimeline) {
        activeSelectionTimeline.kill();
    }

    const { visitedNodes, visitedEdges } = collectPrerequisiteChain(selectedCourseCode);
    const nodeDistanceMap = buildPrerequisiteDistanceMap(selectedCourseCode);
    const edgeDistanceMap = buildPrerequisiteEdgeDistanceMap(selectedCourseCode, visitedEdges);

    const allNodes = getGraphNodes(svgElement);
    const allEdges = getGraphEdges(svgElement);

    const tl = gsap.timeline();

    allNodes.forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        const shape = nodeElement.querySelector('rect, polygon, circle, ellipse');
        const textElements = getNodeTextElements(nodeElement);
        if (!shape) return;

        const nodeDistance = nodeDistanceMap.get(courseCode);

        // Unrelated Nodes
        if (!visitedNodes.has(courseCode) || nodeDistance === undefined) {
            nodeElement.classList.remove('node-selected');
            setNodeGlow(shape, 'none');

            tl.set(nodeElement, { opacity: 1 }, 0);

            tl.to(shape, {
                duration: 0.3,
                ease: 'power2.out',
                scale: 1,
                stroke: '#1f2937',
                strokeWidth: 1.6,
                transformOrigin: '50% 50%'
            }, 0);

            if (textElements.length > 0) {
                tl.to(textElements, {
                    duration: 0.3,
                    ease: 'power2.out',
                    color: '#64748b',
                    fill: '#64748b'
                }, 0);
            }
            return;
        }

        // Related Nodes
        const arrivalDelay = nodeDistance <= 0 ? 0 : nodeDistance * TRAIL_STEP_SECONDS;

        let glow = 'none';
        let targetScale = 1;
        let targetStroke = '#5eead4';
        let targetStrokeWidth = 2.1;

        if (nodeDistance === 0) {
            glow = GLOW_SELECTED;
            targetScale = 1.05;
            targetStroke = '#86efac';
            targetStrokeWidth = 3;
        } else if (nodeDistance === 1) {
            glow = GLOW_DIRECT;
            targetScale = 1.02;
            targetStroke = '#60a5fa';
            targetStrokeWidth = 2.4;
        } else {
            glow = GLOW_OTHER;
            targetScale = 1.01;
            targetStroke = '#fb923c';
            targetStrokeWidth = 2.2;
        }

        nodeElement.classList.toggle('node-selected', nodeDistance === 0);

        tl.to(nodeElement, {
            duration: 0.2,
            ease: 'power2.out',
            opacity: 1
        }, 0);

        tl.to(shape, {
            duration: 0.2,
            ease: 'power2.out',
            scale: 1,
            stroke: '#475569',
            strokeWidth: 2,
            transformOrigin: '50% 50%'
        }, 0);

        if (textElements.length > 0) {
            tl.to(textElements, {
                duration: 0.2,
                ease: 'power2.out',
                color: '#ffffff',
                fill: '#ffffff'
            }, 0);
        }

        tl.call(() => {
            setNodeGlow(shape, glow);
        }, null, arrivalDelay);

        tl.to(shape, {
            duration: 0.3,
            ease: 'power2.out',
            scale: targetScale,
            stroke: targetStroke,
            strokeWidth: targetStrokeWidth,
            transformOrigin: '50% 50%'
        }, arrivalDelay);

        // Infinite pulse for selected node
        if (nodeDistance === 0) {
            tl.to(shape, {
                scale: 1.07,
                repeat: -1,
                yoyo: true,
                ease: 'power1.inOut',
                duration: 0.8
            }, arrivalDelay);
        }
    });

    const nodeCenterLookup = buildNodeCenterLookup(svgElement);

    allEdges.forEach((edgeElement) => {
        const edgeKey = resolveEdgeKey(edgeElement, nodeCenterLookup);
        const path = edgeElement.querySelector('path');
        if (!path) return;

        if (edgeKey && visitedEdges.has(edgeKey)) {
            const distance = edgeDistanceMap.get(edgeKey) ?? 0;
            const delay = distance * TRAIL_STEP_SECONDS;

            path.style.pointerEvents = 'auto';

            tl.to(path, {
                duration: 0.3,
                ease: 'power2.out',
                stroke: '#60a5fa',
                strokeWidth: 2.8,
                opacity: 1
            }, delay);

            tl.call(() => {
                path.style.filter = 'drop-shadow(0 0 5px #60a5fa)';
            }, null, delay);
        } else {
            path.style.filter = 'none';
            path.style.pointerEvents = 'none';
            // Unrelated edges keep default appearance
            tl.set(path, { opacity: 1, stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: 'none', strokeDashoffset: 0 }, 0);
        }
    });

    return tl;
}
