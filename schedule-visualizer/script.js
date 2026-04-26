import '@iconify/iconify';
import { exportScheduleAsPng } from './export/export-png.js';
import { SUBJECT_CATALOG } from './subjects.js';
import * as anim from './anim.js';

/* 1. Global State & App Constants */
const SNAPSHOTS_STORAGE_KEY = 'feu_snapshots';
const ACTIVE_ID_STORAGE_KEY = 'feu_active_id';
const LIVE_SYNC_ID = 'auto-sched-live-sync';

export let classes = JSON.parse(localStorage.getItem('feu_schedule')) || [];
export let savedSchedules = JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY)) || [];
export let activeScheduleId = localStorage.getItem(ACTIVE_ID_STORAGE_KEY) || null;

const START_HOUR = 7;
const END_HOUR = 22;
const LIVE_ROW_HEIGHT_PIXELS = 84;
const HEADER_HEIGHT_PX = 40;
const MOBILE_BREAKPOINT = 768;

export function setPendingFullLoad(value) {
    pendingFullLoad = Boolean(value);
}

/* 2. Storage Health & Persistence */
const storageFill = document.getElementById('storage-health-fill');
const storageText = document.getElementById('storage-health-text');
/* Storage Health Indicator */
function syncSnapshotsToStorage() {
    try {
        localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(savedSchedules));
        if (activeScheduleId) {
            localStorage.setItem(ACTIVE_ID_STORAGE_KEY, activeScheduleId);
        } else {
            localStorage.removeItem(ACTIVE_ID_STORAGE_KEY);
        }
        updateStorageHealth();
    } catch (err) {
        console.error('Failed to sync snapshots to localStorage:', err);
        setStatus('Storage is full! Please export and delete some schedules.', 'error');
    }
}

function updateStorageHealth() {
    const usage = calculateStorageUsage();
    
    if (storageFill) storageFill.style.width = `${usage.percentage}%`;
    if (storageText) storageText.innerText = `${usage.percentage}% Used`;

    // Dispatch an event so other components can react
    window.dispatchEvent(new CustomEvent('storage-health-update', { detail: usage }));
}

/* 3. Color Logic & UI Feedback */
const colorPicker = document.getElementById('color-picker');
const colorBtns = document.querySelectorAll('.color-btn');
let selectedColor = 'bg-emerald-600';

const toastStack = document.getElementById('toast-stack');
const managerStatus = document.getElementById('manager-status');

function calculateStorageUsage() {
    let totalChars = 0;
    for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            totalChars += (localStorage[key].length + key.length);
        }
    }
    
    // localStorage uses UTF-16, so each char is 2 bytes
    const totalBytes = totalChars * 2;
    const limitBytes = 5 * 1024 * 1024; // 5MB estimate
    const percentage = Math.min(100, (totalBytes / limitBytes) * 100).toFixed(1);
    
    return {
        bytes: totalBytes,
        formatted: (totalBytes / 1024).toFixed(1) + ' KB',
        percentage
    };
}

/* Global event delegation */
function setupButtonFeedbackDelegation() {
    document.addEventListener('click', (event) => {
        const targetButton = event.target.closest('.btn, .manager-btn, .color-btn, .block-action-btn, .remove-secondary-day-btn, .schedule-block');
        if (targetButton) {
            anim.animatePressFeedback(targetButton);
        }
    });
}

function createIconMarkup(iconName) {
    return `<span class="iconify label-icon" data-icon="${iconName}" aria-hidden="true"></span>`;
}

function getRingClass(colorClass) {
    const hue = String(colorClass || '').replace(/^bg-/, '').replace(/-\d+$/, '');
    return hue ? `ring-${hue}-400` : 'ring-emerald-400';
}

function initColorSelectorHighlight() {
    if (!colorPicker || colorPicker.querySelector('.color-selector-highlight')) {
        return;
    }

    const highlight = document.createElement('div');
    highlight.className = 'color-selector-highlight';
    colorPicker.appendChild(highlight);
}

function syncColorButtons(selectedBtn = null) {
    const activeButton = selectedBtn || document.querySelector(`.color-btn[data-color="${selectedColor}"]`);

    colorBtns.forEach((btn) => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-slate-800');
        btn.classList.add('opacity-50');
        btn.className = btn.className.replace(/\bring-[a-z-]+-400\b/g, '');
    });

    if (!activeButton) {
        return;
    }

    selectedColor = activeButton.dataset.color || selectedColor;
    activeButton.classList.remove('opacity-50');
    activeButton.classList.add('ring-2', 'ring-offset-2', 'ring-offset-slate-800', getRingClass(selectedColor));
    anim.animateColorSelectorTo(activeButton, colorPicker);
}

/* Populates course search */
function populateSubjectOptions() {
    const datalist = document.getElementById('pending-courses');
    const seen = new Set();
    const sortedCatalog = [...SUBJECT_CATALOG].sort((a, b) => a.code.localeCompare(b.code));

    sortedCatalog.forEach((subject) => {
        if (seen.has(subject.code)) {
            return;
        }
        seen.add(subject.code);

        const option = document.createElement('option');
        option.value = `${subject.code} - ${subject.title}`;
        datalist.appendChild(option);
    });
}

/* Displays status notifications */
export function setStatus(message, tone = 'info') {
    managerStatus.className = 'status-text';
    if (tone === 'error') {
        managerStatus.classList.add('tone-error');
    } else if (tone === 'success') {
        managerStatus.classList.add('tone-success');
    }
    managerStatus.innerText = message;

    if (!toastStack) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast tone-${tone}`;
    toast.innerHTML = `
        <span class="toast-message">${escapeHtml(message)}</span>
        <button type="button" class="toast-dismiss" aria-label="Dismiss message">×</button>
    `;

    const removeToast = () => {
        anim.animateToastOut(toast, () => toast.remove());
    };

    toast.querySelector('.toast-dismiss')?.addEventListener('click', removeToast);
    toastStack.appendChild(toast);
    anim.animateToastIn(toast);
    window.setTimeout(removeToast, 3600);
}

function normalizeCourseIdentity(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function setEditExtendRelatedState(isEnabled) {
    editExtendRelatedState = Boolean(isEnabled);
    localStorage.setItem(EDIT_EXTEND_RELATED_KEY, editExtendRelatedState ? '1' : '0');
    if (editExtendRelated) {
        editExtendRelated.checked = editExtendRelatedState;
    }
}

/* 4. Message Dialog System (Alert/Confirm/Prompt) */
const messageModal = document.getElementById('message-modal');
const messageModalCard = messageModal?.querySelector('.message-card');
const messageModalTitle = document.getElementById('message-modal-title');
const messageModalBody = document.getElementById('message-modal-body');
const messageModalInputWrap = document.getElementById('message-modal-input-wrap');
const messageModalInput = document.getElementById('message-modal-input');
const messageModalCancel = document.getElementById('message-modal-cancel');
const messageModalConfirm = document.getElementById('message-modal-confirm');

let activeMessageDialog = null;
let activeMessageKeydownHandler = null;

function closeMessageDialog(result) {
    if (!activeMessageDialog) {
        return;
    }

    const { resolve } = activeMessageDialog;
    activeMessageDialog = null;

    if (activeMessageKeydownHandler) {
        document.removeEventListener('keydown', activeMessageKeydownHandler);
        activeMessageKeydownHandler = null;
    }

    anim.animateModalOut(messageModal, messageModalCard, () => {
        document.body.style.overflow = '';
        resolve(result);
    });
}

/* Custom dialog system */
function openMessageDialog({
    title = 'Message',
    message = '',
    mode = 'alert',
    confirmText = 'OK',
    cancelText = 'Cancel',
    defaultValue = '',
    placeholder = ''
} = {}) {
    if (!messageModal || !messageModalTitle || !messageModalBody || !messageModalInputWrap || !messageModalInput || !messageModalCancel || !messageModalConfirm) {
        if (mode === 'confirm') {
            return Promise.resolve(false);
        }
        if (mode === 'prompt') {
            return Promise.resolve(null);
        }
        return Promise.resolve(true);
    }

    if (activeMessageDialog) {
        closeMessageDialog(mode === 'prompt' ? null : false);
    }

    return new Promise((resolve) => {
        activeMessageDialog = { resolve, mode };
        messageModalTitle.innerText = title;
        messageModalBody.innerText = message;
        messageModalConfirm.innerText = confirmText;
        messageModalCancel.innerText = cancelText;
        messageModalCancel.classList.toggle('hidden', mode === 'alert');
        messageModalInputWrap.classList.toggle('hidden', mode !== 'prompt');
        messageModalInput.value = defaultValue;
        messageModalInput.placeholder = placeholder;

        anim.animateModalIn(messageModal, messageModalCard);
        document.body.style.overflow = 'hidden';

        const focusTarget = mode === 'prompt' ? messageModalInput : messageModalConfirm;
        window.requestAnimationFrame(() => focusTarget.focus());

        activeMessageKeydownHandler = (event) => {
            if (event.key === 'Enter' && mode !== 'alert' && document.activeElement !== messageModalInput) {
                event.preventDefault();
                closeMessageDialog(mode === 'prompt' ? messageModalInput.value : true);
            }
        };

        document.addEventListener('keydown', activeMessageKeydownHandler);
    });
}

function showAlertDialog(message, title = 'Notice') {
    return openMessageDialog({ title, message, mode: 'alert', confirmText: 'OK' });
}

function showConfirmDialog(message, title = 'Confirm') {
    return openMessageDialog({ title, message, mode: 'confirm', confirmText: 'Confirm', cancelText: 'Cancel' });
}

messageModalCancel?.addEventListener('click', () => closeMessageDialog(activeMessageDialog?.mode === 'prompt' ? null : false));
messageModalConfirm?.addEventListener('click', () => {
    if (!activeMessageDialog) {
        return;
    }
    closeMessageDialog(activeMessageDialog.mode === 'prompt' ? messageModalInput.value : true);
});
messageModalInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        closeMessageDialog(messageModalInput.value);
    }
});

function normalizeDroppedFiles(fileList) {
    return Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

function hasAcknowledgedMobileWarning() {
    return localStorage.getItem(MOBILE_WARNING_ACK_KEY) === '1';
}

/* 5. Mobile Layout & Preview Management */
const MOBILE_WARNING_ACK_KEY = 'feu_mobile_warning_ack';
const appContent = document.querySelector('.app-content');
const mobileWarning = document.getElementById('mobile-warning');
const mobileWarningAckBtn = document.getElementById('mobile-warning-ack-btn');
const mobileToggleViewBtn = document.getElementById('mobile-toggle-view-btn');
const mobilePreviewModal = document.getElementById('mobile-preview-modal');
const mobilePreviewCard = mobilePreviewModal?.querySelector('.mobile-preview-card');
const mobilePreviewCloseBtn = document.getElementById('mobile-preview-close-btn');
const mobilePreviewContainer = document.getElementById('mobile-preview-container');

let mobileViewMode = 'plotter';

/* Mobile layout management */
function syncMobileWarningVisibility() {
    if (!mobileWarning) {
        return;
    }

    const shouldShow = isMobileViewport() && !hasAcknowledgedMobileWarning();
    mobileWarning.classList.toggle('hidden', !shouldShow);
}

function setMobileViewMode(mode) {
    if (!appContent) {
        return;
    }

    if (!isMobileViewport()) {
        appContent.classList.remove('mobile-plotter-mode', 'mobile-timetable-mode');
        return;
    }

    mobileViewMode = mode === 'timetable' ? 'timetable' : 'plotter';
    appContent.classList.toggle('mobile-plotter-mode', mobileViewMode === 'plotter');
    appContent.classList.toggle('mobile-timetable-mode', mobileViewMode === 'timetable');

    if (mobileToggleViewBtn) {
        mobileToggleViewBtn.innerHTML = mobileViewMode === 'plotter'
            ? '<span class="iconify btn-icon" data-icon="mdi:view-dashboard-outline" aria-hidden="true"></span>Show Timetable'
            : '<span class="iconify btn-icon" data-icon="mdi:form-select" aria-hidden="true"></span>Show Plotter';
        if (window.Iconify && typeof window.Iconify.scan === 'function') {
            window.Iconify.scan(mobileToggleViewBtn);
        }
    }
}

function closeMobileFullPreview() {
    if (!mobilePreviewModal || !mobilePreviewContainer) {
        return;
    }

    anim.animateModalOut(mobilePreviewModal, mobilePreviewCard, () => {
        mobilePreviewContainer.innerHTML = '';
        mobilePreviewContainer.scrollTop = 0;
        document.body.style.overflow = '';
    });
}

function openMobileFullPreview() {
    if (!mobilePreviewModal || !mobilePreviewContainer || !timetableExportArea) {
        return;
    }

    mobilePreviewContainer.innerHTML = '';
    const previewClone = timetableExportArea.cloneNode(true);
    previewClone.removeAttribute('id');
    previewClone.classList.remove('custom-scrollbar');
    previewClone.style.minHeight = '0';
    previewClone.style.height = 'auto';
    previewClone.style.maxHeight = 'none';
    previewClone.style.overflow = 'auto';
    previewClone.style.borderRadius = '0.65rem';
    previewClone.scrollTop = 0;

    const clonePanel = previewClone.querySelector('.timetable-panel');
    if (clonePanel) {
        clonePanel.style.minHeight = '0';
        clonePanel.style.height = 'auto';
    }

    mobilePreviewContainer.appendChild(previewClone);
    mobilePreviewContainer.scrollTop = 0;
    anim.animateModalIn(mobilePreviewModal, mobilePreviewCard);
    document.body.style.overflow = 'hidden';
}

function syncMobileLayoutState() {
    syncMobileWarningVisibility();

    if (!isMobileViewport()) {
        closeMobileFullPreview();
        setMobileViewMode('plotter');
        return;
    }

    setMobileViewMode(mobileViewMode);
}

/* 6. Timetable Rendering Core */
const container = document.getElementById('blocks-container');
const timeAxis = document.getElementById('time-axis');
const countDisplay = document.getElementById('class-count');
const timetableExportArea = document.getElementById('timetable-export-area');
const timetableCanvasEl = timetableExportArea?.querySelector('.timetable-canvas');

let pendingFullLoad = false;
let pendingAddedCount = 0;
let pendingEditedIndexes = [];

/* Sets timetable grid CSS variables */
function applyLiveTimetableMetrics() {
    const bodyHeight = (END_HOUR - START_HOUR) * LIVE_ROW_HEIGHT_PIXELS;
    const totalHeight = HEADER_HEIGHT_PX + bodyHeight;

    if (timetableExportArea) {
        timetableExportArea.style.setProperty('--hour-row-height', `${LIVE_ROW_HEIGHT_PIXELS}px`);
        timetableExportArea.style.setProperty('--timetable-height', `${totalHeight}px`);
    }

    if (timetableCanvasEl) {
        timetableCanvasEl.style.height = `${totalHeight}px`;
    }
}

/* File imports */
function wireDropImport() {
    if (!jsonDropZone) {
        return;
    }

    ['dragover', 'drop'].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
            if (!jsonDropZone.contains(event.target)) {
                event.preventDefault();
            }
        });
    });

    const dragEvents = ['dragenter', 'dragover'];
    dragEvents.forEach((eventName) => {
        jsonDropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            jsonDropZone.classList.add('drag-active');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        jsonDropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            jsonDropZone.classList.remove('drag-active');
        });
    });

    jsonDropZone.addEventListener('drop', async (event) => {
        const droppedFiles = normalizeDroppedFiles(event.dataTransfer?.files || []);
        if (droppedFiles.length === 0) {
            setStatus('Drop one or more .json schedule files.', 'error');
            return;
        }
        await importScheduleFiles(droppedFiles);
    });
}

function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatTimestamp(dateInput = new Date()) {
    const d = new Date(dateInput);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

function getActiveSchedule() {
    return savedSchedules.find((s) => s.id === activeScheduleId) || null;
}

function hasUnsavedChanges() {
    const active = getActiveSchedule();
    if (!active) {
        return classes.length > 0;
    }
    return JSON.stringify(classes) !== JSON.stringify(active.blocks);
}

function syncActionStates() {
    const hasSelection = Boolean(activeScheduleId);
    const hasPlotted = classes.length > 0;
    loadSelectedBtn.disabled = !hasSelection;
    overwriteSelectedBtn.disabled = !hasSelection || !hasPlotted;
    downloadSelectedBtn.disabled = !hasSelection;
    deleteSelectedBtn.disabled = !hasSelection;
    saveSnapshotBtn.disabled = !hasPlotted;
    exportPngBtn.disabled = !hasPlotted;
}

/* 7. Plotter Form Logic */
const form = document.getElementById('class-form');
const courseDayInput = document.getElementById('course-day');
const courseStartInput = document.getElementById('course-start');
const courseEndInput = document.getElementById('course-end');
const courseRoomInput = document.getElementById('course-room');
const courseSectionInput = document.getElementById('course-section');
const addSecondaryDayBtn = document.getElementById('add-secondary-day-btn');
const secondaryDaysContainer = document.getElementById('secondary-days-container');

const DAY_OPTIONS = [
    { value: '0', label: 'Monday' },
    { value: '1', label: 'Tuesday' },
    { value: '2', label: 'Wednesday' },
    { value: '3', label: 'Thursday' },
    { value: '4', label: 'Friday' },
    { value: '5', label: 'Saturday' }
];

/* 8. Library & Persistence Management */
const savedSchedulesList = document.getElementById('saved-schedules-list');
const scheduleNameInput = document.getElementById('schedule-name');
const saveSnapshotBtn = document.getElementById('save-snapshot-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const jsonFileInput = document.getElementById('json-file-input');
const jsonDropZone = document.getElementById('json-drop-zone');
const loadSelectedBtn = document.getElementById('load-selected-btn');
const overwriteSelectedBtn = document.getElementById('overwrite-selected-btn');
const downloadSelectedBtn = document.getElementById('download-selected-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');

[loadSelectedBtn, overwriteSelectedBtn, downloadSelectedBtn, deleteSelectedBtn, saveSnapshotBtn, importJsonBtn].forEach(btn => {
    anim.bindInteractiveHover?.(btn);
    anim.bindInteractivePress?.(btn);
});

let lastAutoPlottingState = false;

export function renderSavedSchedulesList(companionPayload = null, newIdToAnimate = null) {
    // Determine if we should completely rebuild the list or just update classes
    // We rebuild if the count differs, or if we force a re-render.
    
    // Update the cached state if a payload is provided, otherwise keep the last known state
    if (companionPayload !== null) {
        lastAutoPlottingState = companionPayload?.autoSchedEnabled === true;
    }
    const isAutoPlotting = lastAutoPlottingState;

    if (savedSchedules.length === 0) {
        savedSchedulesList.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'saved-list-empty';
        li.innerText = 'No schedules loaded yet.';
        savedSchedulesList.appendChild(li);
        syncActionStates();
        updateStorageHealth();
        return;
    }

    // Sort: Pin LIVE_SYNC_ID to the top, then by updatedAt desc
    const sorted = [...savedSchedules].sort((a, b) => {
        if (a.id === LIVE_SYNC_ID) return -1;
        if (b.id === LIVE_SYNC_ID) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    // Instead of always destroying, check if we can just patch
    const existingItems = Array.from(savedSchedulesList.querySelectorAll('.saved-schedule-item'));
    if (existingItems.length === sorted.length && !savedSchedulesList.querySelector('.saved-list-empty') && !newIdToAnimate) {
        // Just patch classes to prevent DOM ghosting/flashing and preserve GSAP transforms
        existingItems.forEach((btn, index) => {
            const schedule = sorted[index];
            const isLive = schedule.id === LIVE_SYNC_ID;
            
            btn.dataset.id = schedule.id; // ensure correct mapping
            
            if (schedule.id === activeScheduleId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            if (isLive) {
                btn.classList.add('pinned-sync');
                if (isAutoPlotting) btn.classList.add('is-live-plotting');
                else btn.classList.remove('is-live-plotting');
            } else {
                btn.classList.remove('pinned-sync', 'is-live-plotting');
            }
            
            // Only patch inner content if the data actually changed to prevent GSAP/Animation stuttering
            const icon = isLive ? 'mdi:sync' : 'mdi:bookmark-outline';
            const nameLabel = isLive ? 'Auto Sched Live Sync' : schedule.name;
            const blockCountLabel = `${schedule.blocks.length} block${schedule.blocks.length === 1 ? '' : 's'}`;
            const updatedLabel = isLive ? 'Syncing via OSES' : 'Updated ' + new Date(schedule.updatedAt).toLocaleString();
            
            // We use a simple composite key to check for changes
            const contentKey = `${icon}|${nameLabel}|${blockCountLabel}|${updatedLabel}`;
            if (btn.dataset.contentKey !== contentKey) {
                btn.innerHTML = `
                    <div class="saved-item-row">
                        <span class="saved-item-name">${createIconMarkup(icon)}${nameLabel}</span>
                        <span class="saved-item-meta">${blockCountLabel}</span>
                    </div>
                    <div class="saved-item-updated">${updatedLabel}</div>
                `;
                btn.dataset.contentKey = contentKey;
            }
        });
        
        syncActionStates();
        updateStorageHealth();
        return;
    }

    // Full rebuild if counts differ
    savedSchedulesList.innerHTML = '';
    
    sorted.forEach((schedule) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        const isLive = schedule.id === LIVE_SYNC_ID;
        
        button.type = 'button';
        button.dataset.id = schedule.id;
        button.className = `saved-schedule-item ${schedule.id === activeScheduleId ? 'active' : ''} ${isLive ? 'pinned-sync' : ''} ${(isLive && isAutoPlotting) ? 'is-live-plotting' : ''}`;
        
        const icon = isLive ? 'mdi:sync' : 'mdi:bookmark-outline';
        const nameLabel = isLive ? 'Auto Sched Live Sync' : schedule.name;
        const blockCountLabel = `${schedule.blocks.length} block${schedule.blocks.length === 1 ? '' : 's'}`;
        const updatedLabel = isLive ? 'Syncing via OSES' : 'Updated ' + new Date(schedule.updatedAt).toLocaleString();
        
        button.innerHTML = `
            <div class="saved-item-row">
                <span class="saved-item-name">${createIconMarkup(icon)}${nameLabel}</span>
                <span class="saved-item-meta">${blockCountLabel}</span>
            </div>
            <div class="saved-item-updated">${updatedLabel}</div>
        `;

        button.dataset.contentKey = `${icon}|${nameLabel}|${blockCountLabel}|${updatedLabel}`;
        
        // Add physics bindings
        anim.bindInteractiveHover?.(button);
        anim.bindInteractivePress?.(button);
        
        button.addEventListener('click', () => {
            activeScheduleId = schedule.id;
            anim.animatePressFeedback?.(button); // trigger press animation
            renderSavedSchedulesList(companionPayload); // this will now fast-patch
            syncActionStates();
        });
        
        li.appendChild(button);
        savedSchedulesList.appendChild(li);

        // Trigger entrance animation if this is a new item
        if (schedule.id === newIdToAnimate) {
            anim.animateSavedItemIn?.(li);
        }
    });

    syncActionStates();
    updateStorageHealth();
}

colorBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
        syncColorButtons(event.currentTarget);
    });
});

function isValidTime(value) {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

function sanitizeBlock(block) {
    if (!block || typeof block !== 'object') {
        throw new Error('Invalid block record.');
    }

    const normalized = {
        name: String(block.name || '').trim(),
        day: Number.parseInt(block.day, 10),
        start: String(block.start || '').trim(),
        end: String(block.end || '').trim(),
        room: String(block.room || '').trim(),
        section: String(block.section || '').trim(),
        color: String(block.color || 'bg-emerald-600').trim()
    };

    if (!normalized.name) {
        throw new Error('Each block must include a subject name.');
    }
    if (!Number.isInteger(normalized.day) || normalized.day < 0 || normalized.day > 5) {
        throw new Error(`Invalid day index for ${normalized.name}.`);
    }
    if (!isValidTime(normalized.start) || !isValidTime(normalized.end)) {
        throw new Error(`Invalid time format for ${normalized.name}.`);
    }
    if (timeToPixels(normalized.start) >= timeToPixels(normalized.end)) {
        throw new Error(`Start time must be earlier than end time for ${normalized.name}.`);
    }

    return normalized;
}

function hasConflict(day, start, end, ignoreIndex = -1) {
    return classes.find((c, idx) => {
        if (idx === ignoreIndex) {
            return false;
        }
        return c.day === day
            && ((start >= c.start && start < c.end)
                || (end > c.start && end <= c.end)
                || (start <= c.start && end >= c.end));
    });
}

function buildDayOptionsMarkup(selectedValue = '0') {
    return DAY_OPTIONS.map((dayOpt) => {
        const selected = dayOpt.value === String(selectedValue) ? ' selected' : '';
        return `<option value="${dayOpt.value}"${selected}>${dayOpt.label}</option>`;
    }).join('');
}

function maybePrefillOnlineMode(dayValue, roomInput) {
    if (!roomInput || !(dayValue === '1' || dayValue === '4')) {
        return;
    }

    if (!roomInput.value.trim()) {
        roomInput.value = 'ONLINE';
    }
}

function buildSecondaryDayRow({ day = '0', start = '', end = '', room = '', section = '' } = {}) {
    const row = document.createElement('div');
    row.className = 'secondary-day-row secondary-day-enter';
    row.innerHTML = `
        <div class="secondary-day-header-row">
            <div class="secondary-days-title secondary-days-title-inline">Another Day?</div>
            <button type="button" class="remove-secondary-day-btn" aria-label="Remove secondary day">−</button>
        </div>
        <div class="secondary-day-grid">
            <div class="secondary-field">
                <label class="field-label with-margin">Day</label>
                <select class="field-input secondary-day-select" aria-label="Secondary day">
                    ${buildDayOptionsMarkup(day)}
                </select>
            </div>
            <div class="secondary-field">
                <label class="field-label with-margin">Start (24H)</label>
                <input type="text" class="field-input secondary-start-input" aria-label="Secondary start time" placeholder="07:30" pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$" title="Enter time in 24-hour format (e.g., 13:30)" value="${escapeHtml(start)}">
            </div>
            <div class="secondary-field">
                <label class="field-label with-margin">End (24H)</label>
                <input type="text" class="field-input secondary-end-input" aria-label="Secondary end time" placeholder="09:00" pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$" title="Enter time in 24-hour format (e.g., 14:30)" value="${escapeHtml(end)}">
            </div>
            <div class="secondary-field">
                <label class="field-label with-margin">Room / Mode</label>
                <input type="text" class="field-input secondary-room-input" aria-label="Secondary room or mode" placeholder="F/E | ONLINE" value="${escapeHtml(room)}">
            </div>
            <div class="secondary-field secondary-field-wide">
                <label class="field-label with-margin">Section</label>
                <input type="text" class="field-input secondary-section-input" aria-label="Secondary section" placeholder="TW/TC/TF/TX/H" value="${escapeHtml(section)}">
            </div>
        </div>
    `;

    const daySelect = row.querySelector('.secondary-day-select');
    const roomInput = row.querySelector('.secondary-room-input');
    const removeBtn = row.querySelector('.remove-secondary-day-btn');

    const syncRowDefaults = () => {
        maybePrefillOnlineMode(daySelect.value, roomInput);
    };

    daySelect.addEventListener('change', syncRowDefaults);
    removeBtn.addEventListener('click', () => {
        anim.animateSecondaryRowOut(row, () => row.remove());
    });

    secondaryDaysContainer.appendChild(row);
    anim.animateSecondaryRowIn(row);
    syncRowDefaults();
    return row;
}

function addSecondaryDayDropdown(selectedValue = '0', startValue = '', endValue = '') {
    const primaryRoom = courseRoomInput?.value.trim() || '';
    const primarySection = courseSectionInput?.value.trim() || '';
    buildSecondaryDayRow({
        day: selectedValue,
        start: startValue,
        end: endValue,
        room: primaryRoom,
        section: primarySection
    });
}

function getScheduleEntries() {
    const primaryDay = Number.parseInt(courseDayInput.value, 10);
    const primaryStart = courseStartInput.value.trim();
    const primaryEnd = courseEndInput.value.trim();
    const primaryRoom = courseRoomInput.value.trim();
    const primarySection = courseSectionInput.value.trim();

    const entries = [
        {
            day: primaryDay,
            start: primaryStart,
            end: primaryEnd,
            room: primaryRoom,
            section: primarySection,
            source: 'primary'
        }
    ];

    const secondaryRows = Array.from(secondaryDaysContainer.querySelectorAll('.secondary-day-row'));
    secondaryRows.forEach((row) => {
        const day = Number.parseInt(row.querySelector('.secondary-day-select')?.value, 10);
        const start = row.querySelector('.secondary-start-input')?.value.trim() || '';
        const end = row.querySelector('.secondary-end-input')?.value.trim() || '';
        const room = row.querySelector('.secondary-room-input')?.value.trim() || '';
        const section = row.querySelector('.secondary-section-input')?.value.trim() || '';
        entries.push({
            day,
            start,
            end,
            room,
            section,
            source: 'secondary'
        });
    });

    return entries;
}

/* 9. Class Block Editor (Modal) */
const EDIT_EXTEND_RELATED_KEY = 'feu_edit_extend_related';
const editModal = document.getElementById('edit-modal');
const editModalCard = editModal?.querySelector('.modal-card');
const editForm = document.getElementById('edit-class-form');
const editCourseName = document.getElementById('edit-course-name');
const editCourseDay = document.getElementById('edit-course-day');
const editCourseStart = document.getElementById('edit-course-start');
const editCourseEnd = document.getElementById('edit-course-end');
const editCourseRoom = document.getElementById('edit-course-room');
const editCourseSection = document.getElementById('edit-course-section');
const editExtendRelated = document.getElementById('edit-extend-related');
const editCancelBtn = document.getElementById('edit-cancel-btn');

const editColorPicker = document.getElementById('edit-color-picker');
const editColorBtns = editColorPicker?.querySelectorAll('.color-btn') || [];

let editingIndex = null;
let editSelectedColor = 'bg-blue-600';
let editExtendRelatedState = localStorage.getItem(EDIT_EXTEND_RELATED_KEY) === '1';

function syncEditColorButtons(selectedBtn = null) {
    const activeButton = selectedBtn || Array.from(editColorBtns).find(btn => btn.dataset.color === editSelectedColor);

    editColorBtns.forEach((btn) => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-slate-800');
        btn.classList.add('opacity-50');
        btn.className = btn.className.replace(/\bring-[a-z-]+-400\b/g, '');
    });

    if (!activeButton) {
        return;
    }

    editSelectedColor = activeButton.dataset.color || editSelectedColor;
    activeButton.classList.remove('opacity-50');
    activeButton.classList.add('ring-2', 'ring-offset-2', 'ring-offset-slate-800', getRingClass(editSelectedColor));
}

editColorBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
        syncEditColorButtons(event.currentTarget);
    });
});

/* Opens class block editor. */
function openEditModal(index) {
    const target = classes[index];
    if (!target) {
        return;
    }

    editingIndex = index;
    editCourseName.value = target.name;
    editCourseDay.value = String(target.day);
    editCourseStart.value = target.start;
    editCourseEnd.value = target.end;
    editCourseRoom.value = target.room || '';
    editCourseSection.value = target.section || '';

    editSelectedColor = target.color || 'bg-blue-600';
    syncEditColorButtons();

    setEditExtendRelatedState(editExtendRelatedState);
    anim.animateModalIn(editModal, editModalCard);
}

function closeEditModal() {
    editingIndex = null;
    anim.animateModalOut(editModal, editModalCard);
}

/* Normalizes incoming schedule data. */
export function normalizeSchedulePayload(payload, fallbackName = '') {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Schedule JSON is not an object.');
    }

    const blocksSource = Array.isArray(payload.blocks) ? payload.blocks : Array.isArray(payload.classes) ? payload.classes : null;
    if (!blocksSource) {
        throw new Error('Schedule JSON must include a blocks array.');
    }

    const normalizedBlocks = blocksSource.map(sanitizeBlock);
    const now = Date.now();
    const name = String(payload.name || fallbackName || 'Imported Schedule').trim();

    return {
        id: String(payload.id || `sched-${now}-${Math.random().toString(36).slice(2, 8)}`),
        name,
        blocks: normalizedBlocks,
        createdAt: Number(payload.createdAt) || now,
        updatedAt: Number(payload.updatedAt) || now,
        meta: {
            defaultColor: String(payload.meta?.defaultColor || 'bg-emerald-600')
        }
    };
}

function triggerDownload(filename, content, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function saveSnapshot() {
    if (classes.length === 0) {
        setStatus('Plot at least one class before saving.', 'error');
        return;
    }

    const now = Date.now();
    const snapshotName = scheduleNameInput.value.trim() || 'Untitled Schedule';
    const schedule = {
        id: `sched-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: snapshotName,
        blocks: classes.map((c) => ({ ...c })),
        createdAt: now,
        updatedAt: now,
        meta: {
            defaultColor: selectedColor
        }
    };

    savedSchedules.unshift(schedule);
    activeScheduleId = schedule.id;
    syncSnapshotsToStorage();
    renderSavedSchedulesList(null, schedule.id);

    setStatus(`Saved ${snapshotName} to Local Library.`, 'success');
}

function downloadSelectedSchedule() {
    const schedule = getActiveSchedule();
    if (!schedule) {
        setStatus('Select a schedule from your library to download.', 'warning');
        return;
    }

    const safeName = slugify(schedule.name) || 'schedule';
    const stamp = formatTimestamp(new Date(schedule.updatedAt || Date.now()));
    
    const payload = {
        version: 1,
        ...schedule
    };
    
    triggerDownload(`${safeName}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setStatus(`Exported ${schedule.name} as JSON.`, 'success');
}

async function loadSelectedSchedule() {
    const selected = getActiveSchedule();
    if (!selected) {
        setStatus('Select a saved schedule first.', 'error');
        return;
    }

    if (hasUnsavedChanges()) {
        const ok = await showConfirmDialog('You have unsaved plotted changes. Replace current schedule with selected one?', 'Replace Current Schedule?');
        if (!ok) {
            return;
        }
    }

    classes = selected.blocks.map((b) => ({ ...b }));
    selectedColor = selected.meta?.defaultColor || selectedColor;
    syncColorButtons();
    pendingFullLoad = true;
    renderSchedule();
    setStatus(`Loaded ${selected.name}.`, 'success');
}

function overwriteSelectedSchedule() {
    const selected = getActiveSchedule();
    if (!selected) {
        setStatus('Select a saved schedule to overwrite.', 'error');
        return;
    }
    if (classes.length === 0) {
        setStatus('Nothing to overwrite. Plot classes first.', 'error');
        return;
    }

    selected.blocks = classes.map((c) => ({ ...c }));
    selected.updatedAt = Date.now();
    selected.meta = { defaultColor: selectedColor };
    syncSnapshotsToStorage();
    renderSavedSchedulesList();

    setStatus(`Overwrote ${selected.name}.`, 'success');
}

async function deleteSelectedSchedule() {
    const selected = getActiveSchedule();
    if (!selected) {
        setStatus('Select a saved schedule to delete.', 'error');
        return;
    }

    if (!await showConfirmDialog(`Delete ${selected.name} from the in-app saved list?`, 'Delete Saved Schedule?')) {
        return;
    }

    const itemEl = savedSchedulesList.querySelector(`button[data-id="${selected.id}"]`)?.closest('li');
    
    const performDeletion = () => {
        savedSchedules = savedSchedules.filter((s) => s.id !== selected.id);
        activeScheduleId = savedSchedules[0]?.id || null;
        syncSnapshotsToStorage();
        renderSavedSchedulesList();
        setStatus(`Deleted ${selected.name} from saved list.`, 'success');
    };

    if (itemEl) {
        anim.animateSavedItemOut?.(itemEl, performDeletion);
    } else {
        performDeletion();
    }
}

function generateSmartName(baseName) {
    let name = baseName;
    let counter = 1;
    
    while (savedSchedules.some(s => s.name === name)) {
        name = `${baseName} (${counter})`;
        counter++;
    }
    
    return name;
}

async function importScheduleFiles(fileList) {
    if (!fileList || fileList.length === 0) {
        return;
    }

    let importedCount = 0;
    let encounteredInvalidJson = false;
    for (const file of fileList) {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const normalized = normalizeSchedulePayload(parsed, file.name.replace(/\.json$/i, ''));

            const existingIndex = savedSchedules.findIndex((s) => s.id === normalized.id);
            if (existingIndex !== -1) {
                const ok = await showConfirmDialog(
                    `Schedule "${normalized.name}" already exists in your library. Overwrite it?`,
                    'Duplicate ID Detected'
                );
                if (ok) {
                    savedSchedules[existingIndex] = normalized;
                } else {
                    normalized.id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    normalized.name = generateSmartName(normalized.name);
                    savedSchedules.unshift(normalized);
                }
            } else {
                normalized.name = generateSmartName(normalized.name);
                savedSchedules.unshift(normalized);
            }

            activeScheduleId = normalized.id;
            importedCount += 1;
        } catch (error) {
            encounteredInvalidJson = true;
        }
    }

    syncSnapshotsToStorage();
    renderSavedSchedulesList();
    if (importedCount > 0) {
        setStatus(`Imported ${importedCount} schedule${importedCount === 1 ? '' : 's'}.`, 'success');
        await showAlertDialog('Loaded your JSON file. Scroll down to load and manage.', 'Import Complete');
        return;
    }

    if (encounteredInvalidJson) {
        setStatus('Invalid JSON file.', 'error');
    }
}

/* 10. PNG Export Management */
const exportModal = document.getElementById('export-modal');
const exportModalCard = exportModal?.querySelector('.export-modal-card');
const exportForm = document.getElementById('export-form');
const exportNameInput = document.getElementById('export-name-input');
const exportSizePresetInput = document.getElementById('export-size-preset');
const exportCloseBtn = document.getElementById('export-close-btn');
const exportCancelBtn = document.getElementById('export-cancel-btn');
const exportPngBtn = document.getElementById('export-png-btn');

async function exportCurrentTimetablePng() {
    const requestedName = exportNameInput?.value.trim() || getActiveSchedule()?.name || scheduleNameInput.value.trim() || 'Schedule';
    const didExport = await exportScheduleAsPng({
        classes,
        timetableExportArea,
        exportName: requestedName,
        sizePreset: exportSizePresetInput?.value || 'desktop',
        watermarkText: 'Schedule Creator Tool by Ken',
        setStatus,
        slugify,
        formatTimestamp,
        triggerDownload
    });

    if (didExport) {
        closeExportModal();
    }
}

function openExportModal() {
    if (!exportModal || !exportNameInput) {
        return;
    }

    const defaultName = getActiveSchedule()?.name || scheduleNameInput.value.trim() || 'Schedule';
    exportNameInput.value = defaultName;
    anim.animateModalIn(exportModal, exportModalCard);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => exportNameInput.focus());
}

function closeExportModal() {
    if (!exportModal) {
        return;
    }

    anim.animateModalOut(exportModal, exportModalCard, () => {
        document.body.style.overflow = '';
    });
}

function initTimeAxis() {
    let html = '';
    for (let i = START_HOUR; i < END_HOUR; i++) {
        const isPM = i >= 12;
        const displayHour12 = i > 12 ? i - 12 : i;
        const ampm = isPM ? 'PM' : 'AM';
        const displayHour24 = i.toString().padStart(2, '0') + ':00';

        html += `<div class="relative" style="height:${LIVE_ROW_HEIGHT_PIXELS}px;">
            <span class="absolute -top-3 right-2 text-right">
                <div class="text-[11px] font-bold text-slate-300 leading-none">${displayHour24}</div>
                <div class="text-[9px] font-medium text-slate-500 mt-0.5">${displayHour12} ${ampm}</div>
            </span>
        </div>`;
    }
    timeAxis.innerHTML = html;
}

function timeToPixels(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalHoursFromStart = (hours - START_HOUR) + (minutes / 60);
    return totalHoursFromStart * LIVE_ROW_HEIGHT_PIXELS;
}

/* Core rendering engine for the timetable blocks, calculating positions and sizes */
export function renderSchedule() {
    container.innerHTML = '';

    classes.forEach((c, index) => {
        const topPx = timeToPixels(c.start);
        const bottomPx = timeToPixels(c.end);
        const heightPx = bottomPx - topPx;
        const isSmallCell = heightPx <= LIVE_ROW_HEIGHT_PIXELS;
        const textModeClass = isSmallCell ? 'truncate' : 'wrap';

        const leftPercent = c.day * (100 / 6);

        const block = document.createElement('div');
        block.className = `absolute rounded-lg border border-white/10 shadow-lg p-2 ${c.color} cursor-default group schedule-block`;
        block.style.top = `${topPx}px`;
        block.style.height = `${heightPx}px`;
        block.style.left = `${leftPercent}%`;
        block.style.width = `calc(${100 / 6}% - 4px)`;
        block.style.marginLeft = '2px';

        const formatTime = (t) => {
            let [h, m] = t.split(':');
            h = parseInt(h, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        };

        const [code, ...rest] = c.name.split('-');
        const title = rest.join('-').trim();

        block.innerHTML = `
            <div class="schedule-block-header">
                <div class="schedule-block-code ${textModeClass}">${code.trim()}</div>
                <div class="block-actions">
                    <button onclick="openEditModal(${index})" class="block-action-btn" title="Edit class">✎</button>
                    <button onclick="removeClass(${index})" class="block-action-btn" title="Remove class">✕</button>
                </div>
            </div>
            ${title ? `<div class="schedule-block-title ${textModeClass}">${title}</div>` : ''}
            <div class="schedule-block-meta">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ${formatTime(c.start)} - ${formatTime(c.end)}
            </div>
            ${(c.room || c.section) ? `<div class="schedule-block-tags">${c.room ? `<span class="schedule-tag">${c.room}</span>` : ''}${c.section ? `<span class="schedule-tag">${c.section}</span>` : ''}</div>` : ''}
        `;

        anim.bindBlockHoverAnimation(block, c.color);
        anim.bindBlockHoldInteraction?.(block, c.color, () => openEditModal(index));

        container.appendChild(block);
    });

    if (anim.hasGsap()) {
        if (pendingFullLoad) {
            const allBlocks = Array.from(container.children);
            anim.animateAddedBlocks(allBlocks);
        } else if (pendingAddedCount > 0) {
            const startIndex = Math.max(0, container.children.length - pendingAddedCount);
            const addedEls = Array.from(container.children).slice(startIndex);
            anim.animateAddedBlocks(addedEls);
        }

        if (pendingEditedIndexes.length > 0) {
            const editedEls = pendingEditedIndexes
                .map((index) => container.children[index])
                .filter(Boolean);

            anim.animateEditedBlocks(editedEls);
        }
    }

    pendingAddedCount = 0;
    pendingEditedIndexes = [];
    pendingFullLoad = false;

    countDisplay.innerText = classes.length;
    localStorage.setItem('feu_schedule', JSON.stringify(classes));
    syncActionStates();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('course-name').value;
    const entries = getScheduleEntries();

    if (entries.length === 0) {
        await showAlertDialog('Pick at least one day.', 'Missing Day');
        return;
    }

    const invalidEntry = entries.find((entry) => {
        if (!Number.isInteger(entry.day) || entry.day < 0 || entry.day > 5) {
            return true;
        }
        if (!isValidTime(entry.start) || !isValidTime(entry.end)) {
            return true;
        }
        return timeToPixels(entry.start) >= timeToPixels(entry.end);
    });

    if (invalidEntry) {
        await showAlertDialog('Time glitch: each day must have valid Start/End time and Start must be before End.', 'Invalid Time');
        return;
    }

    const dedupedEntries = [];
    const seenKeys = new Set();
    entries.forEach((entry) => {
        const key = `${entry.day}|${entry.start}|${entry.end}|${entry.room}|${entry.section}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            dedupedEntries.push(entry);
        }
    });

    const hasAnyConflict = dedupedEntries.some((entry) => Boolean(hasConflict(entry.day, entry.start, entry.end)));
    if (hasAnyConflict) {
        if (!await showConfirmDialog('Wait up! One or more selected days overlap with existing classes. Do you still want to plot all selected days?', 'Schedule Conflict')) {
            return;
        }
    }

    dedupedEntries.forEach((entry) => {
        classes.push({
            name,
            day: entry.day,
            start: entry.start,
            end: entry.end,
            room: entry.room,
            section: entry.section,
            color: selectedColor
        });
    });
    pendingAddedCount = dedupedEntries.length;
    renderSchedule();

    document.getElementById('course-name').value = '';
    document.getElementById('course-room').value = '';
    courseSectionInput.value = '';
    secondaryDaysContainer.innerHTML = '';
    document.getElementById('course-name').focus();
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (editingIndex === null || !classes[editingIndex]) {
        closeEditModal();
        return;
    }

    setEditExtendRelatedState(editExtendRelated?.checked);

    const name = editCourseName.value.trim();
    const day = Number.parseInt(editCourseDay.value, 10);
    const start = editCourseStart.value.trim();
    const end = editCourseEnd.value.trim();
    const room = editCourseRoom.value.trim();
    const section = editCourseSection.value.trim();
    const extendRelated = editExtendRelatedState;
    const activeBlock = classes[editingIndex];

    if (!name) {
        await showAlertDialog('Subject is required.', 'Missing Subject');
        return;
    }
    if (!isValidTime(start) || !isValidTime(end) || timeToPixels(start) >= timeToPixels(end)) {
        await showAlertDialog('Time glitch: Start time must be before End time.', 'Invalid Time');
        return;
    }

    const conflict = hasConflict(day, start, end, editingIndex);
    if (conflict) {
        if (!await showConfirmDialog(`Wait up! This overlaps with ${conflict.name}. Do you still want to save?`, 'Schedule Conflict')) {
            return;
        }
    }

    if (extendRelated) {
        const groupKey = normalizeCourseIdentity(activeBlock.name);
        const relatedIndexes = classes
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => normalizeCourseIdentity(block.name) === groupKey)
            .map(({ index }) => index);

        classes[editingIndex] = {
            ...classes[editingIndex],
            name,
            day,
            start,
            end,
            room,
            section,
            color: editSelectedColor
        };

        relatedIndexes.filter((index) => index !== editingIndex).forEach((index) => {
            classes[index] = {
                ...classes[index],
                name,
                room,
                section,
                color: editSelectedColor
            };
        });
        pendingEditedIndexes = [...relatedIndexes];
    } else {
        classes[editingIndex] = {
            ...classes[editingIndex],
            name,
            day,
            start,
            end,
            room,
            section,
            color: editSelectedColor
        };
        pendingEditedIndexes = [editingIndex];
    }

    closeEditModal();
    renderSchedule();
    setStatus('Plotted class updated.', 'success');
});

editCancelBtn.addEventListener('click', closeEditModal);

addSecondaryDayBtn.addEventListener('click', () => {
    const primaryStart = document.getElementById('course-start').value.trim();
    const primaryEnd = document.getElementById('course-end').value.trim();
    addSecondaryDayDropdown('0', primaryStart, primaryEnd);
});

window.removeClass = (index) => {
    const blockEl = container.children[index];
    if (blockEl) {
        anim.animateBlockExitAndRemove(blockEl, () => {
            classes.splice(index, 1);
            renderSchedule();
        });
        return;
    }

    classes.splice(index, 1);
    renderSchedule();
};
window.openEditModal = openEditModal;

/* 11. Schedule Clearing Logic */
const WALANG_LAMAN_SCHEDULE_MO = [
    "Are you sure you want to clear a schedule that's already empty?",
    "Still empty, champ.",
    "Clicking it again won't make it any emptier.",
    "You're really dedicated to this empty schedule thing, huh?",
    "Stop it. Get some help.",
    "Okay, now you're just spamming."
];

let emptyClearSpamCount = 0;

document.getElementById('clear-btn').addEventListener('click', async () => {
    if (classes.length === 0) {
        emptyClearSpamCount++;
        let message = "";
        
        if (emptyClearSpamCount <= WALANG_LAMAN_SCHEDULE_MO.length) {
            message = WALANG_LAMAN_SCHEDULE_MO[emptyClearSpamCount - 1];
        } else {
            const lastMsg = WALANG_LAMAN_SCHEDULE_MO[WALANG_LAMAN_SCHEDULE_MO.length - 1];
            const multiplier = emptyClearSpamCount - WALANG_LAMAN_SCHEDULE_MO.length + 1;
            message = `${lastMsg} x${multiplier}`;
        }

        setStatus(message, 'error');
        return;
    }

    // Reset spam count if they actually have something to clear
    emptyClearSpamCount = 0;

    if (await showConfirmDialog('Nuke the entire schedule?', 'Clear Schedule?')) {
        const allBlocks = Array.from(container.children);
        anim.animateMassBlockExit(allBlocks, () => {
            classes = [];
            renderSchedule();
            setStatus('Cleared plotted schedule.', 'info');
        });
    }
});

saveSnapshotBtn.addEventListener('click', saveSnapshot);
downloadSelectedBtn.addEventListener('click', downloadSelectedSchedule);
importJsonBtn.addEventListener('click', () => jsonFileInput.click());
jsonFileInput.addEventListener('change', async (event) => {
    await importScheduleFiles(normalizeDroppedFiles(event.target.files));
    event.target.value = '';
});
loadSelectedBtn.addEventListener('click', loadSelectedSchedule);
overwriteSelectedBtn.addEventListener('click', overwriteSelectedSchedule);
deleteSelectedBtn.addEventListener('click', deleteSelectedSchedule);
exportPngBtn.addEventListener('click', openExportModal);
exportCloseBtn?.addEventListener('click', closeExportModal);
exportCancelBtn?.addEventListener('click', closeExportModal);
exportForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await exportCurrentTimetablePng();
});

mobileWarningAckBtn?.addEventListener('click', () => {
    localStorage.setItem(MOBILE_WARNING_ACK_KEY, '1');
    syncMobileWarningVisibility();
});

mobileToggleViewBtn?.addEventListener('click', () => {
    setMobileViewMode(mobileViewMode === 'plotter' ? 'timetable' : 'plotter');
});

mobilePreviewCloseBtn?.addEventListener('click', () => {
    closeMobileFullPreview();
});

editExtendRelated?.addEventListener('change', () => {
    setEditExtendRelatedState(editExtendRelated.checked);
});

courseDayInput?.addEventListener('change', () => {
    maybePrefillOnlineMode(courseDayInput.value, courseRoomInput);
});

setEditExtendRelatedState(editExtendRelatedState);

window.addEventListener('resize', () => {
    applyLiveTimetableMetrics();
    syncMobileLayoutState();
});

initTimeAxis();
applyLiveTimetableMetrics();
populateSubjectOptions();
renderSavedSchedulesList();
updateStorageHealth();
initColorSelectorHighlight();
syncColorButtons();
setupButtonFeedbackDelegation();
syncMobileLayoutState();
setStatus('Tip: Export your schedules as JSON, then import them back anytime.');
wireDropImport();
renderSchedule();

/* State modifiers for extension hooks to update visualizer data from the bridge */
export function updateClasses(newClasses) {
    classes = newClasses;
}

export function updateActiveScheduleId(id) {
    activeScheduleId = id;
}
