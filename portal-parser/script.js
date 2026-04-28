/**
 * Application orchestrator.
 * Manages file ingestion, heuristic parsing, Mermaid rendering, and navigation.
 */
import mermaid from 'mermaid';
import gsap from 'gsap';
import { clearAllNodeHighlights, animateNodeSelection } from './nodeanimation.js';
import { PRESET_CURRICULA, CURRICULA_CREDITS } from './presets.js';

/* 1. Global App Config & State */
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        darkMode: true,
        background: '#0f172a',
        primaryColor: '#1e293b',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#334155',
        lineColor: '#94a3b8',
        fontFamily: 'Inter, sans-serif'
    }
});

window.mermaid = mermaid;

let mermaidRawCode = '';
let selectedNodeId = null;
let activeSelectionTimeline = null;
let isViewTransitioning = false;

// Adjacency graph: Map<courseCode, { incoming: Set<courseCode>, outgoing: Set<courseCode> }>
let adjacencyGraph = new Map();
let courseTitleMap = new Map();

/* 2. File Ingestion (Dropzone & Input) */
const dropzone = document.getElementById('dropzone');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.mhtml,.html,.htm';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
});

dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

/**
 * Processes HTML and MHTML exports.
 * Handles encoding (Base64/Quoted-Printable) to extract the raw course table.
 */
async function handleFile(file) {
    const text = await file.text();
    let rawHtml = text;

    const htmlPartMatch = text.match(/Content-Type:\s*text\/html([\s\S]*?)(?=\r?\n------MultipartBoundary|\r?\n--[a-zA-Z0-9=_-]+--|$)/i);

    if (htmlPartMatch) {
        const headersAndBody = htmlPartMatch[1];
        const splitRegex = /\r?\n\r?\n([\s\S]*)/;
        const bodyMatch = headersAndBody.match(splitRegex);

        if (bodyMatch) {
            rawHtml = bodyMatch[1];
            if (headersAndBody.match(/Content-Transfer-Encoding:\s*base64/i)) {
                rawHtml = atob(rawHtml.replace(/[^A-Za-z0-9+/=]/g, ''));
            } else if (headersAndBody.match(/Content-Transfer-Encoding:\s*quoted-printable/i)) {
                rawHtml = rawHtml.replace(/=\r?\n/g, '');
                rawHtml = rawHtml.replace(/=([A-F0-9]{2})/ig, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
            }
        }
    }

    parseAndRender(rawHtml);
}

/* 3. Curriculum Presets */
const presetButtonsContainer = document.getElementById('preset-buttons');
const creditTooltip = document.createElement('div');
creditTooltip.className = 'credit-tooltip';
document.body.appendChild(creditTooltip);

let creditTooltipTimeout = null;

/**
 * Initializes degree templates.
 * Provides quick access to common curriculum structures.
 */
function buildPresetButtons() {
    PRESET_CURRICULA.forEach((preset) => {
        const button = document.createElement('button');
        button.id = `preset-${preset.id}`;
        button.className = 'btn btn-preset';
        button.type = 'button';
        button.textContent = preset.label;
        button.addEventListener('click', () => loadPresetCurriculum(preset, button));
        
        // Hover Tooltip for Credits
        button.addEventListener('mouseenter', () => {
            const credit = CURRICULA_CREDITS[preset.id] || 'Contributor';
            showCreditTooltip(credit, button);
        });

        button.addEventListener('mouseleave', () => {
            hideCreditTooltip();
        });

        presetButtonsContainer.appendChild(button);
    });
}

function showCreditTooltip(credit, targetEl) {
    if (creditTooltipTimeout) {
        clearTimeout(creditTooltipTimeout);
        creditTooltipTimeout = null;
    }
    
    creditTooltip.textContent = `Data provided by: ${credit}`;
    creditTooltip.classList.add('visible');
    
    // Position the tooltip centered below the button
    const rect = targetEl.getBoundingClientRect();
    const tooltipX = rect.left + window.scrollX + (rect.width / 2);
    const tooltipY = rect.bottom + window.scrollY + 8;
    
    creditTooltip.style.left = `${tooltipX}px`;
    creditTooltip.style.top = `${tooltipY}px`;
}

function hideCreditTooltip() {
    creditTooltip.classList.remove('visible');
    if (creditTooltipTimeout) {
        clearTimeout(creditTooltipTimeout);
        creditTooltipTimeout = null;
    }
}

async function loadPresetCurriculum(preset, button) {
    button.classList.add('is-loading');
    button.disabled = true;

    try {
        await renderMermaidCode(preset.content.trim());
    } catch (error) {
        console.error('Preset load error:', error);
        container.innerHTML = `<p class="status-message status-message--error">Failed to load preset curriculum.</p>`;
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

/* 4. Course Table Parser (Heuristic Parsing) */
/**
 * Extracts course data from HTML.
 * Uses heuristic column detection for robustness across portal versions.
 */
async function parseAndRender(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let codeColumnIndex = 0;
    let titleColumnIndex = 1;
    let prerequisiteColumnIndex = 4;

    const headers = Array.from(doc.querySelectorAll('th')).map((th) => th.innerText.trim().toUpperCase());
    headers.forEach((header, index) => {
        if (header.includes('CODE')) {
            codeColumnIndex = index;
        }
        if (header.includes('TITLE') || header.includes('DESCRIPTION')) {
            titleColumnIndex = index;
        }
        if (header.includes('PRE-REQUISITE') || header.includes('PREREQUISITE')) {
            prerequisiteColumnIndex = index;
        }
    });

    const courses = [];
    const rows = Array.from(doc.querySelectorAll('tr'));

    rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) => td.innerText.trim());
        if (cells.length > Math.max(codeColumnIndex, titleColumnIndex, prerequisiteColumnIndex)) {
            const code = cells[codeColumnIndex];
            const title = cells[titleColumnIndex];
            const prerequisitesRaw = cells[prerequisiteColumnIndex];

            if (/^[A-Z]{2,4}\s*\d{2,4}[A-Z]?$/.test(code)) {
                const cleanCode = code.replace(/\s+/g, '');
                const prerequisiteMatches = prerequisitesRaw.match(/[A-Z]{2,4}\s*\d{2,4}[A-Z]?/g);
                const prerequisites = prerequisiteMatches ? prerequisiteMatches.map((p) => p.replace(/\s+/g, '')) : [];
                courses.push({ code: cleanCode, title, prerequisites });
            }
        }
    });

    if (courses.length === 0) {
        container.innerHTML = '<p class="status-message status-message--error">Error: Couldn\'t extract course data. Ensure this is a valid portal HTML/MHTML export.</p>';
        return;
    }

    courseTitleMap = new Map(courses.map((course) => [course.code, course.title]));

    let mermaidCode = 'graph LR\n';
    mermaidCode += 'classDef default fill:#1e293b,stroke:#334155,stroke-width:2px,color:#f8fafc,rx:8,ry:8;\n';

    courses.forEach((course) => {
        const safeTitle = course.title.replace(/["[\]()]/g, '');
        mermaidCode += `${course.code}["${course.code}<br/>${safeTitle}"]\n`;
        course.prerequisites.forEach((prerequisite) => {
            mermaidCode += `${prerequisite} --> ${course.code}\n`;
        });
    });

    await renderMermaidCode(mermaidCode);
}

// Expose to window for the Companion Extension hook
window.parseAndRender = parseAndRender;

/* 5. Mermaid Rendering Engine */
const container = document.getElementById('graph-container');
const controls = document.getElementById('controls');

/**
 * Renders Mermaid syntax into an interactive SVG graph.
 * Builds the logical adjacency map once the SVG is available in the DOM.
 */
async function renderMermaidCode(mermaidCode) {
    mermaidRawCode = mermaidCode;
    controls.classList.remove('is-hidden');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';
    selectedNodeId = null;
    adjacencyGraph = new Map();

    if (courseTitleMap.size === 0) {
        courseTitleMap = extractCourseTitleMapFromMermaid(mermaidCode);
    }

    try {
        const { svg } = await window.mermaid.render('mermaid-svg', mermaidCode);
        container.innerHTML = svg;
        resetZoom();
        buildAdjacencyGraph();
        attachNodeClickListeners();
    } catch (err) {
        console.error('Mermaid error:', err);
        container.innerHTML = '<p class="status-message status-message--error">Failed to render graph visually. You can still copy the raw code.</p>';
    }
}

function extractCourseTitleMapFromMermaid(mermaidCode) {
    const titleMap = new Map();
    const nodePattern = /^([A-Z]{2,4}\d{2,4}[A-Z]?)\["(?:\1)<br\/?>(.+)"\]$/gm;
    let nodeMatch;

    while ((nodeMatch = nodePattern.exec(mermaidCode)) !== null) {
        const code = normalizeCourseCode(nodeMatch[1]);
        const title = nodeMatch[2]?.replace(/<[^>]+>/g, '').trim() ?? '';
        if (code && title) {
            titleMap.set(code, title);
        }
    }

    return titleMap;
}

function getCourseDisplayLabel(courseCode) {
    const courseTitle = courseTitleMap.get(courseCode);
    if (!courseTitle) {
        return courseCode;
    }

    return `${courseCode} - ${courseTitle}`;
}

/* 6. Graph Analysis (Adjacency & Traversal) */
function normalizeCourseCode(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') {
        return null;
    }

    const normalizedValue = rawValue.replace(/\s+/g, '').toUpperCase();
    const match = normalizedValue.match(/([A-Z]{2,4}\d{2,4}[A-Z]?)/);
    return match ? match[1] : null;
}

function extractCourseCodesFromText(rawText) {
    if (!rawText) {
        return [];
    }

    const allMatches = rawText.toUpperCase().match(/[A-Z]{2,4}\s*\d{2,4}[A-Z]?/g);
    if (!allMatches) {
        return [];
    }

    return allMatches
        .map((value) => normalizeCourseCode(value))
        .filter(Boolean);
}

function extractCourseCodeFromNodeId(svgNodeId) {
    if (!svgNodeId) {
        return null;
    }

    // Mermaid IDs vary across versions. Prefer explicit flowchart patterns first.
    const flowchartMatch = svgNodeId.match(/flowchart-([A-Za-z0-9_\-]+)-\d+$/i);
    if (flowchartMatch) {
        const normalized = normalizeCourseCode(flowchartMatch[1]);
        if (normalized) {
            return normalized;
        }
    }

    const extractedFromId = extractCourseCodesFromText(svgNodeId);
    return extractedFromId.length > 0 ? extractedFromId[0] : null;
}

function extractCourseCodeFromNodeElement(nodeElement) {
    const fromId = extractCourseCodeFromNodeId(nodeElement?.id ?? '');
    if (fromId) {
        return fromId;
    }

    const labelElement = nodeElement?.querySelector('span.nodeLabel, .nodeLabel, text, tspan, foreignObject');
    const fromLabel = normalizeCourseCode(labelElement?.textContent ?? '');
    return fromLabel;
}

function getGraphNodes(svgElement) {
    const nodeCandidates = svgElement.querySelectorAll('g.node, g[class*="node"]');
    return Array.from(nodeCandidates).filter((nodeElement) => {
        return Boolean(nodeElement.querySelector('rect, polygon, circle, ellipse'));
    });
}

function getGraphEdges(svgElement) {
    const edgeCandidates = svgElement.querySelectorAll('g.edge, g.edgePath, g[class*="edge"], g[id^="L-"], g[id^="L_"]');
    const uniqueEdges = new Set();

    Array.from(edgeCandidates).forEach((edgeElement) => {
        if (edgeElement.querySelector('path')) {
            uniqueEdges.add(edgeElement);
        }
    });

    return Array.from(uniqueEdges);
}

/**
 * Builds a map of course relationships.
 * Parses raw Mermaid code for accurate dependency tracking.
 */
function buildAdjacencyGraph() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) {
        return;
    }

    // Register every node
    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (courseCode && !adjacencyGraph.has(courseCode)) {
            adjacencyGraph.set(courseCode, { incoming: new Set(), outgoing: new Set() });
        }
    });

    // Parse edges from the Mermaid code directly (most reliable source of truth)
    const edgePattern = /^(\S+)\s+-->\s+(\S+)/gm;
    let edgeMatch;
    while ((edgeMatch = edgePattern.exec(mermaidRawCode)) !== null) {
        const sourceCode = normalizeCourseCode(edgeMatch[1]);
        const targetCode = normalizeCourseCode(edgeMatch[2]);

        if (!sourceCode || !targetCode) {
            continue;
        }

        if (!adjacencyGraph.has(sourceCode)) {
            adjacencyGraph.set(sourceCode, { incoming: new Set(), outgoing: new Set() });
        }
        if (!adjacencyGraph.has(targetCode)) {
            adjacencyGraph.set(targetCode, { incoming: new Set(), outgoing: new Set() });
        }

        adjacencyGraph.get(sourceCode).outgoing.add(targetCode);
        adjacencyGraph.get(targetCode).incoming.add(sourceCode);
    }
}

// Prerequisite Traversal (incoming edges only)
/**
 * Traverses upwards from a node to find all ancestors (prerequisites).
 */
function collectPrerequisiteChain(startCode) {
    const visitedNodes = new Set();
    const visitedEdges = new Set();

    visitedNodes.add(startCode);

    const visitedInTraversal = new Set([startCode]);
    const stack = [startCode];

    while (stack.length > 0) {
        const currentCode = stack.pop();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) {
            continue;
        }

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

function buildPrerequisiteDistanceMap(startCode) {
    const distanceMap = new Map();
    const queue = [{ code: startCode, distance: 0 }];
    const visitedCodes = new Set([startCode]);

    distanceMap.set(startCode, 0);

    while (queue.length > 0) {
        const { code: currentCode, distance } = queue.shift();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) {
            continue;
        }

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

function getOrderedPrerequisiteList(startCode) {
    const distanceMap = buildPrerequisiteDistanceMap(startCode);
    return Array.from(distanceMap.entries())
        .filter(([courseCode, distance]) => courseCode !== startCode && distance > 0)
        .sort((left, right) => {
            if (left[1] !== right[1]) {
                return left[1] - right[1];
            }
            return left[0].localeCompare(right[0]);
        });
}

/* 7. Interaction & Selection */
function attachNodeClickListeners() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) {
        return;
    }

    getGraphNodes(svgElement).forEach((nodeElement) => {
        nodeElement.style.cursor = 'pointer';
        nodeElement.addEventListener('click', handleNodeClick);
    });
}

/**
 * Handles node selection on click.
 * Ignored during panning to prevent accidental triggers.
 */
function handleNodeClick(event) {
    event.stopPropagation();

    // Ignore if the user was panning
    if (didPan) {
        return;
    }

    const nodeElement = event.currentTarget;
    const courseCode = extractCourseCodeFromNodeElement(nodeElement);
    if (!courseCode) {
        console.warn('[Tree Animation] Unable to resolve course code for clicked node:', nodeElement?.id ?? '(no id)');
        return;
    }

    if (selectedNodeId === courseCode) {
        clearAllHighlights();
        return;
    }

    selectedNodeId = courseCode;

    if (!isFullView) {
        fullViewBtn.click();
    }
    openSummaryDock();

    activeSelectionTimeline = animateNodeSelection(courseCode, {
        svgElement: container.querySelector('svg'),
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
    });
}

function clearAllHighlights() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    clearAllNodeHighlights(svgElement, { getGraphNodes, getGraphEdges, setNodeGlow, getNodeTextElements });
    selectedNodeId = null;
    closeSummaryDock();
}

/* 8. Edge Resolution Fallback */
function setNodeGlow(shapeElement, glowFilter) {
    if (!shapeElement) {
        return;
    }

    shapeElement.style.filter = glowFilter;
}

function getNodeTextElements(nodeElement) {
    return nodeElement.querySelectorAll('text, tspan, span.nodeLabel, div.nodeLabel');
}

function getSafePathLength(pathElement) {
    if (!pathElement) {
        return 300;
    }

    let pathLength = 0;
    try {
        pathLength = pathElement.getTotalLength?.() ?? 0;
    } catch (error) {
        pathLength = 0;
    }

    if (pathLength > 50) {
        return pathLength;
    }

    try {
        const bbox = pathElement.getBBox?.();
        if (bbox) {
            const diagonal = Math.sqrt((bbox.width ** 2) + (bbox.height ** 2));
            if (diagonal > 50) {
                return diagonal;
            }
        }
    } catch (error) {
        // Ignore bbox fallback failures and use default.
    }

    return 300;
}

function isKnownEdge(sourceCode, targetCode) {
    return Boolean(adjacencyGraph.get(sourceCode)?.outgoing.has(targetCode));
}

// Edge Key Resolution
function buildNodeCenterLookup(svgElement) {
    const lookup = [];
    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (!courseCode) {
            return;
        }

        const box = nodeElement.getBBox?.();
        if (!box) {
            return;
        }

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
 * 1. Check LS-/LE- class tokens (standard Mermaid flowchart).
 * 2. Check IDs/Labels for "Source --> Target" patterns.
 * 3. Final fallback: Infer source/target via geometric proximity to node centers.
 */
function resolveEdgeKey(edgeElement, nodeCenterLookup = []) {
    const edgePath = edgeElement.querySelector('path');

    // Mermaid often exposes source/target through LS-/LE- class tokens.
    const classTokens = `${edgeElement.getAttribute('class') ?? ''} ${edgePath?.getAttribute('class') ?? ''}`;
    const sourceClassMatch = classTokens.match(/(?:^|\s)LS-([A-Za-z0-9_\-]+)(?=\s|$)/);
    const targetClassMatch = classTokens.match(/(?:^|\s)LE-([A-Za-z0-9_\-]+)(?=\s|$)/);

    if (sourceClassMatch && targetClassMatch) {
        const sourceCode = normalizeCourseCode(sourceClassMatch[1]);
        const targetCode = normalizeCourseCode(targetClassMatch[1]);
        if (sourceCode && targetCode) {
            return `${sourceCode}->${targetCode}`;
        }
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
            if (sourceCode && targetCode) {
                return `${sourceCode}->${targetCode}`;
            }
        }

        const extractedCodes = extractCourseCodesFromText(rawCandidate);
        if (extractedCodes.length < 2) {
            continue;
        }

        for (let index = 0; index < extractedCodes.length - 1; index += 1) {
            const sourceCode = extractedCodes[index];
            const targetCode = extractedCodes[index + 1];

            if (isKnownEdge(sourceCode, targetCode)) {
                return `${sourceCode}->${targetCode}`;
            }
        }

        return `${extractedCodes[0]}->${extractedCodes[1]}`;
    }

    // Final fallback: infer source/target using path start/end proximity to node centers.
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
        } catch (error) {
            // Ignore geometry fallback errors.
        }
    }

    return null;
}

function buildPrerequisiteEdgeDistanceMap(startCode, visitedEdges) {
    const distanceMap = new Map();
    const queue = [{ code: startCode, distance: 0 }];
    const visitedCodes = new Set([startCode]);

    while (queue.length > 0) {
        const { code: currentCode, distance } = queue.shift();
        const nodeData = adjacencyGraph.get(currentCode);
        if (!nodeData) {
            continue;
        }

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

/* 9. Summary Dock */
const summaryDock = document.getElementById('summary-dock');
const summarySubjectDock = document.getElementById('summary-subject-dock');
const summaryListDock = document.getElementById('summary-list-dock');
const summaryExpandBtn = document.getElementById('summary-expand-btn');
const summaryIndirectContainer = document.getElementById('summary-indirect-container');
const summaryIndirectListDock = document.getElementById('summary-indirect-list-dock');

let isSummaryExpanded = false;

/**
 * Generates the text-based prerequisite summary for the side dock.
 * Categorizes dependencies into direct and indirect for clarity.
 */
function renderSummaryContent(subjectElement, listElement, selectedCode) {
    subjectElement.textContent = `Selected Subject: ${getCourseDisplayLabel(selectedCode)}`;
    listElement.innerHTML = '';
    summaryIndirectListDock.innerHTML = '';

    const directPrerequisites = Array.from(adjacencyGraph.get(selectedCode)?.incoming ?? []).sort();

    const { visitedNodes } = collectPrerequisiteChain(selectedCode);
    const indirectPrerequisites = Array.from(visitedNodes)
        .filter(code => code !== selectedCode && !directPrerequisites.includes(code))
        .sort();

    if (directPrerequisites.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'summary-item is-empty';
        emptyItem.textContent = 'No prerequisites required.';
        listElement.appendChild(emptyItem);
    } else {
        directPrerequisites.forEach((courseCode) => {
            const item = document.createElement('li');
            item.className = 'summary-item';
            item.textContent = getCourseDisplayLabel(courseCode);
            listElement.appendChild(item);
        });
    }

    if (indirectPrerequisites.length > 0) {
        summaryExpandBtn.classList.remove('is-hidden');
        indirectPrerequisites.forEach((courseCode) => {
            const item = document.createElement('li');
            item.className = 'summary-item';
            item.textContent = getCourseDisplayLabel(courseCode);
            summaryIndirectListDock.appendChild(item);
        });
    } else {
        summaryExpandBtn.classList.add('is-hidden');
    }

    isSummaryExpanded = false;
    summaryExpandBtn.textContent = 'Expand';
    summaryIndirectContainer.classList.add('is-hidden');
}

summaryExpandBtn.addEventListener('click', () => {
    isSummaryExpanded = !isSummaryExpanded;
    if (isSummaryExpanded) {
        summaryIndirectContainer.classList.remove('is-hidden');
        summaryExpandBtn.textContent = 'Collapse';
    } else {
        summaryIndirectContainer.classList.add('is-hidden');
        summaryExpandBtn.textContent = 'Expand';
    }
});

function openSummaryDock() {
    if (!selectedNodeId) {
        summarySubjectDock.textContent = 'Select a subject first to see required prerequisites.';
        summaryListDock.innerHTML = '';
        const emptyItem = document.createElement('li');
        emptyItem.className = 'summary-item is-empty';
        emptyItem.textContent = 'No selected subject yet.';
        summaryListDock.appendChild(emptyItem);
    } else {
        renderSummaryContent(summarySubjectDock, summaryListDock, selectedNodeId);
    }

    summaryDock.classList.remove('is-hidden');
}

function closeSummaryDock() {
    summaryDock.classList.add('is-hidden');
}

/* 10. Pan & Zoom Logic */
const wrapper = document.getElementById('graph-wrapper');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

let scale = 1;
let pointX = 0;
let pointY = 0;
let startX = 0;
let startY = 0;
let panning = false;
let didPan = false;

/**
 * Applies zoom and pan offsets to the graph container.
 */
function setTransform() {
    container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
}

function resetZoom() {
    scale = 1;
    pointX = 0;
    pointY = 0;
    setTransform();
}

wrapper.addEventListener('mousedown', (e) => {
    if (mermaidRawCode === '') {
        return;
    }
    e.preventDefault();
    startX = e.clientX - pointX;
    startY = e.clientY - pointY;
    panning = true;
    didPan = false;
    wrapper.classList.add('is-panning');
});

wrapper.addEventListener('mouseup', () => {
    panning = false;
    wrapper.classList.remove('is-panning');
    // Reset didPan after a tick so click handlers can read it first
    setTimeout(() => { didPan = false; }, 0);
});

wrapper.addEventListener('mouseleave', () => {
    panning = false;
    didPan = false;
    wrapper.classList.remove('is-panning');
});

wrapper.addEventListener('mousemove', (e) => {
    if (!panning || mermaidRawCode === '') {
        return;
    }
    e.preventDefault();
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    didPan = true;
    setTransform();
});

wrapper.addEventListener('wheel', (e) => {
    if (mermaidRawCode === '') {
        return;
    }
    e.preventDefault();

    const scaledX = (e.clientX - pointX) / scale;
    const scaledY = (e.clientY - pointY) / scale;
    const zoomDirection = e.deltaY > 0 ? -1 : 1;
    const zoomSpeed = 1.1;

    if (zoomDirection > 0) {
        scale *= zoomSpeed;
    } else {
        scale /= zoomSpeed;
    }

    scale = Math.max(0.1, Math.min(scale, 8));
    pointX = e.clientX - scaledX * scale;
    pointY = e.clientY - scaledY * scale;

    setTransform();
});

zoomInBtn.addEventListener('click', () => {
    scale = Math.min(scale * 1.3, 8);
    setTransform();
});

zoomOutBtn.addEventListener('click', () => {
    scale = Math.max(scale / 1.3, 0.1);
    setTransform();
});

zoomResetBtn.addEventListener('click', resetZoom);

/* 11. Navigation & Global Controls */
const copyBtn = document.getElementById('copy-btn');
const resetBtn = document.getElementById('reset-btn');
const fullViewBtn = document.getElementById('full-view-btn');
const fullViewCloseBtn = document.getElementById('full-view-close');
const deselectBtnFull = document.getElementById('deselect-btn-full');

let isFullView = false;

copyBtn.addEventListener('click', () => {
    if (!mermaidRawCode) {
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = mermaidRawCode;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    const originalLabel = copyBtn.innerText;
    copyBtn.innerText = 'Copied!';
    copyBtn.classList.add('is-success');
    setTimeout(() => {
        copyBtn.innerText = originalLabel;
        copyBtn.classList.remove('is-success');
    }, 2000);
});

fullViewBtn.addEventListener('click', () => {
    if (!mermaidRawCode || isViewTransitioning || isFullView) {
        return;
    }

    isViewTransitioning = true;
    closeSummaryDock();

    wrapper.classList.add('is-fullscreen');
    document.body.classList.add('modal-open');
    isFullView = true;

    gsap.fromTo(wrapper, {
        opacity: 0,
        y: '100%',
        scale: 0.95
    }, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.35,
        ease: 'power3.out',
        onComplete: () => {
            gsap.set(wrapper, { clearProps: 'opacity,y,scale' });
            isViewTransitioning = false;
        }
    });
});

/**
 * Exits the full-screen view with a smooth transition.
 */
function closeFullView() {
    if (!isFullView || isViewTransitioning) {
        return;
    }

    isViewTransitioning = true;
    closeSummaryDock();

    gsap.to(wrapper, {
        opacity: 0,
        y: 18,
        duration: 0.22,
        ease: 'power2.inOut',
        onComplete: () => {
            wrapper.classList.remove('is-fullscreen');
            document.body.classList.remove('modal-open');
            isFullView = false;
            isViewTransitioning = false;
            gsap.set(wrapper, { clearProps: 'opacity,y' });
        }
    });
}

deselectBtnFull.addEventListener('click', clearAllHighlights);
fullViewCloseBtn.addEventListener('click', closeFullView);

resetBtn.addEventListener('click', () => {
    if (isViewTransitioning) {
        gsap.killTweensOf(wrapper);
        isViewTransitioning = false;
    }

    closeSummaryDock();
    wrapper.classList.remove('is-fullscreen');
    document.body.classList.remove('modal-open');
    isFullView = false;

    container.innerHTML = '<p id="status-text" class="status-text">Waiting for MHTML or HTML file...</p>';
    controls.classList.add('is-hidden');
    mermaidRawCode = '';
    panning = false;
    didPan = false;
    selectedNodeId = null;
    adjacencyGraph = new Map();
    courseTitleMap = new Map();
    wrapper.classList.remove('is-panning');
    gsap.set(wrapper, { clearProps: 'transform' });
    resetZoom();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullView) {
        closeFullView();
    }
});

/* 12. Initialization */
buildPresetButtons();
