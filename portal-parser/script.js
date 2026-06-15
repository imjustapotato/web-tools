/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Application orchestrator.
 * Routes file ingestion and rendering through the active engine.
 * All data-layer logic lives in src/core/; engine logic in src/legacy/ (and src/custom/ in v2).
 */
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
    extractCourseTitleMapFromMermaid,
    getCourseDisplayLabel,
    getGraphNodes,
    getGraphEdges,
    buildAdjacencyGraph,
    buildAdjacencyGraphFromMermaidCode,
    collectPrerequisiteChain,
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
import { animateCustomNodeSelection, clearCustomAnimations } from './src/custom/animation-controller.js';

/* 1. Engine Initialization */
initializeMermaid();

/* 2. Orchestration State */
let mermaidRawCode = '';
let selectedNodeId = null;
let activeSelectionTimeline = null;
let isViewTransitioning = false;

/* 3. Engine State */
const ENGINE_STORAGE_KEY = 'portal_parser_active_engine';
let activeEngine = localStorage.getItem(ENGINE_STORAGE_KEY) || 'custom';

/* 4. Engine Routing */
/**
 * Routes a render request to the active engine.
 * Phase 3: replace the custom branch with renderWithCustomEngine(mermaidCode).
 */
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
/**
 * Entry point for both file drop and the Companion Extension hook.
 * Parses raw HTML into course data and dispatches to the active render engine.
 */
async function parseAndRender(html) {
    const { courses, courseTitleMap: parsedTitleMap } = parseCurriculumHtml(html);

    if (courses.length === 0) {
        container.innerHTML = '<p class="status-message status-message--error">Error: Couldn\'t extract course data. Ensure this is a valid portal HTML/MHTML export.</p>';
        return;
    }

    setCourseTitleMap(parsedTitleMap);
    const mermaidCode = buildMermaidCode(courses);
    await dispatchToActiveEngine(mermaidCode);
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

    // For presets (no prior HTML parse), extract titles from the Mermaid node definitions
    if (getCourseTitleMap().size === 0) {
        setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));
    }

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

    if (getCourseTitleMap().size === 0) {
        setCourseTitleMap(extractCourseTitleMapFromMermaid(mermaidCode));
    }

    // Build adjacency graph from code before layout — no SVG needed
    buildAdjacencyGraphFromMermaidCode(mermaidCode);

    const layoutGraph = buildDagreLayout();
    renderDagreLayout(layoutGraph, container);

    resetZoom();
    attachNodeClickListeners();
}

/* 10. Interaction & Selection */
function attachNodeClickListeners() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    getGraphNodes(svgElement).forEach((nodeElement) => {
        nodeElement.style.cursor = 'pointer';
        nodeElement.addEventListener('click', handleNodeClick);
    });
}

function handleNodeClick(event) {
    event.stopPropagation();

    if (didPan) return;

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

    if (!isFullView) fullViewBtn.click();
    openSummaryDock();

    const svgElement = container.querySelector('svg');

    if (activeEngine === 'custom') {
        activeSelectionTimeline = animateCustomNodeSelection(courseCode, svgElement, activeSelectionTimeline);
    } else {
        activeSelectionTimeline = animateNodeSelection(courseCode, {
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
        });
    }
}

function clearAllHighlights() {
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Kill the running selection timeline FIRST. Its glow setters are GSAP callbacks
    // (not tweens), so the engine reset alone won't stop them — pending callbacks would
    // otherwise re-apply glows and continue the cascade after deselect.
    if (activeSelectionTimeline) {
        activeSelectionTimeline.kill();
        activeSelectionTimeline = null;
    }

    if (activeEngine === 'custom') {
        clearCustomAnimations(svgElement);
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

    // BFS distance map: distance 1 = direct prerequisites, 2+ = indirect
    const distanceMap = buildPrerequisiteDistanceMap(selectedCode);
    const directPrereqs = Array.from(distanceMap.entries())
        .filter(([, distance]) => distance === 1)
        .map(([code]) => code)
        .sort();

    const { visitedNodes } = collectPrerequisiteChain(selectedCode);
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

engineLegacyBtn.addEventListener('click', () => switchEngine('legacy'));
engineCustomBtn.addEventListener('click', () => switchEngine('custom'));

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
    resetGraphState();
    wrapper.classList.remove('is-panning');
    gsap.set(wrapper, { clearProps: 'transform' });
    resetZoom();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullView) closeFullView();
});

/* 15. Initialization */
buildPresetButtons();
updateEngineToggleUI();
