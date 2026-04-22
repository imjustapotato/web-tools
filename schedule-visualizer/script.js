import '@iconify/iconify';
import { exportScheduleAsPng } from './export/export-png.js';
import { SUBJECT_CATALOG } from './subjects.js';
import * as anim from './anim.js';

let classes = JSON.parse(localStorage.getItem('feu_schedule')) || [];
let selectedColor = 'bg-emerald-600';
let savedSchedules = [];
let activeScheduleId = null;
let editingIndex = null;

const START_HOUR = 7;
const END_HOUR = 22;
const LIVE_ROW_HEIGHT_PIXELS = 84;
const HEADER_HEIGHT_PX = 40;
const MOBILE_BREAKPOINT = 768;
const MOBILE_WARNING_ACK_KEY = 'feu_mobile_warning_ack';

const form = document.getElementById('class-form');
const colorBtns = document.querySelectorAll('.color-btn');
const container = document.getElementById('blocks-container');
const timeAxis = document.getElementById('time-axis');
const countDisplay = document.getElementById('class-count');
const scheduleNameInput = document.getElementById('schedule-name');
const managerStatus = document.getElementById('manager-status');
const savedSchedulesList = document.getElementById('saved-schedules-list');
const jsonFileInput = document.getElementById('json-file-input');
const saveSnapshotBtn = document.getElementById('save-snapshot-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const loadSelectedBtn = document.getElementById('load-selected-btn');
const overwriteSelectedBtn = document.getElementById('overwrite-selected-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const exportPngBtn = document.getElementById('export-png-btn');
const exportModal = document.getElementById('export-modal');
const exportModalCard = exportModal?.querySelector('.export-modal-card');
const exportForm = document.getElementById('export-form');
const exportNameInput = document.getElementById('export-name-input');
const exportSizePresetInput = document.getElementById('export-size-preset');
const exportCloseBtn = document.getElementById('export-close-btn');
const exportCancelBtn = document.getElementById('export-cancel-btn');
const jsonDropZone = document.getElementById('json-drop-zone');
const courseDayInput = document.getElementById('course-day');
const courseStartInput = document.getElementById('course-start');
const courseEndInput = document.getElementById('course-end');
const courseRoomInput = document.getElementById('course-room');
const courseSectionInput = document.getElementById('course-section');
const addSecondaryDayBtn = document.getElementById('add-secondary-day-btn');
const secondaryDaysContainer = document.getElementById('secondary-days-container');
const timetableExportArea = document.getElementById('timetable-export-area');
const timetableCanvasEl = timetableExportArea?.querySelector('.timetable-canvas');
const appContent = document.querySelector('.app-content');
const mobileWarning = document.getElementById('mobile-warning');
const mobileWarningAckBtn = document.getElementById('mobile-warning-ack-btn');
const mobileToggleViewBtn = document.getElementById('mobile-toggle-view-btn');
const mobileFullPreviewBtn = document.getElementById('mobile-full-preview-btn');
const mobilePreviewModal = document.getElementById('mobile-preview-modal');
const mobilePreviewCloseBtn = document.getElementById('mobile-preview-close-btn');
const mobilePreviewContainer = document.getElementById('mobile-preview-container');

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-class-form');
const editCourseName = document.getElementById('edit-course-name');
const editCourseDay = document.getElementById('edit-course-day');
const editCourseStart = document.getElementById('edit-course-start');
const editCourseEnd = document.getElementById('edit-course-end');
const editCourseRoom = document.getElementById('edit-course-room');
const editCourseSection = document.getElementById('edit-course-section');
const editExtendRelated = document.getElementById('edit-extend-related');
const editCancelBtn = document.getElementById('edit-cancel-btn');
const toastStack = document.getElementById('toast-stack');
const messageModal = document.getElementById('message-modal');
const messageModalTitle = document.getElementById('message-modal-title');
const messageModalBody = document.getElementById('message-modal-body');
const messageModalInputWrap = document.getElementById('message-modal-input-wrap');
const messageModalInput = document.getElementById('message-modal-input');
const messageModalCancel = document.getElementById('message-modal-cancel');
const messageModalConfirm = document.getElementById('message-modal-confirm');
const colorPicker = document.getElementById('color-picker');
const editModalCard = editModal?.querySelector('.modal-card');
const mobilePreviewCard = mobilePreviewModal?.querySelector('.mobile-preview-card');
const messageModalCard = messageModal?.querySelector('.message-card');

const EDIT_EXTEND_RELATED_KEY = 'feu_edit_extend_related';

const DAY_OPTIONS = [
    { value: '0', label: 'Monday' },
    { value: '1', label: 'Tuesday' },
    { value: '2', label: 'Wednesday' },
    { value: '3', label: 'Thursday' },
    { value: '4', label: 'Friday' },
    { value: '5', label: 'Saturday' }
];

let mobileViewMode = 'plotter';
let editExtendRelatedState = localStorage.getItem(EDIT_EXTEND_RELATED_KEY) === '1';
let pendingAddedCount = 0;
let pendingEditedIndexes = [];

function setupButtonFeedbackDelegation() {
    document.addEventListener('click', (event) => {
        const targetButton = event.target.closest('.btn, .manager-btn, .color-btn, .block-action-btn, .remove-secondary-day-btn');
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

function setStatus(message, tone = 'info') {
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
        toast.classList.remove('show');
        window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-dismiss')?.addEventListener('click', removeToast);
    toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
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
    deleteSelectedBtn.disabled = !hasSelection;
    saveSnapshotBtn.disabled = !hasPlotted;
    exportPngBtn.disabled = !hasPlotted;
}

function renderSavedSchedulesList() {
    savedSchedulesList.innerHTML = '';

    if (savedSchedules.length === 0) {
        const li = document.createElement('li');
        li.className = 'saved-list-empty';
        li.innerText = 'No schedules loaded yet.';
        savedSchedulesList.appendChild(li);
        syncActionStates();
        return;
    }

    savedSchedules.forEach((schedule) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `saved-schedule-item ${schedule.id === activeScheduleId ? 'active' : ''}`;
        button.innerHTML = `
            <div class="saved-item-row">
                <span class="saved-item-name">${createIconMarkup('mdi:bookmark-outline')}${schedule.name}</span>
                <span class="saved-item-meta">${schedule.blocks.length} block${schedule.blocks.length === 1 ? '' : 's'}</span>
            </div>
            <div class="saved-item-updated">Updated ${new Date(schedule.updatedAt).toLocaleString()}</div>
        `;
        button.addEventListener('click', () => {
            activeScheduleId = schedule.id;
            renderSavedSchedulesList();
            syncActionStates();
        });
        li.appendChild(button);
        savedSchedulesList.appendChild(li);
    });

    syncActionStates();
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
        row.classList.add('secondary-day-removing');
        window.setTimeout(() => row.remove(), 220);
    });

    secondaryDaysContainer.appendChild(row);
    window.requestAnimationFrame(() => row.classList.remove('secondary-day-enter'));
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

const editColorPicker = document.getElementById('edit-color-picker');
const editColorBtns = editColorPicker?.querySelectorAll('.color-btn') || [];
let editSelectedColor = 'bg-blue-600';

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

function normalizeSchedulePayload(payload, fallbackName = '') {
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
    renderSavedSchedulesList();

    const safeName = slugify(snapshotName) || 'schedule';
    const stamp = formatTimestamp(now);
    const payload = {
        version: 1,
        ...schedule
    };
    triggerDownload(`${safeName}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setStatus(`Saved and downloaded ${snapshotName}.`, 'success');
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
    renderSavedSchedulesList();

    const safeName = slugify(selected.name) || 'schedule';
    const stamp = formatTimestamp(selected.updatedAt);
    triggerDownload(
        `${safeName}-${stamp}.json`,
        JSON.stringify({ version: 1, ...selected }, null, 2),
        'application/json'
    );
    setStatus(`Overwrote and downloaded ${selected.name}.`, 'success');
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

    savedSchedules = savedSchedules.filter((s) => s.id !== selected.id);
    activeScheduleId = savedSchedules[0]?.id || null;
    renderSavedSchedulesList();
    setStatus(`Deleted ${selected.name} from saved list.`, 'success');
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

            if (savedSchedules.some((s) => s.id === normalized.id)) {
                normalized.id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            }

            savedSchedules.unshift(normalized);
            activeScheduleId = normalized.id;
            importedCount += 1;
        } catch (error) {
            encounteredInvalidJson = true;
        }
    }

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

function renderSchedule() {
    container.innerHTML = '';

    classes.forEach((c, index) => {
        const topPx = timeToPixels(c.start);
        const bottomPx = timeToPixels(c.end);
        const heightPx = bottomPx - topPx;
        const isSmallCell = heightPx <= LIVE_ROW_HEIGHT_PIXELS;
        const textModeClass = isSmallCell ? 'truncate' : 'wrap';

        const leftPercent = c.day * (100 / 6);

        const block = document.createElement('div');
        block.className = `absolute rounded-lg border border-white/10 shadow-lg p-2 ${c.color} hover:brightness-110 transition cursor-default group schedule-block`;
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

        container.appendChild(block);
    });

    if (anim.hasGsap()) {
        if (pendingAddedCount > 0) {
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

document.getElementById('clear-btn').addEventListener('click', async () => {
    if (await showConfirmDialog('Nuke the entire schedule?', 'Clear Schedule?')) {
        classes = [];
        renderSchedule();
        setStatus('Cleared plotted schedule.', 'info');
    }
});

saveSnapshotBtn.addEventListener('click', saveSnapshot);
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

mobileFullPreviewBtn?.addEventListener('click', () => {
    openMobileFullPreview();
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
initColorSelectorHighlight();
syncColorButtons();
setupButtonFeedbackDelegation();
syncMobileLayoutState();
setStatus('Tip: Save snapshots as JSON, then load them back anytime.');
wireDropImport();
renderSchedule();

// Web Tools Companion Extension Bridge Listener
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_EXTENSION_SYNC') {
        const payload = event.data.payload;
        try {
            const normalized = normalizeSchedulePayload(payload, payload.name || 'Extension Schedule');
            
            // Smart update: Avoid duplicates if ID is the same, otherwise push to top
            const existingIndex = savedSchedules.findIndex((s) => s.id === normalized.id);
            if (existingIndex !== -1) {
                savedSchedules[existingIndex] = normalized;
            } else {
                savedSchedules.unshift(normalized);
            }
            
            activeScheduleId = normalized.id;
            classes = normalized.blocks.map((b) => ({ ...b }));
            
            renderSavedSchedulesList();
            renderSchedule();
            setStatus('Auto Plotter Synced from OSES!', 'success');
        } catch (err) {
            console.error('[Web Tools] Failed to sync extension schedule:', err);
            setStatus('Failed to sync schedule from extension.', 'error');
        }
    }
});

// Broadcast readiness so extension bridge can immediately inject if it was waiting
window.postMessage({ type: 'WEB_TOOLS_APP_READY' }, '*');
