/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

import { parseSubjectStateHtml } from './src/core/file-parser.js';
import { getAdjacencyGraph } from './src/core/graph-data.js';

/**
 * Handles communication with the companion extension:
 * connection handshake, status UI updates, incoming curriculum syncs.
 */

const CURRICULUM_CACHE_KEY = 'portal_parser_curriculum_cache';
const CURRICULUM_JUST_SYNCED_KEY = 'portal_parser_curriculum_just_synced';
let hasLoadedFromSync = false;

/* 1. Status Pill (Dynamic Island) UI Management */
const companionStatusEl = document.getElementById('companion-status');
const companionStatusIcon = companionStatusEl?.querySelector('.companion-pill-icon');
const companionStatusTitle = companionStatusEl?.querySelector('.companion-pill-title');
const companionStatusSubtitle = companionStatusEl?.querySelector('.companion-pill-subtitle');

let companionExpansionTimeout = null;
let companionHoverTimeout = null;
let companionFlashRevertTimeout = null;

/* 1b. Empty-Curriculum Heads-Up (Subject State sync with nothing loaded to paint) */
const syncEmptyToastEl = document.getElementById('sync-empty-toast');
const syncEmptyToastCloseBtn = syncEmptyToastEl?.querySelector('.sync-empty-toast__close');
let syncEmptyToastTimeout = null;

// Surfaces a snarky heads-up when a subject state sync lands with no curriculum loaded
function showSyncEmptyToast() {
    if (!syncEmptyToastEl) return;
    if (syncEmptyToastTimeout) clearTimeout(syncEmptyToastTimeout);

    syncEmptyToastEl.classList.remove('is-hidden');
    requestAnimationFrame(() => syncEmptyToastEl.classList.add('is-visible'));

    syncEmptyToastTimeout = setTimeout(hideSyncEmptyToast, 4500);
}

function hideSyncEmptyToast() {
    if (!syncEmptyToastEl) return;
    if (syncEmptyToastTimeout) {
        clearTimeout(syncEmptyToastTimeout);
        syncEmptyToastTimeout = null;
    }
    syncEmptyToastEl.classList.remove('is-visible');
}

syncEmptyToastCloseBtn?.addEventListener('click', hideSyncEmptyToast);

// Updates the visual state and messaging of the companion status pill based on connection health
function setCompanionStatus(state) {
    if (!companionStatusEl) return;

    const statusChanged = !companionStatusEl.classList.contains(`status-${state}`);

    // Safely update status class while preserving other classes like .expanded
    const statusClasses = Array.from(companionStatusEl.classList).filter((c) => c.startsWith('status-'));
    statusClasses.forEach((c) => companionStatusEl.classList.remove(c));
    companionStatusEl.classList.add(`status-${state}`);

    if (companionStatusSubtitle) companionStatusSubtitle.style.display = 'block';
    if (statusChanged) triggerCompanionExpansion(false);

    if (state === 'not-installed') {
        if (companionStatusIcon) companionStatusIcon.dataset.icon = 'mdi:extension-off';
        if (companionStatusTitle) companionStatusTitle.textContent = 'Companion Not Installed!';
        if (companionStatusSubtitle) companionStatusSubtitle.textContent = 'Click to visit Download Page';
        companionStatusEl.href = '/companion-page/';
        companionStatusEl.classList.add('clickable');
    } else if (state === 'primed') {
        if (companionStatusIcon) companionStatusIcon.dataset.icon = 'mdi:extension';
        if (companionStatusTitle) companionStatusTitle.textContent = 'Companion Primed';
        if (companionStatusSubtitle) companionStatusSubtitle.textContent = 'Ready to Catch Data';
        companionStatusEl.href = '#';
        companionStatusEl.classList.remove('clickable');
    } else if (state === 'checking') {
        if (companionStatusIcon) companionStatusIcon.dataset.icon = 'mdi:loading';
        if (companionStatusTitle) companionStatusTitle.textContent = 'Checking Connection...';
        if (companionStatusSubtitle) companionStatusSubtitle.style.display = 'none';
        companionStatusEl.href = '#';
        companionStatusEl.classList.remove('clickable');
    }
}

// Triggers the expanded state animation for the status pill to grab user attention
function triggerCompanionExpansion(keepExpanded) {
    if (!companionStatusEl) return;
    if (companionExpansionTimeout) clearTimeout(companionExpansionTimeout);

    companionStatusEl.classList.add('expanded');

    if (!keepExpanded) {
        companionExpansionTimeout = setTimeout(() => {
            companionStatusEl.classList.remove('expanded');
            companionExpansionTimeout = null;
        }, 5000);
    }
}

// Briefly overrides the pill's text to confirm a sync, then reverts to the steady connection state
function flashCompanionSynced(subtitleText) {
    if (!companionStatusEl) return;
    if (companionFlashRevertTimeout) clearTimeout(companionFlashRevertTimeout);

    if (companionStatusTitle) companionStatusTitle.textContent = 'Synced!';
    if (companionStatusSubtitle) {
        companionStatusSubtitle.textContent = subtitleText;
        companionStatusSubtitle.style.display = 'block';
    }
    triggerCompanionExpansion(false);

    companionFlashRevertTimeout = setTimeout(() => {
        setCompanionStatus('primed');
        companionFlashRevertTimeout = null;
    }, 3500);
}

if (companionStatusEl) {
    companionStatusEl.addEventListener('mouseenter', () => {
        if (companionHoverTimeout) {
            clearTimeout(companionHoverTimeout);
            companionHoverTimeout = null;
        }
        companionStatusEl.classList.add('expanded');
    });

    companionStatusEl.addEventListener('mouseleave', () => {
        // Stagger the retraction: wait 1.5 seconds before closing
        companionHoverTimeout = setTimeout(() => {
            if (!companionExpansionTimeout) companionStatusEl.classList.remove('expanded');
            companionHoverTimeout = null;
        }, 1500);
    });

    companionStatusEl.addEventListener('click', (event) => {
        if (!companionStatusEl.classList.contains('clickable')) event.preventDefault();
    });
}

/* 2. Handshake & Connection Logic */
let companionHandshakeTimeout = null;

// Initiates the heartbeat handshake with the extension to verify if it is installed and active
function initCompanionHandshake() {
    setCompanionStatus('checking');
    window.postMessage({ type: 'WEB_TOOLS_HEARTBEAT_REQUEST' }, window.location.origin);

    companionHandshakeTimeout = setTimeout(() => {
        setCompanionStatus('not-installed');
    }, 2000);
}

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_HEARTBEAT_RESPONSE') {
        if (companionHandshakeTimeout) {
            clearTimeout(companionHandshakeTimeout);
            companionHandshakeTimeout = null;
        }
        setCompanionStatus('primed');
    }
});

initCompanionHandshake();

// Initialize from cache — small timeout ensures script.js and Mermaid are ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (hasLoadedFromSync) return; 

        const cachedData = sessionStorage.getItem(CURRICULUM_CACHE_KEY);
        if (cachedData && typeof window.parseAndRender === 'function') {
            console.log("[Companion Hook] Restoring curriculum from session cache...");
            window.parseAndRender(cachedData).catch(err => {
                console.error("[Companion Hook] Failed to render from cache:", err);
            });

            // The reload that brought us here was itself the sync — confirm it on the pill now
            // that we've landed, since the original NETWORK_PAYLOAD_READY flash got cut short.
            if (sessionStorage.getItem(CURRICULUM_JUST_SYNCED_KEY)) {
                sessionStorage.removeItem(CURRICULUM_JUST_SYNCED_KEY);
                flashCompanionSynced('Curriculum Loaded');
            }
        }
    }, 100);

    // Wire up the reset button to also clear the session cache
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            sessionStorage.removeItem(CURRICULUM_CACHE_KEY);
            console.log("[Companion Hook] Curriculum session cache cleared.");
        });
    }
});

window.addEventListener('NETWORK_PAYLOAD_READY', (event) => {
    const { payload, dataType } = event.detail;

    if (dataType === 'CURRICULUM' && payload) {
        console.log("[Companion Hook] Received curriculum data. Preparing for safe reload...");
        hasLoadedFromSync = true;

        // 1. Buffer the data to session cache
        sessionStorage.setItem(CURRICULUM_CACHE_KEY, payload);
        sessionStorage.setItem(CURRICULUM_JUST_SYNCED_KEY, '1');

        // 2. Perform a full reload to ensure a clean slate for the parsing engine
        // We use a tiny delay to ensure the ACK message is dispatched first
        setTimeout(() => {
            window.location.reload();
        }, 50);
        return;
    }

    if (dataType === 'SUBJECT_STATE' && payload) {
        // Decorates the graph that's already rendered — no reload, and ephemeral by
        // design: a no-op if nothing is loaded yet (nothing to color), not cached for later.
        if (getAdjacencyGraph().size === 0 || typeof window.applySubjectState !== 'function') {
            console.warn("[Companion Hook] No curriculum loaded yet; ignoring subject state sync.");
            showSyncEmptyToast();
            return;
        }

        console.log("[Companion Hook] Received subject state data. Applying...");
        window.applySubjectState(parseSubjectStateHtml(payload));
        flashCompanionSynced('Subject Status Updated');
    }
});