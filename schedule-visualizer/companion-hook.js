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

// DOM elements for the Dynamic Island-style status pill and portal connection indicators
const companionStatusEl = document.getElementById('companion-status');
const companionStatusIcon = companionStatusEl?.querySelector('.status-icon');
const companionStatusTitle = companionStatusEl?.querySelector('.status-title');
const companionStatusSubtitle = companionStatusEl?.querySelector('.status-subtitle');
const headerPortalContainer = document.getElementById('header-portal-container');
let companionHandshakeTimeout = null;
let companionExpansionTimeout = null;

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

// Initiates the heartbeat handshake with the extension to verify if it is installed and active
function initCompanionHandshake() {
    setCompanionStatus('checking');

    window.postMessage({ type: 'WEB_TOOLS_HEARTBEAT_REQUEST' }, '*');

    companionHandshakeTimeout = setTimeout(() => {
        setCompanionStatus('not-installed');
    }, 2000);
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

let companionHoverTimeout = null;

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


// Main bridge listener for cross-window messages from the extension's content script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_HEARTBEAT_RESPONSE') {
        if (companionHandshakeTimeout) {
            clearTimeout(companionHandshakeTimeout);
            companionHandshakeTimeout = null;
        }

        const payload = event.data.payload || {};
        if (payload.autoSchedEnabled) {
            setCompanionStatus('auto', payload);
        } else {
            setCompanionStatus('primed', payload);
        }
    }

    if (event.data.type === 'WEB_TOOLS_EXTENSION_SYNC') {
        const payload = event.data.payload;
        try {
            const normalized = normalizeSchedulePayload(payload, payload.name || 'Extension Schedule');

            const existingIndex = savedSchedules.findIndex((s) => s.id === normalized.id);
            if (existingIndex !== -1) {
                savedSchedules[existingIndex] = normalized;
            } else {
                savedSchedules.unshift(normalized);
            }

            updateActiveScheduleId(normalized.id);
            updateClasses(normalized.blocks.map((b) => ({ ...b })));

            renderSavedSchedulesList();
            setPendingFullLoad(true);
            renderSchedule();
            setStatus('Auto Plotter Synced from OSES!', 'success');
        } catch (err) {
            console.error('[Web Tools] Failed to sync extension schedule:', err);
            setStatus('Failed to sync schedule from extension.', 'error');
        }
    }
});

// Notify the bridge that the web app is fully loaded and ready to receive data
window.postMessage({ type: 'WEB_TOOLS_APP_READY' }, '*');
initCompanionHandshake();
