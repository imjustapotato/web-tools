/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/* Application orchestrator */
import gsap from 'gsap';
import '@iconify/iconify';
import { clearAllNodeHighlights, animateNodeSelection } from './nodeanimation.js';
import { PRESET_CURRICULA, CURRICULA_CREDITS } from './presets.js';
import './companion-hook.js';
import {
    resetAdjacencyGraph,
    resetGraphState,
    setCourseTitleMap,
    getCourseTitleMap,
    getAdjacencyGraph,
    extractCourseTitleMapFromMermaid,
    getCourseDisplayLabel,
    getGraphNodes,
    getGraphEdges,
    buildAdjacencyGraph,
    buildAdjacencyGraphFromMermaidCode,
    collectPrerequisiteChain,
    collectForwardDependentChain,
    buildPrerequisiteDistanceMap,
    buildPrerequisiteEdgeDistanceMap,
    extractCourseCodeFromNodeElement,
    buildNodeCenterLookup,
    resolveEdgeKey
} from './src/core/graph-data.js';
import { extractHtmlFromFile, parseCurriculumHtml } from './src/core/file-parser.js';
import { initializeMermaid, buildMermaidCode, renderMermaidSvg } from './src/legacy/mermaid-engine.js';
import { buildDagreLayout } from './src/custom/dagre-layout.js';
import { renderDagreLayout } from './src/custom/d3-renderer.js';
import { animateCustomNodeSelection, clearCustomAnimations, stripInlineVisuals } from './src/custom/animation-controller.js';
import { applyTrace, clearTrace, applyHoverPreview, clearHoverPreview } from './src/custom/trace-engine.js';
import { buildStraightClippedEdge } from './src/custom/path-utils.js';

initializeMermaid();

/* Orchestration State */
let mermaidRawCode = '';
let selectedNodeId = null;
let activeSelectionTimeline = null;
let isViewTransitioning = false;
let keyNavChoices = null;
let keyNavDirection = null; // 'left' | 'right' — retained for navigateToChoice after hint dismissal

/* Branch trace — mutually exclusive with selection */
let tracedNodeId = null;
let longPressTimer = null;
let longPressFired = false;
let lastTraceActionAt = 0; // dedupes mobile long-press that also fires `contextmenu`
let longPressStartX = 0;
let longPressStartY = 0;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10; // cancel long-press only if finger drifts past this

/* 3. Engine State */
const ENGINE_STORAGE_KEY = 'portal_parser_active_engine';
let activeEngine = localStorage.getItem(ENGINE_STORAGE_KEY) || 'custom';

/* 3b. Layout State (custom engine only) */
const LAYOUT_DIR_STORAGE_KEY = 'portal_parser_layout_dir';
const LAYOUT_SPACING_STORAGE_KEY = 'portal_parser_layout_spacing';

let layoutDirection = localStorage.getItem(LAYOUT_DIR_STORAGE_KEY) || 'LR';
let layoutSpacing = localStorage.getItem(LAYOUT_SPACING_STORAGE_KEY) || 'normal';

const SPACING_PRESETS = {
    compact: { ranksep: 60,  nodesep: 30 },
    normal:  { ranksep: 110, nodesep: 50 },
    spread:  { ranksep: 180, nodesep: 90 }
};

/* 3b-i. Layout Mode — Default (dagre-locked) vs Custom (draggable, persisted snapshot) */
const LAYOUT_MODE_STORAGE_KEY = 'portal_parser_layout_mode';
let layoutMode = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) || 'default'; // 'default' | 'custom'

// Positions from the most recent dagre run — the baseline a custom snapshot freezes against
let lastDagreBaseline = new Map();

// Live drag state (desktop mouse only — touch drag would collide with single-finger pan)
let draggingNode = null;
let didDragNode = false; // swallows the synthesized click after a drag (mirrors didPan)
let dragStart = null;    // { mouseX, mouseY, nodeX, nodeY }

const POSITION_DEVIATION_EPSILON = 0.5; // px; below this a stored pos counts as "unmoved"

/* Custom layout snapshots — keyed per graph hash */
function hashGraph(text) {
    let hash = 5381;
    for (let index = 0; index < text.length; index++) {
        hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0; // djb2, 32-bit
    }
    return (hash >>> 0).toString(36);
}

function getPositionsStorageKey() {
    return `portal_parser_node_positions_${hashGraph(mermaidRawCode)}`;
}

function loadNodePositions() {
    try {
        const raw = localStorage.getItem(getPositionsStorageKey());
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveNodePositions(positions) {
    localStorage.setItem(getPositionsStorageKey(), JSON.stringify(positions));
}

function clearNodePositions() {
    localStorage.removeItem(getPositionsStorageKey());
}

/* 3c. Chain Depth State */
const PREREQ_DEPTH_STORAGE_KEY = 'portal_parser_prereq_depth';
const TRACE_DEPTH_STORAGE_KEY = 'portal_parser_trace_depth';

let prereqDepthSetting = localStorage.getItem(PREREQ_DEPTH_STORAGE_KEY) || 'full'; // '1' | '2' | 'full'
let traceDepthSetting = localStorage.getItem(TRACE_DEPTH_STORAGE_KEY) || '2';      // '1' | '2' | 'full'

function parseDepthSetting(setting) {
    return setting === 'full' ? Infinity : parseInt(setting, 10);
}

/* 4. Engine Routing */
/* Route to active engine */
async function dispatchToActiveEngine(mermaidCode) {
    if (activeEngine === 'custom') {
        await renderWithCustomEngine(mermaidCode);
        return;
    }
    await renderMermaidCode(mermaidCode);
}

function switchEngine(engineName) {
    if (activeEngine === engineName) return;

    if (activeSelectionTimeline) {
        activeSelectionTimeline.kill();
        activeSelectionTimeline = null;
    }
    if (tracedNodeId) exitTrace();
    selectedNodeId = null;

    activeEngine = engineName;
    localStorage.setItem(ENGINE_STORAGE_KEY, engineName);
    updateEngineToggleUI();
    if (mermaidRawCode) dispatchToActiveEngine(mermaidRawCode);
}

function updateEngineToggleUI() {
    engineLegacyBtn.classList.toggle('is-active', activeEngine === 'legacy');
    engineCustomBtn.classList.toggle('is-active', activeEngine === 'custom');
    engineLegacyBtn.setAttribute('aria-pressed', String(activeEngine === 'legacy'));
    engineCustomBtn.setAttribute('aria-pressed', String(activeEngine === 'custom'));
    // Layout controls only apply to the custom engine
    layoutOptionsGroup.classList.toggle('is-hidden', activeEngine !== 'custom');
}

function updateLayoutUI() {
    layoutDirLrBtn.classList.toggle('is-active', layoutDirection === 'LR');
    layoutDirTbBtn.classList.toggle('is-active', layoutDirection === 'TB');
    layoutDirLrBtn.setAttribute('aria-pressed', String(layoutDirection === 'LR'));
    layoutDirTbBtn.setAttribute('aria-pressed', String(layoutDirection === 'TB'));
    layoutSpacingSelect.value = layoutSpacing;

    // Mode buttons + control visibility: Custom hides the auto-layout controls and reveals Reset
    const isCustom = layoutMode === 'custom';
    layoutModeDefaultBtn.classList.toggle('is-active', !isCustom);
    layoutModeCustomBtn.classList.toggle('is-active', isCustom);
    layoutModeDefaultBtn.setAttribute('aria-pressed', String(!isCustom));
    layoutModeCustomBtn.setAttribute('aria-pressed', String(isCustom));
    layoutAutoControls.classList.toggle('is-hidden', isCustom);
    layoutResetBtn.classList.toggle('is-hidden', !isCustom);
}

/* Toggle between dagre-locked and custom draggable layout */
function setLayoutMode(mode) {
    if (layoutMode === mode) return;

    layoutMode = mode;
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);

    // Seed a snapshot from the current dagre baseline if none exists yet for this graph
    if (mode === 'custom' && mermaidRawCode && !loadNodePositions() && lastDagreBaseline.size > 0) {
        const snapshot = {};
        lastDagreBaseline.forEach((position, courseCode) => { snapshot[courseCode] = { ...position }; });
        saveNodePositions(snapshot);
    }

    updateLayoutUI();
    clearActiveSelectionState();
    if (mermaidRawCode) renderWithCustomEngine(mermaidRawCode);
}

/* Reset custom layout to fresh dagre baseline */
function resetCustomLayout() {
    if (!mermaidRawCode) return;
    clearNodePositions();
    clearActiveSelectionState();
    renderWithCustomEngine(mermaidRawCode).then(() => {
        // Re-seed the snapshot from the fresh baseline so Custom stays a full frozen set
        const snapshot = {};
        lastDagreBaseline.forEach((position, courseCode) => { snapshot[courseCode] = { ...position }; });
        saveNodePositions(snapshot);
    });
}

/* Teardown: kill selection + drop trace */
function clearActiveSelectionState() {
    if (activeSelectionTimeline) { activeSelectionTimeline.kill(); activeSelectionTimeline = null; }
    if (tracedNodeId) exitTrace();
    selectedNodeId = null;
}

/* 5. File Ingestion (Dropzone & Input) */
const dropzone = document.getElementById('dropzone');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.mhtml,.html,.htm';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
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
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
    const rawHtml = await extractHtmlFromFile(file);
    await parseAndRender(rawHtml);
}

/* 6. Parsing & Engine Dispatch */
async function parseAndRender(html) {
    const { courses, courseTitleMap: parsedTitleMap } = parseCurriculumHtml(html);

    if (courses.length === 0) {
        container.innerHTML = '<p class="status-message status-message--error">Error: Couldn\'t extract course data. Ensure this is a valid portal HTML/MHTML export.</p>';
        return;
    }

    const mermaidCode = buildMermaidCode(courses);
    await dispatchToActiveEngine(mermaidCode);
    // Render functions extract titles from mermaid (safe for presets); restore the
    // richer HTML-parsed map after so dock labels preserve parens and other special chars.
    setCourseTitleMap(parsedTitleMap);
}

// Expose to window for the Companion Extension hook
window.parseAndRender = parseAndRender;

/* 7. Curriculum Presets */
const presetButtonsContainer = document.getElementById('preset-buttons');
const creditTooltip = document.createElement('div');
creditTooltip.className = 'credit-tooltip';
document.body.appendChild(creditTooltip);

let creditTooltipTimeout = null;

function buildPresetButtons() {
    PRESET_CURRICULA.forEach((preset) => {
        const button = document.createElement('button');
        button.id = `preset-${preset.id}`;
        button.className = 'btn btn-preset';
        button.type = 'button';
        button.textContent = preset.label;
        button.addEventListener('click', () => loadPresetCurriculum(preset, button));

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

function showCreditTooltip(credit, targetElement) {
    if (creditTooltipTimeout) {
        clearTimeout(creditTooltipTimeout);
        creditTooltipTimeout = null;
    }

    creditTooltip.textContent = `Data provided by: ${credit}`;
    creditTooltip.classList.add('visible');

    const rect = targetElement.getBoundingClientRect();
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
        await dispatchToActiveEngine(preset.content.trim());
    } catch (error) {
        console.error('Preset load error:', error);
        container.innerHTML = '<p class="status-message status-message--error">Failed to load preset curriculum.</p>';
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

/* 8. Render Orchestration (Legacy Engine) */
const container = document.getElementById('graph-container');
const controls = document.getElementById('controls');

async function renderMermaidCode(mermaidCode) {
    mermaidRawCode = mermaidCode;
    controls.classList.remove('is-hidden');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';
    selectedNodeId = null;
    resetAdjacencyGraph();
    setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));

    try {
        const svg = await renderMermaidSvg(mermaidCode);
        container.innerHTML = svg;
        resetZoom();
        buildAdjacencyGraph(container.querySelector('svg'), mermaidRawCode);
        attachNodeClickListeners();
    } catch (err) {
        console.error('Mermaid error:', err);
        container.innerHTML = '<p class="status-message status-message--error">Failed to render graph visually. You can still copy the raw code.</p>';
    }
}

/* 9. Render Orchestration (Custom Engine) */
async function renderWithCustomEngine(mermaidCode) {
    mermaidRawCode = mermaidCode;
    controls.classList.remove('is-hidden');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';
    selectedNodeId = null;
    resetAdjacencyGraph();
    setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));

    // Build adjacency graph from code before layout — no SVG needed
    buildAdjacencyGraphFromMermaidCode(mermaidCode);

    const spacing = SPACING_PRESETS[layoutSpacing] ?? SPACING_PRESETS.normal;
    const layoutGraph = buildDagreLayout({ rankdir: layoutDirection, ...spacing });
    renderDagreLayout(layoutGraph, container);

    // Capture dagre's positions as the baseline a custom snapshot is measured against
    lastDagreBaseline = new Map();
    layoutGraph.nodes().forEach((courseCode) => {
        const node = layoutGraph.node(courseCode);
        lastDagreBaseline.set(courseCode, { x: node.x, y: node.y });
    });

    if (layoutMode === 'custom') applyCustomPositions();

    resetZoom();
    attachNodeClickListeners();
}

/* Applies stored custom snapshot over fresh dagre layout.
   Only "moved" nodes (diverging from baseline) straighten their edges. */
function applyCustomPositions() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;
    svgElement.classList.add('is-custom-layout');

    const positions = loadNodePositions();
    if (!positions) return;

    const movedCodes = new Set();
    Object.entries(positions).forEach(([courseCode, position]) => {
        const nodeElement = svgElement.querySelector(`[data-course-code="${courseCode}"]`);
        if (!nodeElement) return;
        nodeElement.setAttribute('transform', `translate(${position.x}, ${position.y})`);

        const baseline = lastDagreBaseline.get(courseCode);
        if (!baseline
            || Math.abs(baseline.x - position.x) > POSITION_DEVIATION_EPSILON
            || Math.abs(baseline.y - position.y) > POSITION_DEVIATION_EPSILON) {
            movedCodes.add(courseCode);
        }
    });

    movedCodes.forEach((courseCode) => rerouteEdgesForNode(svgElement, courseCode));
}

/* 10. Interaction & Selection */
function attachNodeClickListeners() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    const allowDrag = activeEngine === 'custom' && layoutMode === 'custom';

    getGraphNodes(svgElement).forEach((nodeElement) => {
        nodeElement.style.cursor = 'pointer';
        nodeElement.addEventListener('click', handleNodeClick);
        // Branch tracing — handlers gate internally for custom engine only
        nodeElement.addEventListener('mouseenter', handleNodeHover);
        nodeElement.addEventListener('mouseleave', handleNodeHoverEnd);
        nodeElement.addEventListener('contextmenu', handleNodeContextMenu);
        nodeElement.addEventListener('touchstart', handleNodeTouchStart, { passive: true });
        // Cancel long-press on touchmove only if finger drifted past threshold
        nodeElement.addEventListener('touchmove', cancelLongPressIfMoved, { passive: true });
        nodeElement.addEventListener('touchend', cancelLongPress, { passive: true });
        // Custom layout mode: nodes are draggable (desktop mouse only)
        if (allowDrag) nodeElement.addEventListener('mousedown', handleNodeDragStart);
    });

    // Edge hover preview — hovering a line previews the source node's connections
    getGraphEdges(svgElement).forEach((edgeElement) => {
        edgeElement.addEventListener('mouseenter', handleEdgeHover);
        edgeElement.addEventListener('mouseleave', handleNodeHoverEnd);
    });
}

function selectNode(courseCode) {
    // Selection and trace are mutually exclusive — left-click wins
    if (tracedNodeId) exitTrace();
    if (selectedNodeId === courseCode) {
        clearAllHighlights();
        return;
    }
    selectedNodeId = courseCode;
    if (!isFullView) fullViewBtn.click();
    openSummaryDock();
    const svgElement = container.querySelector('svg');
    const prereqMaxDepth = parseDepthSetting(prereqDepthSetting);
    if (activeEngine === 'custom') {
        clearHoverPreview(svgElement); // drop lingering hover before chain animates
        activeSelectionTimeline = animateCustomNodeSelection(courseCode, svgElement, activeSelectionTimeline, prereqMaxDepth);
    } else {
        activeSelectionTimeline = animateNodeSelection(courseCode, {
            svgElement,
            activeSelectionTimeline,
            prereqMaxDepth,
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
}

function handleNodeClick(event) {
    event.stopPropagation();
    if (didPan) return;
    // Drag just moved this node — swallow synthesized click
    if (didDragNode) { didDragNode = false; return; }
    // Long-press already handled this (trace toggle) — swallow synthesized click
    if (longPressFired) { longPressFired = false; return; }

    const nodeElement = event.currentTarget;
    const courseCode = extractCourseCodeFromNodeElement(nodeElement);
    if (!courseCode) {
        console.warn('[Tree Animation] Unable to resolve course code for clicked node:', nodeElement?.id ?? '(no id)');
        return;
    }

    selectNode(courseCode);
}

/* Branch trace — hover preview, right-click/long-press to pin forward strand */
function handleNodeHover(event) {
    if (activeEngine !== 'custom') return;
    if (selectedNodeId || tracedNodeId || draggingNode) return; // no preview noise while pinned or mid-drag

    const courseCode = extractCourseCodeFromNodeElement(event.currentTarget);
    if (!courseCode) return;
    applyHoverPreview(container.querySelector('svg'), courseCode);
}

/* Hovering an edge brightens source node's connections */
function handleEdgeHover(event) {
    if (activeEngine !== 'custom') return;
    if (selectedNodeId || tracedNodeId) return;

    const sourceCode = event.currentTarget.getAttribute('data-source');
    if (!sourceCode) return;
    applyHoverPreview(container.querySelector('svg'), sourceCode);
}

function handleNodeHoverEnd() {
    if (activeEngine !== 'custom') return;
    clearHoverPreview(container.querySelector('svg'));
}

function handleNodeContextMenu(event) {
    if (activeEngine !== 'custom') return;
    event.preventDefault(); // suppress native context menu
    // Mobile long-press often fires `contextmenu` too — skip if just toggled via long-press
    if (Date.now() - lastTraceActionAt < 700) return;

    const courseCode = extractCourseCodeFromNodeElement(event.currentTarget);
    if (courseCode) toggleTrace(courseCode);
}

function handleNodeTouchStart(event) {
    if (activeEngine !== 'custom') return;
    if (event.touches.length !== 1) return; // ignore pinch

    const touch = event.touches[0];
    longPressStartX = touch.clientX;
    longPressStartY = touch.clientY;

    const nodeElement = event.currentTarget;
    cancelLongPress();
    longPressTimer = setTimeout(() => {
        const courseCode = extractCourseCodeFromNodeElement(nodeElement);
        if (!courseCode) return;
        longPressFired = true; // guard the synthesized click that follows touchend
        toggleTrace(courseCode);
    }, LONG_PRESS_MS);
}

function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

/* Cancel long-press only when finger drifts beyond movement threshold.
   Micro-tremors at rest shouldn't abort the hold before the timer fires. */
function cancelLongPressIfMoved(event) {
    if (!longPressTimer) return;
    const touch = event.touches[0];
    if (!touch) { cancelLongPress(); return; }
    const dx = touch.clientX - longPressStartX;
    const dy = touch.clientY - longPressStartY;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD_PX) cancelLongPress();
}

function toggleTrace(courseCode) {
    if (tracedNodeId === courseCode) {
        exitTrace();
    } else {
        enterTrace(courseCode);
    }
}

function enterTrace(courseCode) {
    const { visitedNodes, visitedEdges } = collectForwardDependentChain(courseCode, parseDepthSetting(traceDepthSetting));
    // Terminal course — nothing unlocks from here. Skip the empty dimmed state.
    if (visitedEdges.size === 0) return;

    // Trace is declarative CSS; drop selection + strip inline GSAP paint so
    // CSS trace colour isn't overridden by leftover inline stroke.
    if (selectedNodeId) clearAllHighlights();
    const svgElement = container.querySelector('svg');
    clearHoverPreview(svgElement);
    stripInlineVisuals(svgElement);
    applyTrace(svgElement, visitedNodes, visitedEdges);

    tracedNodeId = courseCode;
    lastTraceActionAt = Date.now();
}

function exitTrace() {
    clearTrace(container.querySelector('svg'));
    tracedNodeId = null;
    lastTraceActionAt = Date.now();
}

/* Node Dragging (Custom Layout mode — desktop mouse only) */

/** Reads center + half-extents from transform and data-w/data-h attributes */
function getNodeGeometry(svgElement, courseCode) {
    const nodeElement = svgElement.querySelector(`[data-course-code="${courseCode}"]`);
    if (!nodeElement) return null;

    const translate = parseNodeTranslate(nodeElement);
    const width = parseFloat(nodeElement.getAttribute('data-w')) || 0;
    const height = parseFloat(nodeElement.getAttribute('data-h')) || 0;
    return { x: translate.x, y: translate.y, halfWidth: width / 2, halfHeight: height / 2 };
}

/** Parses `translate(x, y)` from a node group's transform attribute */
function parseNodeTranslate(nodeElement) {
    const match = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(nodeElement.getAttribute('transform') ?? '');
    return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
}

/** Redraws every edge touching a node as a straight line clipped to both borders */
function rerouteEdgesForNode(svgElement, courseCode) {
    const movedGeo = getNodeGeometry(svgElement, courseCode);
    if (!movedGeo) return;

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const sourceCode = edgeElement.getAttribute('data-source');
        const targetCode = edgeElement.getAttribute('data-target');
        if (sourceCode !== courseCode && targetCode !== courseCode) return;

        const sourceGeo = sourceCode === courseCode ? movedGeo : getNodeGeometry(svgElement, sourceCode);
        const targetGeo = targetCode === courseCode ? movedGeo : getNodeGeometry(svgElement, targetCode);
        if (!sourceGeo || !targetGeo) return;

        const { points, d } = buildStraightClippedEdge(sourceGeo, targetGeo);
        const path = edgeElement.querySelector('path');
        if (!path) return;
        path.setAttribute('d', d);
        // Keep data-points in sync so selection edge-draw reverses correctly
        path.setAttribute('data-points', JSON.stringify(points));
    });
}

function handleNodeDragStart(event) {
    if (activeEngine !== 'custom' || layoutMode !== 'custom') return;
    event.stopPropagation(); // block the wrapper pan handler

    draggingNode = event.currentTarget;
    didDragNode = false;
    const translate = parseNodeTranslate(draggingNode);
    dragStart = { mouseX: event.clientX, mouseY: event.clientY, nodeX: translate.x, nodeY: translate.y };
}

function onDocumentMouseMove(event) {
    if (!draggingNode) return;

    // Convert screen-pixel delta into SVG units (the container is CSS-scaled by `scale`)
    const deltaX = (event.clientX - dragStart.mouseX) / scale;
    const deltaY = (event.clientY - dragStart.mouseY) / scale;
    const newX = dragStart.nodeX + deltaX;
    const newY = dragStart.nodeY + deltaY;

    draggingNode.setAttribute('transform', `translate(${newX}, ${newY})`);
    didDragNode = true;

    const courseCode = draggingNode.getAttribute('data-course-code');
    rerouteEdgesForNode(container.querySelector('svg'), courseCode);
}

function onDocumentMouseUp() {
    if (!draggingNode) return;

    const courseCode = draggingNode.getAttribute('data-course-code');
    const translate = parseNodeTranslate(draggingNode);
    const positions = loadNodePositions() ?? {};
    positions[courseCode] = { x: translate.x, y: translate.y };
    saveNodePositions(positions);

    draggingNode = null;
    dragStart = null;
    // didDragNode stays true until the synthesized click fires and clears it
}

document.addEventListener('mousemove', onDocumentMouseMove);
document.addEventListener('mouseup', onDocumentMouseUp);

function clearAllHighlights() {
    hideKeyNavHint();
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Kill running selection timeline FIRST. Its glow setters are GSAP callbacks,
    // not tweens — pending callbacks would re-apply glows after deselect.
    if (activeSelectionTimeline) {
        activeSelectionTimeline.kill();
        activeSelectionTimeline = null;
    }

    if (activeEngine === 'custom') {
        clearCustomAnimations(svgElement);
        // Also drop any pinned trace so deselect/Escape clears every highlight mode
        clearTrace(svgElement);
        tracedNodeId = null;
    } else {
        clearAllNodeHighlights(svgElement, { getGraphNodes, getGraphEdges, setNodeGlow, getNodeTextElements });
    }

    selectedNodeId = null;
    closeSummaryDock();
}

/* 11. SVG Animation Helpers (passed as context to nodeanimation.js) */
function setNodeGlow(shapeElement, glowFilter) {
    if (!shapeElement) return;
    shapeElement.style.filter = glowFilter;
}

function getNodeTextElements(nodeElement) {
    return nodeElement.querySelectorAll('text, tspan, span.nodeLabel, div.nodeLabel');
}

function getSafePathLength(pathElement) {
    if (!pathElement) return 300;

    let pathLength = 0;
    try {
        pathLength = pathElement.getTotalLength?.() ?? 0;
    } catch {
        pathLength = 0;
    }

    if (pathLength > 50) return pathLength;

    try {
        const bbox = pathElement.getBBox?.();
        if (bbox) {
            const diagonal = Math.sqrt((bbox.width ** 2) + (bbox.height ** 2));
            if (diagonal > 50) return diagonal;
        }
    } catch {
        // Ignore geometry errors.
    }

    return 300;
}

/* 12. Summary Dock */
const summaryDock = document.getElementById('summary-dock');
const summarySubjectDock = document.getElementById('summary-subject-dock');
const summaryListDock = document.getElementById('summary-list-dock');
const summaryExpandBtn = document.getElementById('summary-expand-btn');
const summaryIndirectContainer = document.getElementById('summary-indirect-container');
const summaryIndirectListDock = document.getElementById('summary-indirect-list-dock');

let isSummaryExpanded = false;

function renderSummaryContent(subjectElement, listElement, selectedCode) {
    subjectElement.textContent = `Selected Subject: ${getCourseDisplayLabel(selectedCode)}`;
    listElement.innerHTML = '';
    summaryIndirectListDock.innerHTML = '';

    // Depth-controlled: honours current prereq depth setting
    const prereqMaxDepth = parseDepthSetting(prereqDepthSetting);
    const distanceMap = buildPrerequisiteDistanceMap(selectedCode, prereqMaxDepth);
    const directPrereqs = Array.from(distanceMap.entries())
        .filter(([, distance]) => distance === 1)
        .map(([code]) => code)
        .sort();

    const { visitedNodes } = collectPrerequisiteChain(selectedCode, prereqMaxDepth);
    const indirectPrerequisites = Array.from(visitedNodes)
        .filter((code) => code !== selectedCode && !directPrereqs.includes(code))
        .sort();

    if (directPrereqs.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'summary-item is-empty';
        emptyItem.textContent = 'No prerequisites required.';
        listElement.appendChild(emptyItem);
    } else {
        directPrereqs.forEach((courseCode) => {
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

/* 13. Pan & Zoom */
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
    if (mermaidRawCode === '') return;
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
    setTimeout(() => { didPan = false; }, 0);
});

wrapper.addEventListener('mouseleave', () => {
    panning = false;
    didPan = false;
    wrapper.classList.remove('is-panning');
});

wrapper.addEventListener('mousemove', (e) => {
    if (!panning || mermaidRawCode === '') return;
    e.preventDefault();
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    didPan = true;
    setTransform();
});

wrapper.addEventListener('wheel', (e) => {
    if (mermaidRawCode === '') return;
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

/* Touch — single finger pan, two-finger pinch zoom */
let pinchStartDistance = 0;
let pinchStartScale = 1;

wrapper.addEventListener('touchstart', (e) => {
    if (mermaidRawCode === '') return;

    if (e.touches.length === 2) {
        pinchStartDistance = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY
        );
        pinchStartScale = scale;
    } else {
        startX = e.touches[0].clientX - pointX;
        startY = e.touches[0].clientY - pointY;
        panning = true;
        didPan = false;
        wrapper.classList.add('is-panning');
    }
}, { passive: true });

wrapper.addEventListener('touchmove', (e) => {
    if (mermaidRawCode === '') return;
    e.preventDefault();

    if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const scaledMidX = (midX - pointX) / scale;
        const scaledMidY = (midY - pointY) / scale;

        scale = Math.max(0.1, Math.min((pinchStartScale * currentDistance) / pinchStartDistance, 8));
        pointX = midX - scaledMidX * scale;
        pointY = midY - scaledMidY * scale;
        setTransform();
    } else if (panning) {
        pointX = e.touches[0].clientX - startX;
        pointY = e.touches[0].clientY - startY;
        didPan = true;
        setTransform();
    }
}, { passive: false });

wrapper.addEventListener('touchend', () => {
    panning = false;
    wrapper.classList.remove('is-panning');
    setTimeout(() => { didPan = false; }, 0);
}, { passive: true });

/* 14. Navigation & Global Controls */
const copyBtn = document.getElementById('copy-btn');
const resetBtn = document.getElementById('reset-btn');
const fullViewBtn = document.getElementById('full-view-btn');
const fullViewCloseBtn = document.getElementById('full-view-close');
const deselectBtnFull = document.getElementById('deselect-btn-full');
const engineLegacyBtn = document.getElementById('engine-legacy-btn');
const engineCustomBtn = document.getElementById('engine-custom-btn');
const keyNavHint = document.getElementById('key-nav-hint');

const layoutOptionsGroup = document.getElementById('layout-options');
const layoutModeDefaultBtn = document.getElementById('layout-mode-default');
const layoutModeCustomBtn = document.getElementById('layout-mode-custom');
const layoutAutoControls = document.getElementById('layout-auto-controls');
const layoutDirLrBtn = document.getElementById('layout-dir-lr');
const layoutDirTbBtn = document.getElementById('layout-dir-tb');
const layoutSpacingSelect = document.getElementById('layout-spacing-select');
const layoutResetBtn = document.getElementById('layout-reset-btn');

/* Chain depth controls */
const prereqDepthSelect = document.getElementById('prereq-depth-select');
const traceDepthSelect = document.getElementById('trace-depth-select');

/* Config export / import */
const exportConfigBtn = document.getElementById('export-config-btn');
const importConfigInput = document.getElementById('import-config-input');

engineLegacyBtn.addEventListener('click', () => switchEngine('legacy'));
engineCustomBtn.addEventListener('click', () => switchEngine('custom'));

function applyLayoutOption(changedDirection, changedSpacing) {
    if (changedDirection) {
        layoutDirection = changedDirection;
        localStorage.setItem(LAYOUT_DIR_STORAGE_KEY, layoutDirection);
    }
    if (changedSpacing) {
        layoutSpacing = changedSpacing;
        localStorage.setItem(LAYOUT_SPACING_STORAGE_KEY, layoutSpacing);
    }
    updateLayoutUI();
    if (activeSelectionTimeline) { activeSelectionTimeline.kill(); activeSelectionTimeline = null; }
    selectedNodeId = null;
    if (mermaidRawCode) renderWithCustomEngine(mermaidRawCode);
}

layoutDirLrBtn.addEventListener('click', () => applyLayoutOption('LR', null));
layoutDirTbBtn.addEventListener('click', () => applyLayoutOption('TB', null));
layoutSpacingSelect.addEventListener('change', () => applyLayoutOption(null, layoutSpacingSelect.value));

layoutModeDefaultBtn.addEventListener('click', () => setLayoutMode('default'));
layoutModeCustomBtn.addEventListener('click', () => setLayoutMode('custom'));
layoutResetBtn.addEventListener('click', resetCustomLayout);

/* Chain Depth */
function updateDepthUI() {
    prereqDepthSelect.value = prereqDepthSetting;
    traceDepthSelect.value = traceDepthSetting;
}

function applyDepthOption(type, value) {
    if (type === 'prereq') {
        prereqDepthSetting = value;
        localStorage.setItem(PREREQ_DEPTH_STORAGE_KEY, value);
    } else {
        traceDepthSetting = value;
        localStorage.setItem(TRACE_DEPTH_STORAGE_KEY, value);
    }
    updateDepthUI();
    // Re-select so new depth takes effect immediately
    if (selectedNodeId) selectNode(selectedNodeId);
    if (tracedNodeId) { exitTrace(); enterTrace(tracedNodeId); }
}

prereqDepthSelect.addEventListener('change', () => applyDepthOption('prereq', prereqDepthSelect.value));
traceDepthSelect.addEventListener('change', () => applyDepthOption('trace', traceDepthSelect.value));

/* Config Export / Import */
function exportConfig() {
    const config = {
        version: 1,
        engine: activeEngine,
        layoutDirection,
        layoutSpacing,
        prereqDepth: prereqDepthSetting,
        traceDepth: traceDepthSetting
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'portal-parser-config.json';
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
}

function importConfig(jsonText) {
    let config;
    try { config = JSON.parse(jsonText); } catch { return; }

    if (config.engine && config.engine !== activeEngine) switchEngine(config.engine);
    if (config.layoutDirection || config.layoutSpacing) {
        applyLayoutOption(config.layoutDirection ?? null, config.layoutSpacing ?? null);
    }
    if (config.prereqDepth) {
        prereqDepthSetting = config.prereqDepth;
        localStorage.setItem(PREREQ_DEPTH_STORAGE_KEY, prereqDepthSetting);
    }
    if (config.traceDepth) {
        traceDepthSetting = config.traceDepth;
        localStorage.setItem(TRACE_DEPTH_STORAGE_KEY, traceDepthSetting);
    }
    updateDepthUI();
    // Re-render with the imported settings if a graph is loaded
    if (mermaidRawCode) dispatchToActiveEngine(mermaidRawCode);
}

exportConfigBtn.addEventListener('click', exportConfig);
importConfigInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => importConfig(loadEvent.target.result);
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    importConfigInput.value = '';
});

let isFullView = false;

copyBtn.addEventListener('click', () => {
    if (!mermaidRawCode) return;

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
    if (!mermaidRawCode || isViewTransitioning || isFullView) return;

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

function closeFullView() {
    if (!isFullView || isViewTransitioning) return;

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
    tracedNodeId = null;
    draggingNode = null;
    didDragNode = false;
    dragStart = null;
    cancelLongPress();
    resetGraphState();
    wrapper.classList.remove('is-panning');
    gsap.set(wrapper, { clearProps: 'transform' });
    resetZoom();
});

/* Keyboard navigation hint helpers */
function showKeyNavHint(choices, directionLabel, direction) {
    keyNavChoices = choices;
    keyNavDirection = direction;
    keyNavHint.querySelector('.key-nav-hint__direction').textContent = directionLabel;

    const list = keyNavHint.querySelector('.key-nav-hint__list');
    list.innerHTML = '';
    choices.forEach(({ code, title }, index) => {
        const item = document.createElement('li');
        item.className = 'key-nav-hint__item';
        const displayText = title ? `${code} — ${title}` : code;
        item.innerHTML = `<span class="key-nav-hint__key">${index + 1}</span>${displayText}`;
        item.addEventListener('click', () => navigateToChoice(index));
        list.appendChild(item);
    });

    keyNavHint.classList.remove('is-hidden');
}

function hideKeyNavHint() {
    keyNavChoices = null;
    keyNavDirection = null;
    keyNavHint?.classList.add('is-hidden');
}

function navigateToChoice(choiceIndex) {
    const choice = keyNavChoices?.[choiceIndex];
    if (!choice) return;
    const direction = keyNavDirection;
    hideKeyNavHint();
    panToNodeByCode(choice.code, direction);
    selectNode(choice.code);
}

/**
 * Smoothly pans the viewport to center on a node, with a lateral offset so the
 * node you navigated FROM remains partially in view.
 *
 * Offset direction is OPPOSITE to navigation direction:
 *   left nav  → offset right  (shows the previously selected node to the right)
 *   right nav → offset left   (shows the previously selected node to the left)
 */
const KEY_NAV_PAN_OFFSET_PX = 120;

function panToNodeByCode(courseCode, direction) {
    const svgElement = container.querySelector('svg');
    const nodeElement = svgElement?.querySelector(`[data-course-code="${courseCode}"]`);
    if (!nodeElement) return;

    const nodeRect = nodeElement.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    const nodeCenterX = nodeRect.left + nodeRect.width / 2;
    const nodeCenterY = nodeRect.top + nodeRect.height / 2;
    const wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
    const wrapperCenterY = wrapperRect.top + wrapperRect.height / 2;

    const lateralOffset = direction === 'left' ? KEY_NAV_PAN_OFFSET_PX : -KEY_NAV_PAN_OFFSET_PX;
    const targetPointX = pointX + (wrapperCenterX - nodeCenterX) + lateralOffset;
    const targetPointY = pointY + (wrapperCenterY - nodeCenterY);

    // Tween a proxy so we can read interpolated values each frame and feed setTransform
    const proxy = { x: pointX, y: pointY };
    gsap.to(proxy, {
        x: targetPointX,
        y: targetPointY,
        duration: 0.45,
        ease: 'power2.out',
        onUpdate() {
            pointX = proxy.x;
            pointY = proxy.y;
            setTransform();
        }
    });
}

document.addEventListener('keydown', (e) => {
    // When the hint is open: number keys pick a choice, Escape cancels
    if (keyNavChoices) {
        const choiceIndex = parseInt(e.key, 10) - 1;
        if (Number.isInteger(choiceIndex) && choiceIndex >= 0 && choiceIndex < keyNavChoices.length) {
            e.preventDefault();
            navigateToChoice(choiceIndex);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            hideKeyNavHint();
            return;
        }
    }

    // Arrow navigation — custom engine only, while a node is selected
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedNodeId && activeEngine === 'custom') {
        e.preventDefault();
        const adjacencyGraph = getAdjacencyGraph();
        const nodeData = adjacencyGraph.get(selectedNodeId);
        if (!nodeData) return;

        const direction = e.key === 'ArrowLeft' ? 'left' : 'right';
        const targetCodes = direction === 'left'
            ? [...nodeData.incoming]   // prerequisites
            : [...nodeData.outgoing];  // dependents

        if (targetCodes.length === 0) return;

        if (targetCodes.length === 1) {
            panToNodeByCode(targetCodes[0], direction);
            selectNode(targetCodes[0]);
        } else {
            const titleMap = getCourseTitleMap();
            const choices = targetCodes.map((code) => ({ code, title: titleMap.get(code) ?? '' }));
            const label = direction === 'left' ? '← Prerequisites' : 'Dependents →';
            showKeyNavHint(choices, label, direction);
        }
        return;
    }

    // Escape priority: hint → trace → selection → full-view close
    if (e.key === 'Escape') {
        if (tracedNodeId) {
            exitTrace();
        } else if (selectedNodeId) {
            clearAllHighlights();
        } else if (isFullView) {
            closeFullView();
        }
    }
});

/* 15. Initialization */
buildPresetButtons();
updateEngineToggleUI();
updateLayoutUI();
updateDepthUI();
