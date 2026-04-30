/**
 * This script handles all communications to my companion extension such as,
 * managing the connection handshake, status UI updates, and incoming schedule data syncs.
 * PING-PONG :)
 * for this case, the schedule-visualizer is the PING.
 */
import {
    savedSchedules,
    normalizeSchedulePayload,
    renderSavedSchedulesList,
    renderSchedule,
    setStatus,
    updateClasses,
    updateActiveScheduleId,
    setPendingFullLoad
} from './script.js';

const LIVE_SYNC_ID = 'sched-live-autosync';
const MANUAL_EXTRACT_ID = 'saf-manual-extract';

/* 1. Status Pill (Dynamic Island) UI Management */
const companionStatusEl = document.getElementById('companion-status');
const companionStatusIcon = companionStatusEl?.querySelector('.status-icon');
const companionStatusTitle = companionStatusEl?.querySelector('.status-title');
const companionStatusSubtitle = companionStatusEl?.querySelector('.status-subtitle');
const headerPortalContainer = document.getElementById('header-portal-container');
const managerStatusEl = document.getElementById('manager-status');

let companionExpansionTimeout = null;
let companionHoverTimeout = null;

// Updates the visual state and messaging of the companion status pill based on connection health
function setCompanionStatus(state, data = {}) {
    if (!companionStatusEl) return;

    const statusChanged = !companionStatusEl.classList.contains(`status-${state}`);

    // Safely update status class while preserving other classes like .expanded
    const statusClasses = Array.from(companionStatusEl.classList).filter(c => c.startsWith('status-'));
    statusClasses.forEach(c => companionStatusEl.classList.remove(c));
    companionStatusEl.classList.add(`status-${state}`);

    if (companionStatusSubtitle) {
        companionStatusSubtitle.style.display = 'block';
    }

    if (statusChanged) {
        triggerCompanionExpansion(state === 'auto');
    }

    if (state === 'not-installed') {
        if (companionStatusIcon) companionStatusIcon.dataset.icon = 'mdi:extension-off';
        if (companionStatusTitle) companionStatusTitle.textContent = 'Companion Not Installed!';
        if (companionStatusSubtitle) companionStatusSubtitle.textContent = 'Click to visit Download Page';
        companionStatusEl.href = '/companion-page/';
        companionStatusEl.classList.add('clickable');
        if (headerPortalContainer) headerPortalContainer.innerHTML = '';
    } else if (state === 'primed') {
        if (companionStatusIcon) companionStatusIcon.dataset.icon = 'mdi:extension';
        if (companionStatusTitle) companionStatusTitle.textContent = 'Companion Primed';
        if (companionStatusSubtitle) companionStatusSubtitle.textContent = 'Ready to Catch Data';

        if (headerPortalContainer) {
            headerPortalContainer.innerHTML = data.isPortalOpen
                ? '<span class="portal-connection-badge"><span class="iconify" data-icon="mdi:link-variant"></span> Solar Connection Live</span>'
                : '';
        }

        companionStatusEl.href = '#';
        companionStatusEl.classList.remove('clickable');
    } else if (state === 'auto') {
        if (companionStatusTitle) companionStatusTitle.textContent = 'Auto Plotting';
        if (companionStatusSubtitle) companionStatusSubtitle.textContent = 'Catching Data!';

        if (headerPortalContainer) {
            headerPortalContainer.innerHTML = data.isPortalOpen
                ? '<span class="portal-connection-badge"><span class="iconify" data-icon="mdi:link-variant"></span> Solar Connection Live</span>'
                : '';
        }

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
function triggerCompanionExpansion(keepExpanded = false) {
    if (!companionStatusEl) return;

    if (companionExpansionTimeout) {
        clearTimeout(companionExpansionTimeout);
    }

    companionStatusEl.classList.add('expanded');

    if (!keepExpanded) {
        companionExpansionTimeout = setTimeout(() => {
            if (!companionStatusEl.classList.contains('status-auto')) {
                companionStatusEl.classList.remove('expanded');
            }
            companionExpansionTimeout = null;
        }, 5000);
    }
}

if (companionStatusEl) {
    companionStatusEl.addEventListener('mouseenter', () => {
        // Clear any pending retraction when re-hovering
        if (companionHoverTimeout) {
            clearTimeout(companionHoverTimeout);
            companionHoverTimeout = null;
        }
        companionStatusEl.classList.add('expanded');
    });

    companionStatusEl.addEventListener('mouseleave', () => {
        // Stagger the retraction: wait 1.5 seconds before closing
        companionHoverTimeout = setTimeout(() => {
            if (!companionExpansionTimeout && !companionStatusEl.classList.contains('status-auto')) {
                companionStatusEl.classList.remove('expanded');
            }
            companionHoverTimeout = null;
        }, 1500);
    });

    companionStatusEl.addEventListener('click', (e) => {
        if (!companionStatusEl.classList.contains('clickable')) {
            e.preventDefault();
        }
    });
}

/* 2. Handshake & Connection Logic */
let companionHandshakeTimeout = null;

// Initiates the heartbeat handshake with the extension to verify if it is installed and active
function initCompanionHandshake() {
    setCompanionStatus('checking');

    window.postMessage({ type: 'WEB_TOOLS_HEARTBEAT_REQUEST' }, '*');

    companionHandshakeTimeout = setTimeout(() => {
        setCompanionStatus('not-installed');
    }, 2000);
}

/* 3. Message Bridge (Communication with Extension) */
let lastCompanionPayload = null;

// Main bridge listener for cross-window messages from the extension's content script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_HEARTBEAT_RESPONSE') {
        if (companionHandshakeTimeout) {
            clearTimeout(companionHandshakeTimeout);
            companionHandshakeTimeout = null;
        }

        const payload = event.data.payload || {};
        lastCompanionPayload = payload;
        if (payload.autoSchedEnabled) {
            setCompanionStatus('auto', payload);
        } else {
            setCompanionStatus('primed', payload);
        }
        renderSavedSchedulesList(lastCompanionPayload);
    }
});

window.addEventListener('NETWORK_PAYLOAD_READY', (event) => {
    const { payload, dataType } = event.detail;
    const source = payload.source || 'auto-plot';
    const isManual = source === 'manual-saf' || dataType === 'SAF_EXTRACT';
    
    try {
        const defaultName = isManual ? 'Extracted Data SAF' : 'Auto Sched Live Sync';
        const normalized = normalizeSchedulePayload(payload, payload.name || defaultName);
        
        normalized.id = payload.id || (isManual ? MANUAL_EXTRACT_ID : LIVE_SYNC_ID);
        normalized.isLiveSync = true;

        const existingIndex = savedSchedules.findIndex((s) => s.id === normalized.id);
        if (existingIndex !== -1) {
            savedSchedules[existingIndex] = normalized;
        } else {
            savedSchedules.unshift(normalized);
        }

        updateActiveScheduleId(normalized.id);
        updateClasses(normalized.blocks.map((b) => ({ ...b })));

        renderSavedSchedulesList(lastCompanionPayload);
        setPendingFullLoad(true);
        renderSchedule();
        
        const statusMsg = isManual ? 'SAF Data Extracted!' : 'Auto Plotter Synced from OSES!';
        
        // Direct Schedule Status Update (The "Schedule Itself")
        if (managerStatusEl) {
            managerStatusEl.className = 'status-text tone-success';
            managerStatusEl.innerText = statusMsg;
        }

        // Dynamic Island Feedback (The "Island")
        if (companionStatusTitle) companionStatusTitle.textContent = 'Synced!';
        if (companionStatusSubtitle) {
            companionStatusSubtitle.textContent = isManual ? 'SAF Data Captured' : 'Auto Plot Success';
            companionStatusSubtitle.style.display = 'block';
        }
        
        triggerCompanionExpansion(false);

        // Revert island text after a delay to maintain heartbeat state
        setTimeout(() => {
            if (lastCompanionPayload?.autoSchedEnabled) {
                setCompanionStatus('auto', lastCompanionPayload);
            } else {
                setCompanionStatus('primed', lastCompanionPayload);
            }
        }, 3500);

    } catch (err) {
        console.error('[Web Tools] Failed to sync extension schedule:', err);
        setStatus('Failed to sync schedule from extension.', 'error');
    }
});

/* 4. Initialization */
initCompanionHandshake();
