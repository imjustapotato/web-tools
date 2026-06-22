/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/* Application orchestrator */
import gsap from 'gsap';
import { toBlob } from 'html-to-image';
import '@iconify/iconify';
import { clearAllNodeHighlights, animateNodeSelection } from './nodeanimation.js';
import { PRESET_CURRICULA, CURRICULA_CREDITS } from './presets.js';
import './companion-hook.js';
import {
    resetAdjacencyGraph,
    resetGraphState,
    setCourseTitleMap,
    getCourseTitleMap,
    setCourseYearTermMap,
    getCourseYearTermMap,
    getAdjacencyGraph,
    extractCourseTitleMapFromMermaid,
    extractYearTermMapFromMermaidComments,
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
    resolveEdgeKey,
    stripLabSuffix
} from './src/core/graph-data.js';
import { extractHtmlFromFile, parseCurriculumHtml } from './src/core/file-parser.js';
import { initializeMermaid, buildMermaidCode, renderMermaidSvg } from './src/legacy/mermaid-engine.js';
import { buildDagreLayout } from './src/custom/dagre-layout.js';
import { buildYearTermLayout } from './src/custom/year-term-layout.js';
import { renderDagreLayout } from './src/custom/d3-renderer.js';
import { animateCustomNodeSelection, clearCustomAnimations, stripInlineVisuals } from './src/custom/animation-controller.js';
import { applyTrace, clearTrace, applyHoverPreview, clearHoverPreview } from './src/custom/trace-engine.js';
import { clearDimming } from './src/custom/dimming-engine.js';
import { applySubjectState } from './src/custom/subject-state-engine.js';
import { applyYearTermBadges, clearYearTermBadges } from './src/custom/year-term-badge.js';
import { buildObstacleAwarePath } from './src/custom/path-utils.js';

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

/* 3b-i. Layout Mode — Default (dagre-locked) vs Custom (draggable, persisted snapshot) vs Year/Term (fixed grid) */
const LAYOUT_MODE_STORAGE_KEY = 'portal_parser_layout_mode';
let layoutMode = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) || 'default'; // 'default' | 'custom' | 'year-term'

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
async function dispatchToActiveEngine(mermaidCode, options) {
    if (activeEngine === 'custom') {
        await renderWithCustomEngine(mermaidCode, options);
        return;
    }
    await renderMermaidCode(mermaidCode, options);
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
    updateSubjectInfoPanel();
    if (mermaidRawCode) dispatchToActiveEngine(mermaidRawCode);
}

function updateEngineToggleUI() {
    const isLegacy = activeEngine === 'legacy';
    const isCustom = activeEngine === 'custom';
    // Keep the inline strip and the rail's duplicated engine toggle in sync
    for (const legacyBtn of [engineLegacyBtn, engineLegacyBtnRail]) {
        legacyBtn.classList.toggle('is-active', isLegacy);
        legacyBtn.setAttribute('aria-pressed', String(isLegacy));
    }
    for (const customBtn of [engineCustomBtn, engineCustomBtnRail]) {
        customBtn.classList.toggle('is-active', isCustom);
        customBtn.setAttribute('aria-pressed', String(isCustom));
    }
    // Layout controls only apply to the custom engine
    layoutOptionsGroup.classList.toggle('is-hidden', !isCustom);
}

function updateLayoutUI() {
    layoutDirLrBtn.classList.toggle('is-active', layoutDirection === 'LR');
    layoutDirTbBtn.classList.toggle('is-active', layoutDirection === 'TB');
    layoutDirLrBtn.setAttribute('aria-pressed', String(layoutDirection === 'LR'));
    layoutDirTbBtn.setAttribute('aria-pressed', String(layoutDirection === 'TB'));
    layoutSpacingSelect.value = layoutSpacing;
    layoutSpacingSelect._syncGlassDropdown?.();

    // Mode buttons + control visibility: Custom hides the auto-layout controls and reveals Reset;
    // Year/Term needs neither (it's a fixed grid, not a dagre-direction/spacing concern)
    const isCustom = layoutMode === 'custom';
    const isYearTerm = layoutMode === 'year-term';
    layoutModeDefaultBtn.classList.toggle('is-active', !isCustom && !isYearTerm);
    layoutModeCustomBtn.classList.toggle('is-active', isCustom);
    layoutModeYearTermBtn.classList.toggle('is-active', isYearTerm);
    layoutModeDefaultBtn.setAttribute('aria-pressed', String(!isCustom && !isYearTerm));
    layoutModeCustomBtn.setAttribute('aria-pressed', String(isCustom));
    layoutModeYearTermBtn.setAttribute('aria-pressed', String(isYearTerm));
    layoutAutoControls.classList.toggle('is-hidden', isCustom || isYearTerm);
    layoutResetBtn.classList.toggle('is-hidden', !isCustom);

    // Year/Term mode requires year/term data — unavailable only for legacy mermaid imports
    // with no source year/term info (uploaded HTML and presets both supply it)
    const hasYearTermData = getCourseYearTermMap().size > 0;
    layoutModeYearTermBtn.disabled = !hasYearTermData;
    layoutModeYearTermBtn.title = hasYearTermData
        ? ''
        : 'This curriculum has no year/term data available';
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
    currentCurriculumName = file.name.replace(/\.(mhtml?|html)$/i, '');
    const rawHtml = await extractHtmlFromFile(file);
    await parseAndRender(rawHtml);
}

/* 6. Parsing & Engine Dispatch */
async function parseAndRender(html) {
    const { courses, courseTitleMap: parsedTitleMap, courseYearTermMap: parsedYearTermMap } = parseCurriculumHtml(html);

    if (courses.length === 0) {
        container.innerHTML = '<p class="status-message status-message--error">Error: Couldn\'t extract course data. Ensure this is a valid portal HTML/MHTML export.</p>';
        return;
    }

    const mermaidCode = buildMermaidCode(courses);
    await dispatchToActiveEngine(mermaidCode, { yearTermMap: parsedYearTermMap });
    // Render functions extract titles from mermaid (safe for presets); restore the
    // richer HTML-parsed map after so dock labels preserve parens and other special chars.
    setCourseTitleMap(parsedTitleMap);
    setCourseYearTermMap(parsedYearTermMap);
    updateLayoutUI();
}

// Expose to window for the Companion Extension hook
window.parseAndRender = parseAndRender;

// Cached so subject-state badges survive a layout-mode/engine switch without a fresh
// companion sync — re-applied after every custom-engine render (see renderWithCustomEngine).
let lastSubjectStateMap = new Map();

// Subject State only makes sense for the custom (Dagre/D3) engine — legacy Mermaid
// SVG nodes don't carry the stable data-course-code attribute this relies on.
window.applySubjectState = function (stateMap) {
    lastSubjectStateMap = stateMap;
    updateSubjectInfoPanel();
    if (activeEngine !== 'custom') return;
    applySubjectState(container.querySelector('svg'), stateMap);
};

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
    currentCurriculumName = preset.label;

    try {
        const presetContent = preset.content.trim();
        // Presets carry their own year/term data via "%% FIRST YEAR - 1ST TERM" comment
        // markers (see src/CST.txt etc.) instead of an uploaded curriculum's HTML table.
        await dispatchToActiveEngine(presetContent, { yearTermMap: extractYearTermMapFromMermaidComments(presetContent) });
        updateLayoutUI();
    } catch (error) {
        console.error('Preset load error:', error);
        container.innerHTML = '<p class="status-message status-message--error">Failed to load preset curriculum.</p>';
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

/* 8. Render Orchestration (Legacy Engine) */
const appShell       = document.querySelector('.app-shell');
const container      = document.getElementById('graph-container');
const controls       = document.getElementById('controls');
const emptyStage     = document.getElementById('empty-stage');
const previewCardTitle = document.getElementById('preview-card-title');
const previewExpandBtn = document.getElementById('preview-expand-btn');

let currentCurriculumName = '';

async function renderMermaidCode(mermaidCode, { yearTermMap } = {}) {
    mermaidRawCode = mermaidCode;

    const wasEmpty = appShell.dataset.appState === 'empty';
    const beforeTop = wasEmpty ? emptyStage.getBoundingClientRect().top : 0;

    setAppState('loaded');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';
    selectedNodeId = null;
    resetAdjacencyGraph();
    setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));
    // Omitting yearTermMap means "same graph, just re-rendering" (engine/settings toggle) — preserve
    // whatever's already set. Callers loading genuinely new graph data must pass an explicit map.
    setCourseYearTermMap(yearTermMap ?? getCourseYearTermMap());

    try {
        const svg = await renderMermaidSvg(mermaidCode);
        container.innerHTML = svg;
        resetZoom();
        buildAdjacencyGraph(container.querySelector('svg'), mermaidRawCode);
        updatePreviewCardMeta();
        if (wasEmpty) animateLoadedEntry(beforeTop);
        attachNodeClickListeners();
    } catch (err) {
        console.error('Mermaid error:', err);
        container.innerHTML = '<p class="status-message status-message--error">Failed to render graph visually. You can still copy the raw code.</p>';
    }
}

/* 9. Render Orchestration (Custom Engine) */
async function renderWithCustomEngine(mermaidCode, { yearTermMap } = {}) {
    mermaidRawCode = mermaidCode;

    const wasEmpty = appShell.dataset.appState === 'empty';
    const beforeTop = wasEmpty ? emptyStage.getBoundingClientRect().top : 0;

    setAppState('loaded');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';
    selectedNodeId = null;
    resetAdjacencyGraph();
    setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));
    // Omitting yearTermMap means "same graph, just re-rendering" (layout/engine/settings toggle) —
    // preserve whatever's already set. Callers loading genuinely new graph data must pass an explicit map.
    setCourseYearTermMap(yearTermMap ?? getCourseYearTermMap());

    // Build adjacency graph from code before layout — no SVG needed
    buildAdjacencyGraphFromMermaidCode(mermaidCode);

    const spacing = SPACING_PRESETS[layoutSpacing] ?? SPACING_PRESETS.normal;
    const layoutGraph = (layoutMode === 'year-term' && getCourseYearTermMap().size > 0)
        ? buildYearTermLayout()
        : buildDagreLayout({ rankdir: layoutDirection, ...spacing });
    renderDagreLayout(layoutGraph, container);
    if (layoutMode === 'year-term') rerouteAllEdges(container.querySelector('svg'));

    // Re-apply badges on every render — they don't survive a fresh SVG build otherwise.
    // Year/Term badges are redundant once grid position already conveys year/term.
    const svgElement = container.querySelector('svg');
    if (layoutMode === 'year-term') {
        clearYearTermBadges(svgElement);
    } else {
        applyYearTermBadges(svgElement, getCourseYearTermMap());
    }
    if (lastSubjectStateMap.size > 0) applySubjectState(svgElement, lastSubjectStateMap);
    updateSubjectInfoPanel();

    // Capture dagre's positions as the baseline a custom snapshot is measured against
    lastDagreBaseline = new Map();
    layoutGraph.nodes().forEach((courseCode) => {
        const node = layoutGraph.node(courseCode);
        lastDagreBaseline.set(courseCode, { x: node.x, y: node.y });
    });

    if (layoutMode === 'custom') applyCustomPositions();

    fitGraphToPreviewViewBox();
    updatePreviewCardMeta();
    if (wasEmpty) animateLoadedEntry(beforeTop);

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
    const svgElement = container.querySelector('svg');

    // If already selected, this is a trace toggle — clear existing trace first to reset the view before applying new one.
    if (selectedNodeId) clearAllHighlights();
    clearHoverPreview(svgElement);
    stripInlineVisuals(svgElement);
    clearTrace(svgElement);

    // Terminal course — nothing unlocks from here. Leave the cleared (un-dimmed) view.
    if (visitedEdges.size === 0) {
        tracedNodeId = null;
        lastTraceActionAt = Date.now();
        return;
    }

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

/** Parses `translate(x, y)` from a node group's transform attribute */
function parseNodeTranslate(nodeElement) {
    const match = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(nodeElement.getAttribute('transform') ?? '');
    return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
}

/** Reads center + half-extents from transform and data-w/data-h attributes */
function getNodeGeometry(svgElement, courseCode) {
    const nodeElement = svgElement.querySelector(`[data-course-code="${courseCode}"]`);
    if (!nodeElement) return null;

    const translate = parseNodeTranslate(nodeElement);
    const width = parseFloat(nodeElement.getAttribute('data-w')) || 0;
    const height = parseFloat(nodeElement.getAttribute('data-h')) || 0;
    return { x: translate.x, y: translate.y, halfWidth: width / 2, halfHeight: height / 2 };
}

/** Builds a Map<courseCode, geo> for all nodes in one DOM pass — avoids repeated per-edge queries */
function buildAllNodeGeoMap(svgElement) {
    const geoMap = new Map();
    getGraphNodes(svgElement).forEach((nodeElement) => {
        const courseCode = nodeElement.getAttribute('data-course-code');
        if (!courseCode) return;
        const translate = parseNodeTranslate(nodeElement);
        const width = parseFloat(nodeElement.getAttribute('data-w')) || 0;
        const height = parseFloat(nodeElement.getAttribute('data-h')) || 0;
        geoMap.set(courseCode, { x: translate.x, y: translate.y, halfWidth: width / 2, halfHeight: height / 2 });
    });
    return geoMap;
}

/** Routes a single edge around every other node, writing the resulting path back to the DOM */
function routeEdgeElement(edgeElement, allNodeGeos) {
    const sourceCode = edgeElement.getAttribute('data-source');
    const targetCode = edgeElement.getAttribute('data-target');

    const sourceGeo = allNodeGeos.get(sourceCode);
    const targetGeo = allNodeGeos.get(targetCode);
    if (!sourceGeo || !targetGeo) return;

    const obstacleGeos = [];
    allNodeGeos.forEach((geo, code) => {
        if (code !== sourceCode && code !== targetCode) obstacleGeos.push(geo);
    });

    const { points, d } = buildObstacleAwarePath(sourceGeo, targetGeo, obstacleGeos);
    const path = edgeElement.querySelector('path');
    if (!path) return;
    path.setAttribute('d', d);
    path.setAttribute('data-points', JSON.stringify(points));
}

/** Redraws every edge touching a node using obstacle-aware routing */
function rerouteEdgesForNode(svgElement, courseCode) {
    const allNodeGeos = buildAllNodeGeoMap(svgElement);
    if (!allNodeGeos.has(courseCode)) return;

    getGraphEdges(svgElement).forEach((edgeElement) => {
        const sourceCode = edgeElement.getAttribute('data-source');
        const targetCode = edgeElement.getAttribute('data-target');
        if (sourceCode !== courseCode && targetCode !== courseCode) return;
        routeEdgeElement(edgeElement, allNodeGeos);
    });
}

/** Redraws every edge in the graph using obstacle-aware routing — used after layouts that skip dagre's own edge bend points */
function rerouteAllEdges(svgElement) {
    if (!svgElement) return;
    const allNodeGeos = buildAllNodeGeoMap(svgElement);
    getGraphEdges(svgElement).forEach((edgeElement) => routeEdgeElement(edgeElement, allNodeGeos));
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

/* 11b. Subject State Legend + Completion Stats */
const subjectInfoStack = document.getElementById('subject-info-stack');
const subjectStateLegend = document.getElementById('subject-state-legend');
const statsCompletedEl = document.getElementById('stats-completed');
const statsIncompleteEl = document.getElementById('stats-incomplete');
const statsTotalEl = document.getElementById('stats-total');
const statsRemainingEl = document.getElementById('stats-remaining');

/** Groups every node's course code by its lecture/lab-normalized base (CCS0003 + CCS0003L
    count once) and buckets each subject as completed/incomplete/unknown against the last
    synced subject-state map. "Unknown" covers subjects with no entry in the map at all —
    distinct from "incomplete" (pending/active/failed), which has a known non-passed status. */
function computeSubjectStatistics() {
    const subjectsByBaseCode = new Map();
    getAdjacencyGraph().forEach((_edges, courseCode) => {
        const baseCode = stripLabSuffix(courseCode);
        if (!subjectsByBaseCode.has(baseCode)) subjectsByBaseCode.set(baseCode, []);
        subjectsByBaseCode.get(baseCode).push(courseCode);
    });

    let completed = 0;
    let incomplete = 0;
    subjectsByBaseCode.forEach((courseCodes) => {
        const states = courseCodes.map((code) => lastSubjectStateMap.get(code)).filter(Boolean);
        if (states.length === 0) return; // unknown — no synced data for this subject
        if (states.every((state) => state === 'passed')) completed += 1;
        else incomplete += 1;
    });

    const total = subjectsByBaseCode.size;
    return { total, completed, incomplete, remaining: total - completed };
}

/** Renders the completion-stats card; falls back to "Needs Sync Data" for every value
    except Total (computable from the curriculum alone) until a subject-state sync happens. */
function renderSubjectStatistics() {
    const { total, completed, incomplete, remaining } = computeSubjectStatistics();
    statsTotalEl.textContent = String(total);

    const hasSyncedData = lastSubjectStateMap.size > 0;
    [
        [statsCompletedEl, completed],
        [statsIncompleteEl, incomplete],
        [statsRemainingEl, remaining]
    ].forEach(([element, value]) => {
        element.classList.toggle('is-unsynced', !hasSyncedData);
        element.textContent = hasSyncedData ? String(value) : 'Needs Sync Data';
    });
}

/** Shows the legend + stats stack for the custom engine only (badges don't render for legacy
    Mermaid, so the legend would otherwise be left dangling); the legend within additionally
    needs a subject-state sync to have actually happened, the stats card does not. */
function updateSubjectInfoPanel() {
    const isCustomEngine = activeEngine === 'custom';
    subjectInfoStack.classList.toggle('is-hidden', !isCustomEngine);
    subjectStateLegend.classList.toggle('is-hidden', !(isCustomEngine && lastSubjectStateMap.size > 0));
    renderSubjectStatistics();
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
    if (mermaidRawCode === '' || !isFullView) return;
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
    if (!panning || mermaidRawCode === '' || !isFullView) return;
    e.preventDefault();
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    didPan = true;
    setTransform();
});

wrapper.addEventListener('wheel', (e) => {
    if (mermaidRawCode === '' || !isFullView) return;
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
    if (mermaidRawCode === '' || !isFullView) return;

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
    if (mermaidRawCode === '' || !isFullView) return;
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
const layoutModeYearTermBtn = document.getElementById('layout-mode-year-term');
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
const exportPngBtn = document.getElementById('export-png-btn');

// Full-view dock: duplicated engine + config controls (share handlers with their inline twins)
const controlDock = document.getElementById('control-dock');
const dockCollapseBtn = document.getElementById('dock-collapse-btn');
const dockRevealBtn = document.getElementById('dock-reveal-btn');
const engineLegacyBtnRail = document.getElementById('engine-legacy-btn-rail');
const engineCustomBtnRail = document.getElementById('engine-custom-btn-rail');
const exportConfigBtnRail = document.getElementById('export-config-btn-rail');
const importConfigInputRail = document.getElementById('import-config-input-rail');
const exportPngBtnRail = document.getElementById('export-png-btn-rail');

engineLegacyBtn.addEventListener('click', () => switchEngine('legacy'));
engineCustomBtn.addEventListener('click', () => switchEngine('custom'));
engineLegacyBtnRail.addEventListener('click', () => switchEngine('legacy'));
engineCustomBtnRail.addEventListener('click', () => switchEngine('custom'));

/* Dock collapse / reveal — GSAP morphs the bar toward the bottom-right corner pill and back,
   matching the file's fluid liquid-glass vocabulary. State is driven by `.is-collapsed`. */
function setDockCollapsed(collapsed) {
    gsap.killTweensOf([controlDock, dockRevealBtn]);
    dockCollapseBtn.setAttribute('aria-expanded', String(!collapsed));

    if (collapsed) {
        controlDock.classList.add('is-collapsed');
        gsap.to(controlDock, {
            opacity: 0, scale: 0.6, y: 24, x: 40,
            duration: 0.32, ease: 'cubic-bezier(0.4, 0, 0.6, 1)',
            onComplete: () => {
                dockRevealBtn.classList.remove('is-hidden');
                gsap.fromTo(dockRevealBtn,
                    { opacity: 0, scale: 0.4 },
                    { opacity: 1, scale: 1, duration: 0.32, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
                );
            }
        });
        return;
    }

    gsap.to(dockRevealBtn, {
        opacity: 0, scale: 0.4, duration: 0.18, ease: 'cubic-bezier(0.4, 0, 0.6, 1)',
        onComplete: () => {
            dockRevealBtn.classList.add('is-hidden');
            controlDock.classList.remove('is-collapsed');
            gsap.fromTo(controlDock,
                { opacity: 0, scale: 0.6, y: 24, x: 40 },
                {
                    opacity: 1, scale: 1, y: 0, x: 0,
                    duration: 0.42, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    onComplete: () => gsap.set(controlDock, { clearProps: 'opacity,scale,y,x' })
                }
            );
        }
    });
}

dockCollapseBtn.addEventListener('click', () => setDockCollapsed(true));
dockRevealBtn.addEventListener('click', () => setDockCollapsed(false));

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
layoutModeYearTermBtn.addEventListener('click', () => setLayoutMode('year-term'));
layoutResetBtn.addEventListener('click', resetCustomLayout);

/* Chain Depth */
function updateDepthUI() {
    prereqDepthSelect.value = prereqDepthSetting;
    traceDepthSelect.value = traceDepthSetting;
    prereqDepthSelect._syncGlassDropdown?.();
    traceDepthSelect._syncGlassDropdown?.();
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

/* Custom glass dropdown — progressively enhances a native <select> into a liquid-glass
   listbox that opens upward (the dock sits at the bottom). The native <select> stays in the
   DOM, hidden, as the single source of truth, so the existing `change` handlers keep working
   untouched. Full keyboard a11y (Arrow/Enter/Esc/Home/End) is re-implemented on the trigger. */
function enhanceSelectAsGlassDropdown(selectElement) {
    if (!selectElement) return;
    const options = Array.from(selectElement.options).map((option) => ({ value: option.value, label: option.textContent }));
    const baseId = selectElement.id || `glass-${Math.random().toString(36).slice(2)}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'glass-select';
    selectElement.parentNode.insertBefore(wrapper, selectElement);
    wrapper.appendChild(selectElement);
    selectElement.classList.add('glass-select__native');
    selectElement.setAttribute('tabindex', '-1');
    selectElement.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'glass-select__trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const nativeLabel = selectElement.getAttribute('aria-label');
    if (nativeLabel) trigger.setAttribute('aria-label', nativeLabel);

    const list = document.createElement('ul');
    list.className = 'glass-select__list is-hidden';
    list.setAttribute('role', 'listbox');
    list.id = `${baseId}-listbox`;
    trigger.setAttribute('aria-controls', list.id);

    const optionElements = options.map((option, index) => {
        const item = document.createElement('li');
        item.className = 'glass-select__option';
        item.setAttribute('role', 'option');
        item.id = `${baseId}-opt-${index}`;
        item.dataset.value = option.value;
        item.textContent = option.label;
        item.addEventListener('click', () => commitSelection(index));
        list.appendChild(item);
        return item;
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(list);

    let isOpen = false;
    let activeIndex = Math.max(0, options.findIndex((option) => option.value === selectElement.value));

    function indexOfValue() {
        return Math.max(0, options.findIndex((option) => option.value === selectElement.value));
    }

    function syncTriggerLabel() {
        const selected = options.find((option) => option.value === selectElement.value) || options[0];
        trigger.textContent = selected ? selected.label : '';
        optionElements.forEach((item, index) =>
            item.setAttribute('aria-selected', String(options[index].value === selectElement.value)));
    }

    function setActive(index) {
        activeIndex = (index + options.length) % options.length;
        optionElements.forEach((item, i) => item.classList.toggle('is-active', i === activeIndex));
        trigger.setAttribute('aria-activedescendant', optionElements[activeIndex].id);
        optionElements[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function openList() {
        if (isOpen) return;
        isOpen = true;
        list.classList.remove('is-hidden');
        trigger.setAttribute('aria-expanded', 'true');
        setActive(indexOfValue());
        gsap.fromTo(list,
            { opacity: 0, scale: 0.85, y: 6 },
            { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: 'cubic-bezier(0.25, 1, 0.3, 1)' }
        );
        document.addEventListener('pointerdown', onOutsidePointer, true);
    }

    function closeList(returnFocus) {
        if (!isOpen) return;
        isOpen = false;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-activedescendant');
        document.removeEventListener('pointerdown', onOutsidePointer, true);
        gsap.killTweensOf(list);
        gsap.to(list, {
            opacity: 0, scale: 0.9, duration: 0.12, ease: 'cubic-bezier(0.4, 0, 0.6, 1)',
            onComplete: () => { list.classList.add('is-hidden'); gsap.set(list, { clearProps: 'opacity,scale,y' }); }
        });
        if (returnFocus) trigger.focus();
    }

    function commitSelection(index) {
        const option = options[index];
        if (option && selectElement.value !== option.value) {
            selectElement.value = option.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncTriggerLabel();
        closeList(true);
    }

    function onOutsidePointer(event) {
        if (!wrapper.contains(event.target)) closeList(false);
    }

    trigger.addEventListener('click', () => (isOpen ? closeList(true) : openList()));
    trigger.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                if (!isOpen) { openList(); break; }
                setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen) commitSelection(activeIndex); else openList();
                break;
            case 'Escape':
                if (isOpen) { event.preventDefault(); closeList(true); }
                break;
            case 'Home':
                if (isOpen) { event.preventDefault(); setActive(0); }
                break;
            case 'End':
                if (isOpen) { event.preventDefault(); setActive(options.length - 1); }
                break;
        }
    });

    // Lets updateLayoutUI / updateDepthUI refresh the visible label after a programmatic
    // `select.value = …` (which doesn't fire `change`), keeping the custom UI in sync.
    selectElement._syncGlassDropdown = syncTriggerLabel;
    syncTriggerLabel();
}

[layoutSpacingSelect, prereqDepthSelect, traceDepthSelect].forEach(enhanceSelectAsGlassDropdown);

/* Generic hover/focus tooltip for icon-only buttons — shares the credit-tooltip glass look,
   positioned above the target (the dock buttons live at the bottom of the viewport). */
const uiTooltip = document.createElement('div');
uiTooltip.className = 'ui-tooltip';
document.body.appendChild(uiTooltip);

function showUiTooltip(label, targetElement) {
    uiTooltip.textContent = label;
    uiTooltip.classList.add('visible');
    const rect = targetElement.getBoundingClientRect();
    uiTooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    uiTooltip.style.top = `${rect.top + window.scrollY - uiTooltip.offsetHeight - 8}px`;
}

function hideUiTooltip() {
    uiTooltip.classList.remove('visible');
}

let flashUiMessageTimeoutId = null;

// One-off transient message (e.g. export failures) near a target element — distinct from the
// persistent hover tooltip above, but reuses the same floating element to avoid a second UI component.
function flashUiMessage(label, targetElement, { isError = false, durationMs = 3200 } = {}) {
    if (flashUiMessageTimeoutId) clearTimeout(flashUiMessageTimeoutId);
    uiTooltip.classList.toggle('is-error', isError);
    showUiTooltip(label, targetElement);
    flashUiMessageTimeoutId = setTimeout(() => {
        hideUiTooltip();
        uiTooltip.classList.remove('is-error');
        flashUiMessageTimeoutId = null;
    }, durationMs);
}

function attachTooltip(element, label) {
    if (!element || !label) return;
    element.addEventListener('mouseenter', () => showUiTooltip(label, element));
    element.addEventListener('mouseleave', hideUiTooltip);
    element.addEventListener('focus', () => showUiTooltip(label, element));
    element.addEventListener('blur', hideUiTooltip);
}

// Icon-only buttons: surface their aria-label as a hover tooltip
[
    exportConfigBtn, exportConfigBtnRail,
    document.querySelector('label[for="import-config-input"]'),
    document.querySelector('label[for="import-config-input-rail"]'),
    exportPngBtn, exportPngBtnRail,
    layoutResetBtn,
    document.getElementById('zoom-out'),
    document.getElementById('zoom-in'),
    document.getElementById('zoom-reset')
].forEach((element) => attachTooltip(element, element && element.getAttribute('aria-label')));

/* Config Export / Import */
function exportConfig() {
    const config = {
        version: 2,
        engine: activeEngine,
        layoutDirection,
        layoutSpacing,
        prereqDepth: prereqDepthSetting,
        traceDepth: traceDepthSetting,
        subjectState: Object.fromEntries(lastSubjectStateMap)
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'portal-parser-config.json';
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
}

function importConfig(jsonText, triggerElement) {
    let config;
    try {
        config = JSON.parse(jsonText);
    } catch (error) {
        console.error('Config import error:', error);
        flashUiMessage("Couldn't read that file — is it a valid config JSON?", triggerElement, { isError: true });
        return;
    }

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
    if (config.subjectState && Object.keys(config.subjectState).length > 0) {
        window.applySubjectState(new Map(Object.entries(config.subjectState)));
    }
    updateDepthUI();
    // Re-render with the imported settings if a graph is loaded
    if (mermaidRawCode) dispatchToActiveEngine(mermaidRawCode);
}

// Shared by the inline strip and the rail's duplicated config input
function handleConfigFileChange(event) {
    const inputElement = event.target;
    const file = inputElement.files[0];
    if (!file) return;
    const labelElement = document.querySelector(`label[for="${inputElement.id}"]`);
    const reader = new FileReader();
    reader.onload = (loadEvent) => importConfig(loadEvent.target.result, labelElement);
    reader.onerror = () => {
        console.error('Config file read error:', reader.error);
        flashUiMessage("Couldn't read that file.", labelElement, { isError: true });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    inputElement.value = '';
}

exportConfigBtn.addEventListener('click', exportConfig);
importConfigInput.addEventListener('change', handleConfigFileChange);
exportConfigBtnRail.addEventListener('click', exportConfig);
importConfigInputRail.addEventListener('change', handleConfigFileChange);

/* PNG Export */
function buildCustomEngineCssText() {
    const collectedRules = [];
    const collectFromRuleList = (cssRules) => {
        Array.from(cssRules).forEach((rule) => {
            if (rule instanceof CSSMediaRule) {
                collectFromRuleList(rule.cssRules);
            } else if (rule.selectorText?.includes('custom-engine-svg')) {
                collectedRules.push(rule.cssText);
            }
        });
    };
    Array.from(document.styleSheets).forEach((sheet) => {
        try {
            collectFromRuleList(sheet.cssRules);
        } catch {
            // Cross-origin stylesheet; none expected among this app's same-origin assets
        }
    });
    return collectedRules.join('\n');
}

async function exportGraphAsPng(triggerElement) {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    try {
        // Clone first so clearing selection/trace state never touches the live, on-screen graph
        const clonedSvg = svgElement.cloneNode(true);
        clearDimming(clonedSvg);
        clearTrace(clonedSvg);

        if (clonedSvg.classList.contains('custom-engine-svg')) {
            const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            styleElement.textContent = buildCustomEngineCssText();
            clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
        }

        // viewBox covers the full graph regardless of current zoom/pan (a CSS transform on the container, not the SVG)
        const { width, height } = clonedSvg.viewBox.baseVal;
        const pngBlob = await toBlob(clonedSvg, { width, height, backgroundColor: '#020617' });
        if (!pngBlob) throw new Error('toBlob returned no image data');

        const downloadUrl = URL.createObjectURL(pngBlob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = 'portal-parser-graph.png';
        anchor.click();
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('PNG export error:', error);
        flashUiMessage("Couldn't export image. Try again.", triggerElement, { isError: true });
    }
}

exportPngBtn.addEventListener('click', () => exportGraphAsPng(exportPngBtn));
exportPngBtnRail.addEventListener('click', () => exportGraphAsPng(exportPngBtnRail));

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
    setAppState('full-view');

    // On mobile the dock would otherwise dominate the screen on first open — start
    // collapsed (small tab, tap to expand) instead. Desktop/laptop keep opening expanded.
    if (window.matchMedia('(max-width: 720px)').matches) {
        controlDock.classList.add('is-collapsed');
        dockRevealBtn.classList.remove('is-hidden');
        dockCollapseBtn.setAttribute('aria-expanded', 'false');
        gsap.set(controlDock, { opacity: 0, scale: 0.6, y: 24, x: 40 });
        gsap.set(dockRevealBtn, { opacity: 1, scale: 1 });
    } else {
        // Dock opens expanded — reset state, hide the reveal pill, clear any stale transform
        controlDock.classList.remove('is-collapsed');
        dockRevealBtn.classList.add('is-hidden');
        dockCollapseBtn.setAttribute('aria-expanded', 'true');
        gsap.set(controlDock, { clearProps: 'opacity,scale,y,x' });

        // Fluid settle of the dock's controls, mirroring the preview card's entry language.
        // clearProps on completion so no inline transform lingers (kept dropdowns from opening).
        const dockGroups = controlDock.querySelectorAll('.dock-row');
        gsap.fromTo(dockGroups,
            { opacity: 0, y: 12 },
            {
                opacity: 1, y: 0, duration: 0.42, ease: 'cubic-bezier(0.25, 1, 0.3, 1)', stagger: 0.05, delay: 0.12,
                onComplete: () => gsap.set(dockGroups, { clearProps: 'opacity,y' })
            }
        );
    }

    gsap.fromTo(wrapper,
        { opacity: 0, scale: 0.96, y: 16 },
        {
            opacity: 1, scale: 1, y: 0,
            duration: 0.52,
            ease: 'cubic-bezier(0.25, 1, 0.3, 1)',
            onComplete: () => {
                gsap.set(wrapper, { clearProps: 'opacity,scale,y' });
                isViewTransitioning = false;
            }
        }
    );
});

function closeFullView() {
    if (!isFullView || isViewTransitioning) return;

    isViewTransitioning = true;
    closeSummaryDock();

    gsap.to(wrapper, {
        opacity: 0, scale: 0.97, y: 10,
        duration: 0.32,
        ease: 'cubic-bezier(0.4, 0, 0.6, 1)',
        onComplete: () => {
            setAppState('loaded');
            // Full-view pan writes a CSS transform to the shared container; clear it so the preview isn't displaced
            resetZoom();
            fitGraphToPreviewViewBox();
            isViewTransitioning = false;
            gsap.set(wrapper, { clearProps: 'opacity,scale,y' });
        }
    });
}

/* App state machine — drives data-app-state on the shell; CSS responds declaratively */
function setAppState(state) {
    appShell.dataset.appState = state;
    isFullView = state === 'full-view';
    document.body.classList.toggle('modal-open', state === 'full-view');
}

/* Fits the custom-engine SVG viewBox to the actual node bounds for the preview card.
   Uses .nodes-layer.getBBox() so padding is tight around rendered content. */
function fitGraphToPreviewViewBox() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;
    const nodesLayer = svgElement.querySelector('.nodes-layer');
    if (!nodesLayer) return;
    const bbox = nodesLayer.getBBox();
    const padding = 40;
    svgElement.setAttribute('viewBox',
        `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
    );
}

/* Populates the preview card title bar with curriculum name and graph metrics. */
function updatePreviewCardMeta() {
    const svgElement = container.querySelector('svg');
    const nodeCount = svgElement ? getGraphNodes(svgElement).length : 0;
    const edgeCount = svgElement ? getGraphEdges(svgElement).length : 0;
    const meta = `${currentCurriculumName} · ${nodeCount} nodes · ${edgeCount} edges`;
    previewCardTitle.textContent = meta;
    previewCardTitle.setAttribute('title', meta);
}

/* FLIP slide-up of the empty-stage cluster + preview card reveal.
   beforeTop is the cluster's getBoundingClientRect().top captured before setAppState changed the layout. */
function animateLoadedEntry(beforeTop) {
    const afterTop = emptyStage.getBoundingClientRect().top;
    const deltaY = beforeTop - afterTop;

    gsap.fromTo(emptyStage,
        { y: deltaY },
        { y: 0, duration: 0.42, ease: 'cubic-bezier(0.25, 1, 0.3, 1)' }
    );
    gsap.fromTo(wrapper,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.52, ease: 'cubic-bezier(0.25, 1, 0.3, 1)', delay: 0.08 }
    );
}

/* Reverse of animateLoadedEntry — settles the cluster back into its centered position after
   the preview card has retreated. beforeTop is captured before setAppState moves the cluster
   from its loaded (top) position to its centered (empty) position. */
function animateResetEntry(beforeTop) {
    const afterTop = emptyStage.getBoundingClientRect().top;
    const deltaY = beforeTop - afterTop;

    gsap.fromTo(emptyStage,
        { y: deltaY },
        { y: 0, duration: 0.42, ease: 'cubic-bezier(0.4, 0, 0.6, 1)' }
    );
}

deselectBtnFull.addEventListener('click', clearAllHighlights);
fullViewCloseBtn.addEventListener('click', closeFullView);
previewExpandBtn.addEventListener('click', () => fullViewBtn.click());

// Whole preview card opens full view; idempotent with the expand button (fullViewBtn guards re-entry)
wrapper.addEventListener('click', () => {
    if (appShell.dataset.appState !== 'loaded') return;
    fullViewBtn.click();
});

resetBtn.addEventListener('click', () => {
    if (isViewTransitioning) {
        gsap.killTweensOf(wrapper);
        isViewTransitioning = false;
    }

    closeSummaryDock();

    // Preview card retreats first (mirrors closeFullView's exit language), then the
    // header/dropzone/preset cluster settles back into its centered empty-state position.
    gsap.to(wrapper, {
        opacity: 0, scale: 0.97, y: 10,
        duration: 0.32,
        ease: 'cubic-bezier(0.4, 0, 0.6, 1)',
        onComplete: () => {
            const beforeTop = emptyStage.getBoundingClientRect().top;
            setAppState('empty');
            animateResetEntry(beforeTop);

            currentCurriculumName = '';
            previewCardTitle.textContent = '';
            container.innerHTML = '<p id="status-text" class="status-text">Waiting for MHTML or HTML file...</p>';
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
            gsap.set(wrapper, { clearProps: 'opacity,scale,y,transform' });
            resetZoom();
        }
    });
});

/* Keyboard navigation hint helpers */

/**
 * Anchors the hint beside the selected node, on the side OPPOSITE the nav direction
 * (so it never covers the candidate nodes it's letting you choose between), vertically
 * centered on the node, clamped within #graph-wrapper bounds with a margin.
 * Must be called after the hint's content is populated and `is-hidden` removed, since
 * a display:none element measures as zero-size.
 */
function anchorKeyNavHint(direction) {
    const svgElement = container.querySelector('svg');
    const nodeElement = svgElement?.querySelector(`[data-course-code="${selectedNodeId}"]`);
    if (!nodeElement) return null;

    const nodeRect = nodeElement.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const hintRect = keyNavHint.getBoundingClientRect();

    const margin = 16;
    const gap = 12;

    const anchorRight = direction === 'left'; // ArrowLeft (prerequisites) → hint goes right of node
    let left = anchorRight
        ? (nodeRect.right - wrapperRect.left) + gap
        : (nodeRect.left - wrapperRect.left) - hintRect.width - gap;
    let top = (nodeRect.top - wrapperRect.top) + (nodeRect.height / 2) - (hintRect.height / 2);

    left = Math.min(Math.max(left, margin), wrapperRect.width - hintRect.width - margin);
    top = Math.min(Math.max(top, margin), wrapperRect.height - hintRect.height - margin);

    return { left, top, transformOrigin: anchorRight ? 'left center' : 'right center' };
}

function showKeyNavHint(choices, directionLabel, direction) {
    const wasHidden = keyNavHint.classList.contains('is-hidden');

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

    gsap.killTweensOf(keyNavHint);
    const items = list.querySelectorAll('.key-nav-hint__item');

    if (wasHidden) {
        keyNavHint.classList.remove('is-hidden');
        const anchor = anchorKeyNavHint(direction);
        if (!anchor) { keyNavHint.classList.add('is-hidden'); return; }

        gsap.set(keyNavHint, { left: anchor.left, top: anchor.top, transformOrigin: anchor.transformOrigin, opacity: 0, scale: 0.05, borderRadius: '50%' });
        // Water-droplet spawn — two-stage morph (overshoot to 60% scale, settle to full size)
        gsap.timeline()
            .to(keyNavHint, { opacity: 1, scale: 0.6, y: -4, borderRadius: '38%', duration: 0.24, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
            .to(keyNavHint, { scale: 1, y: 0, borderRadius: '28px', duration: 0.36, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        gsap.fromTo(items,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.32, ease: 'cubic-bezier(0.25, 1, 0.3, 1)', stagger: 0.05, delay: 0.18 }
        );
    } else {
        const anchor = anchorKeyNavHint(direction);
        if (!anchor) return;
        gsap.to(keyNavHint, {
            left: anchor.left, top: anchor.top, transformOrigin: anchor.transformOrigin,
            duration: 0.18,
            ease: 'cubic-bezier(0.25, 1, 0.3, 1)'
        });
        gsap.fromTo(items,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.28, ease: 'cubic-bezier(0.25, 1, 0.3, 1)', stagger: 0.04 }
        );
    }
}

function hideKeyNavHint() {
    if (!keyNavChoices && keyNavHint.classList.contains('is-hidden')) return;

    keyNavChoices = null;
    keyNavDirection = null;

    gsap.killTweensOf(keyNavHint);
    // Water-droplet collapse — shrinks back toward the node it spawned from
    gsap.timeline({
        onComplete: () => {
            keyNavHint.classList.add('is-hidden');
            gsap.set(keyNavHint, { clearProps: 'opacity,scale,borderRadius,left,top,transformOrigin,y' });
        }
    })
        .to(keyNavHint, { scale: 0.4, borderRadius: '50%', duration: 0.192, ease: 'cubic-bezier(0.4, 0, 0.6, 1)' })
        .to(keyNavHint, { opacity: 0, scale: 0.05, duration: 0.128, ease: 'cubic-bezier(0.4, 0, 0.6, 1)' });
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
