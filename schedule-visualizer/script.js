let classes = JSON.parse(localStorage.getItem('feu_schedule')) || [];
let selectedColor = 'bg-emerald-600';
let savedSchedules = [];
let activeScheduleId = null;
let editingIndex = null;

const START_HOUR = 7;
const END_HOUR = 22;
const PIXELS_PER_HOUR = 72;
const HEADER_HEIGHT_PX = 40;
const EXPORT_PNG_SCALE = 1;
const EXPORT_CAPTURE_SCALE_BASE = 2;
const MOBILE_BREAKPOINT = 768;
const MOBILE_WARNING_ACK_KEY = 'feu_mobile_warning_ack';

const SUBJECT_CATALOG = [
    { code: 'CCS0001', title: 'INTRODUCTION TO COMPUTING LEC' },
    { code: 'CCS0001L', title: 'INTRODUCTION TO COMPUTING LAB' },
    { code: 'CCS0003', title: 'COMPUTER PROGRAMMING 1 LEC' },
    { code: 'CCS0003L', title: 'COMPUTER PROGRAMMING 1 LAB' },
    { code: 'CCS0005', title: 'INTRODUCTION TO HUMAN COMPUTER INTERACTION LEC' },
    { code: 'CCS0005L', title: 'INTRODUCTION TO HUMAN COMPUTER INTERACTION LAB' },
    { code: 'CCS0007', title: 'COMPUTER PROGRAMMING 2 LEC' },
    { code: 'CCS0007L', title: 'COMPUTER PROGRAMMING 2 LAB' },
    { code: 'CCS0015', title: 'DATA STRUCTURES AND ALGORITHMS LEC' },
    { code: 'CCS0015L', title: 'DATA STRUCTURES AND ALGORITHMS LAB' },
    { code: 'CCS0023', title: 'OBJECT ORIENTED PROGRAMMING LEC' },
    { code: 'CCS0023L', title: 'OBJECT ORIENTED PROGRAMMING LAB' },
    { code: 'CCS0043', title: 'APPLICATIONS DEVELOPMENT AND EMERGING TECHNOLOGIES LEC' },
    { code: 'CCS0043L', title: 'APPLICATIONS DEVELOPMENT AND EMERGING TECHNOLOGIES LAB' },
    { code: 'CCS0101', title: 'DESIGN THINKING CCS' },
    { code: 'CCS0103', title: 'TECHNOPRENEURSHIP CCS' },
    { code: 'CCS0105', title: 'PROFESSIONAL DEVELOPMENT COMPUTING PROFESSION' },
    { code: 'GED0001', title: 'SPECIALIZED ENGLISH PROGRAM 1' },
    { code: 'GED0004', title: 'PHYSICAL EDUCATION 1' },
    { code: 'GED0006', title: 'PERSONAL AND PROFESSIONAL EFFECTIVENESS' },
    { code: 'GED0007', title: 'ART APPRECIATION' },
    { code: 'GED0009', title: 'READINGS IN PHILIPPINE HISTORY' },
    { code: 'GED0011', title: 'SCIENCE, TECHNOLOGY AND SOCIETY' },
    { code: 'GED0015', title: 'PHYSICAL EDUCATION 2' },
    { code: 'GED0019', title: 'UNDERSTANDING THE SELF' },
    { code: 'GED0021', title: 'SPECIALIZED ENGLISH PROGRAM 2' },
    { code: 'GED0023', title: 'PHYSICAL EDUCATION 3' },
    { code: 'GED0027', title: 'MATHEMATICS IN THE MODERN WORLD' },
    { code: 'GED0031', title: 'PURPOSIVE COMMUNICATION' },
    { code: 'GED0035', title: 'THE CONTEMPORARY WORLD' },
    { code: 'GED0039', title: 'APPLIED STATISTICS' },
    { code: 'GED0043', title: 'SPECIALIZED ENGLISH PROGRAM 3' },
    { code: 'GED0047', title: 'FOREIGN LANGUAGE' },
    { code: 'GED0049', title: 'LIFE AND WORKS OF RIZAL' },
    { code: 'GED0061', title: 'ETHICS' },
    { code: 'GED0073', title: 'GE ELECTIVE 2' },
    { code: 'GED0081', title: 'COLLEGE PHYSICS 1 LECTURE' },
    { code: 'GED0081L', title: 'COLLEGE PHYSICS 1 LABORATORY' },
    { code: 'GED0083', title: 'COLLEGE PHYSICS 2 LECTURE' },
    { code: 'GED0083L', title: 'COLLEGE PHYSICS 2 LABORATORY' },
    { code: 'GED0085', title: 'GENDER AND SOCIETY' },
    { code: 'IT0002', title: 'USER DESIGN FUNDAMENTALS' },
    { code: 'IT0004', title: 'USER EXPERIENCE DESIGN FUNDAMENTALS' },
    { code: 'IT0007', title: 'INFORMATION ASSURANCE AND SECURITY 2' },
    { code: 'IT0009', title: 'FUNDAMENTALS OF DATABASE SYSTEMS' },
    { code: 'IT0011', title: 'INTEGRATIVE PROGRAMMING AND TECHNOLOGIES' },
    { code: 'IT0013', title: 'NETWORKING 1' },
    { code: 'IT0015', title: 'NETWORKING 2' },
    { code: 'IT0017', title: 'DISCRETE MATHEMATICS' },
    { code: 'IT0019', title: 'QUANTITATIVE METHODS INCL MODELING AND SIMULATION' },
    { code: 'IT0021', title: 'SYSTEM ADMINISTRATION AND MAINTENANCE' },
    { code: 'IT0023', title: 'SYSTEM INTEGRATION AND ARCHITECTURE 1' },
    { code: 'IT0025', title: 'SOCIAL AND PROFESSIONAL ISSUES' },
    { code: 'IT0027', title: 'COURSE CODE PRESENT IN CURRICULUM (TITLE NOT FOUND IN SOURCE)' },
    { code: 'IT0031', title: 'INTERNSHIP 1' },
    { code: 'IT0033', title: 'INTERNSHIP 2 520 HOURS' },
    { code: 'IT0035', title: 'APPLIED OPERATING SYSTEM' },
    { code: 'IT0035L', title: 'APPLIED OPERATING SYSTEM LAB' },
    { code: 'IT0037', title: 'SYSTEM ANALYSIS AND DESIGN' },
    { code: 'IT0039', title: 'IT PROJECT MANAGEMENT' },
    { code: 'IT0041', title: 'E-COMMERCE WITH DIGITAL MARKETING' },
    { code: 'IT0043', title: 'WEB DESIGN WITH CLIENT SIDE SCRIPTING' },
    { code: 'IT0043L', title: 'WEB DESIGN WITH CLIENT SIDE SCRIPTING LAB' },
    { code: 'IT0047', title: 'IT ELECTIVE - COMPUTER SYSTEMS AND PLATFORM TECHNOLOGIES' },
    { code: 'IT0049', title: 'IT ELECTIVE  - WEB SYSTEM TECHNOLOGIES' },
    { code: 'IT0051', title: 'IT ELECTIVE -  HUMAN COMPUTER INTERACTION 2' },
    { code: 'IT0053', title: 'IT ELECTIVE - EMERGING TECHNOLOGIES IN COMPUTING' },
    { code: 'IT0057', title: 'IT ELECTIVE 6 - CERTIFICATION EXAM' },
    { code: 'IT0103', title: 'IT SPECIALIZATION 8    -  NETWORKING 3' },
    { code: 'IT0119', title: 'INFORMATION MANAGEMENT' },
    { code: 'IT0119L', title: 'INFORMATION MANAGEMENT LAB' },
    { code: 'IT0125', title: 'INFORMATION ASSURANCE & SECURITY 1' },
    { code: 'IT0129', title: 'IT ELECTIVE - SYSTEM INTEGRATION & ARCHITECTURE 2' },
    { code: 'IT0200', title: 'IT SPECIALIZATION 3 - NETWORK DEFENSE ESSENTIALS' },
    { code: 'IT0201', title: 'IT SPECIALIZATION 4 - INTRODUCTION TO CYBERSECURITY AND CYBERSECURITY ESSENTIALS' },
    { code: 'IT0202', title: 'IT SPECIALIZATION 5 - ETHICAL HACKING ESSENTIALS' },
    { code: 'IT0203', title: 'IT SPECIALIZATION 6 - DIGITAL FORENSICS ESSENTIALS' },
    { code: 'IT0204', title: 'IT SPECIALIZATION 7 - CYBERSECURITY AND PRIVACY:  LAWS, POLICIES, AND COMPLIANCE' },
    { code: 'IT0205', title: 'IT SPECIALIZATION 9 - CLOUD SECURITY' },
    { code: 'IT0207', title: 'CAPSTONE PROJECT 1 CST' },
    { code: 'IT0209', title: 'CAPSTONE PROJECT 2 CST' }
];

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
const jsonDropZone = document.getElementById('json-drop-zone');
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
const editCancelBtn = document.getElementById('edit-cancel-btn');

const DAY_OPTIONS = [
    { value: '0', label: 'Monday' },
    { value: '1', label: 'Tuesday' },
    { value: '2', label: 'Wednesday' },
    { value: '3', label: 'Thursday' },
    { value: '4', label: 'Friday' },
    { value: '5', label: 'Saturday' }
];

let mobileViewMode = 'plotter';

function createIconMarkup(iconName) {
    return `<span class="iconify label-icon" data-icon="${iconName}" aria-hidden="true"></span>`;
}

function getRingClass(colorClass) {
    const hue = String(colorClass || '').replace(/^bg-/, '').replace(/-\d+$/, '');
    return hue ? `ring-${hue}-400` : 'ring-emerald-400';
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
}

function normalizeDroppedFiles(fileList) {
    return Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json');
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
    mobilePreviewModal.classList.add('hidden');
    mobilePreviewContainer.innerHTML = '';
    document.body.style.overflow = '';
}

function openMobileFullPreview() {
    if (!mobilePreviewModal || !mobilePreviewContainer || !timetableExportArea) {
        return;
    }

    mobilePreviewContainer.innerHTML = '';
    const previewClone = timetableExportArea.cloneNode(true);
    previewClone.removeAttribute('id');
    previewClone.classList.remove('custom-scrollbar');
    previewClone.style.minHeight = '100%';
    previewClone.style.overflow = 'auto';
    previewClone.style.borderRadius = '0.65rem';
    mobilePreviewContainer.appendChild(previewClone);
    mobilePreviewModal.classList.remove('hidden');
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
    const bodyHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR;
    const totalHeight = HEADER_HEIGHT_PX + bodyHeight;

    if (timetableExportArea) {
        timetableExportArea.style.setProperty('--hour-row-height', `${PIXELS_PER_HOUR}px`);
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

function addSecondaryDayDropdown(selectedValue = '0') {
    const row = document.createElement('div');
    row.className = 'secondary-day-row';
    row.innerHTML = `
        <select class="field-input secondary-day-select" aria-label="Secondary day">
            ${buildDayOptionsMarkup(selectedValue)}
        </select>
        <button type="button" class="remove-secondary-day-btn" aria-label="Remove secondary day">−</button>
    `;

    const removeBtn = row.querySelector('.remove-secondary-day-btn');
    removeBtn.addEventListener('click', () => {
        row.remove();
    });

    secondaryDaysContainer.appendChild(row);
}

function getSelectedDays() {
    const primaryDay = Number.parseInt(document.getElementById('course-day').value, 10);
    const secondaryDays = Array.from(secondaryDaysContainer.querySelectorAll('.secondary-day-select'))
        .map((selectEl) => Number.parseInt(selectEl.value, 10))
        .filter((value) => Number.isInteger(value));

    return Array.from(new Set([primaryDay, ...secondaryDays]));
}

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
    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editingIndex = null;
    editModal.classList.add('hidden');
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

function loadSelectedSchedule() {
    const selected = getActiveSchedule();
    if (!selected) {
        setStatus('Select a saved schedule first.', 'error');
        return;
    }

    if (hasUnsavedChanges()) {
        const ok = confirm('You have unsaved plotted changes. Replace current schedule with selected one?');
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

function deleteSelectedSchedule() {
    const selected = getActiveSchedule();
    if (!selected) {
        setStatus('Select a saved schedule to delete.', 'error');
        return;
    }

    if (!confirm(`Delete ${selected.name} from the in-app saved list?`)) {
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
        alert('Loaded your JSON file, scroll down to load and manage.');
        return;
    }

    if (encounteredInvalidJson) {
        setStatus('Invalid JSON file.', 'error');
    }
}

async function exportCurrentTimetablePng() {
    if (classes.length === 0) {
        setStatus('Plot classes first before exporting PNG.', 'error');
        return;
    }

    const timetableCanvas = document.querySelector('#timetable-export-area .timetable-canvas');
    if (!timetableCanvas) {
        setStatus('PNG export failed: timetable area not found.', 'error');
        return;
    }

    const defaultName = getActiveSchedule()?.name || scheduleNameInput.value.trim() || 'Schedule';
    const promptName = window.prompt('Enter Schedule Name for export:', defaultName);
    if (promptName === null) {
        setStatus('PNG export canceled.', 'info');
        return;
    }

    const nameBase = promptName.trim() || defaultName;
    const safeName = slugify(nameBase) || 'schedule';
    const stamp = formatTimestamp();
    const exportTitle = nameBase;
    const exportWatermark = 'Schedule Creator Tool by Ken';

    let exportClone = null;

    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        const baseWidth = Math.ceil(timetableCanvas.getBoundingClientRect().width || timetableCanvas.scrollWidth || 900);
        const baseHeight = Math.ceil(timetableCanvas.getBoundingClientRect().height || timetableCanvas.scrollHeight || 940);
        const baseAxisWidth = 80;
        const baseHeaderHeight = HEADER_HEIGHT_PX;

        const horizontalStretch = 1;
        // Keep export geometry deterministic and isolated from responsive live view rules.
        const exportRowHeight = PIXELS_PER_HOUR;

        const exportWidth = Math.max(Math.round(baseWidth * horizontalStretch), 1220);
        const exportHeaderHeight = Math.max(40, Math.round(baseHeaderHeight * 1.05));
        const exportAxisWidth = Math.max(86, Math.round(baseAxisWidth * 1.1));
        const exportBodyHeight = Math.max(1, (END_HOUR - START_HOUR) * exportRowHeight);
        const exportHeight = exportHeaderHeight + exportBodyHeight;

        exportClone = timetableCanvas.cloneNode(true);
        exportClone.style.position = 'fixed';
        exportClone.style.left = '-20000px';
        exportClone.style.top = '0';
        exportClone.style.zIndex = '-1';
        exportClone.style.width = `${exportWidth}px`;
        exportClone.style.minWidth = `${exportWidth}px`;
        exportClone.style.height = `${exportHeight}px`;
        exportClone.style.background = '#1e293b';
        exportClone.style.overflow = 'hidden';
        exportClone.setAttribute('data-export', 'true');

        const daysHeader = exportClone.querySelector('.days-header');
        const timeAxisWrap = exportClone.querySelector('.time-axis-wrap');
        const gridLayer = exportClone.querySelector('.grid-layer');
        const dayDividers = exportClone.querySelector('.day-dividers');
        const blocksLayer = exportClone.querySelector('#blocks-container');
        const timeAxisClone = exportClone.querySelector('#time-axis');

        if (daysHeader) {
            daysHeader.style.left = `${exportAxisWidth}px`;
            daysHeader.style.height = `${exportHeaderHeight}px`;
        }

        if (timeAxisWrap) {
            timeAxisWrap.style.top = `${exportHeaderHeight}px`;
            timeAxisWrap.style.width = `${exportAxisWidth}px`;
            timeAxisWrap.style.height = `${exportBodyHeight}px`;
        }

        [gridLayer, dayDividers, blocksLayer].forEach((layer) => {
            if (!layer) {
                return;
            }
            layer.style.top = `${exportHeaderHeight}px`;
            layer.style.left = `${exportAxisWidth}px`;
            layer.style.width = `${exportWidth - exportAxisWidth}px`;
            layer.style.height = `${exportBodyHeight}px`;
            layer.style.right = 'auto';
            layer.style.bottom = 'auto';
        });

        if (gridLayer) {
            gridLayer.style.backgroundSize = `100% ${exportRowHeight}px`;
        }

        if (timeAxisClone) {
            Array.from(timeAxisClone.children).forEach((row) => {
                row.style.height = `${exportRowHeight}px`;
            });
        }

        if (blocksLayer) {
            const parsePx = (value) => {
                const parsed = Number.parseFloat(String(value || '0').replace('px', ''));
                return Number.isFinite(parsed) ? parsed : 0;
            };

            Array.from(blocksLayer.children).forEach((block) => {
                const topPx = parsePx(block.style.top);
                const heightPx = parsePx(block.style.height);
                const exportHeightPx = Math.max(1, Math.round(heightPx));
                const exportTopPx = Math.round(topPx);

                block.style.top = `${exportTopPx}px`;
                block.style.height = `${exportHeightPx}px`;
                block.style.padding = '0.55rem';
                block.style.overflow = 'visible';

                // Export-only: remove live preview truncation so text uses available block space.
                const codeEl = block.querySelector('.schedule-block-code');
                const titleEl = block.querySelector('.schedule-block-title');
                const metaEl = block.querySelector('.schedule-block-meta');
                const tagsWrap = block.querySelector('.schedule-block-tags');
                const tagEls = block.querySelectorAll('.schedule-tag');

                if (codeEl) {
                    codeEl.classList.remove('truncate');
                    codeEl.style.whiteSpace = 'normal';
                    codeEl.style.overflow = 'visible';
                    codeEl.style.textOverflow = 'clip';
                    codeEl.style.lineHeight = '1.2';
                    codeEl.style.fontSize = '0.82rem';
                }

                if (titleEl) {
                    titleEl.classList.remove('truncate');
                    titleEl.classList.remove('wrap');
                    titleEl.style.display = 'block';
                    titleEl.style.whiteSpace = 'normal';
                    titleEl.style.overflow = 'visible';
                    titleEl.style.textOverflow = 'clip';
                    titleEl.style.webkitLineClamp = 'unset';
                    titleEl.style.lineClamp = 'unset';
                    titleEl.style.webkitBoxOrient = 'unset';
                    titleEl.style.lineHeight = '1.24';
                    titleEl.style.fontSize = '0.68rem';
                }

                if (metaEl) {
                    metaEl.style.whiteSpace = 'normal';
                    metaEl.style.overflow = 'visible';
                    metaEl.style.textOverflow = 'clip';
                    metaEl.style.fontSize = '0.66rem';
                }

                if (tagsWrap) {
                    tagsWrap.style.overflow = 'visible';
                    tagsWrap.style.rowGap = '0.22rem';
                }

                tagEls.forEach((tagEl) => {
                    tagEl.style.display = 'inline-flex';
                    tagEl.style.boxSizing = 'border-box';
                    tagEl.style.alignItems = 'center';
                    tagEl.style.justifyContent = 'center';
                    tagEl.style.verticalAlign = 'middle';
                    tagEl.style.height = 'auto';
                    tagEl.style.minHeight = '1.48rem';
                    tagEl.style.padding = '0.18rem 0.45rem';
                    tagEl.style.lineHeight = '1';
                    tagEl.style.fontSize = '0.58rem';
                    tagEl.style.transform = 'none';
                    tagEl.style.maxWidth = 'none';
                    tagEl.style.whiteSpace = 'nowrap';
                    tagEl.style.overflow = 'visible';
                    tagEl.style.textOverflow = 'clip';
                });
            });
        }

        document.body.appendChild(exportClone);

        const sourceCanvas = await window.html2canvas(exportClone, {
            scale: EXPORT_CAPTURE_SCALE_BASE * EXPORT_PNG_SCALE,
            useCORS: true,
            backgroundColor: '#1e293b',
            width: exportWidth,
            height: exportHeight,
            windowWidth: exportWidth,
            windowHeight: exportHeight,
            scrollX: 0,
            scrollY: 0
        });

        const titleStripHeight = Math.max(56, Math.round(sourceCanvas.height * 0.07));
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = sourceCanvas.width;
        outputCanvas.height = sourceCanvas.height + titleStripHeight;

        const ctx = outputCanvas.getContext('2d');
        if (!ctx) {
            setStatus('PNG export failed: unable to prepare image context.', 'error');
            return;
        }

        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

        const watermarkFontPx = Math.max(13, Math.min(20, Math.round(sourceCanvas.width * 0.013)));
        ctx.fillStyle = 'rgba(203, 213, 225, 0.58)';
        ctx.font = `600 ${watermarkFontPx}px "Open Sans", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(exportWatermark, 16, Math.round(titleStripHeight / 2));

        let titleFontPx = Math.max(24, Math.min(54, Math.round(sourceCanvas.width * 0.034)));
        const titleMaxWidth = sourceCanvas.width * 0.62;
        do {
            ctx.font = `800 ${titleFontPx}px "Open Sans", Arial, sans-serif`;
            if (ctx.measureText(exportTitle).width <= titleMaxWidth || titleFontPx <= 18) {
                break;
            }
            titleFontPx -= 1;
        } while (titleFontPx > 18);

        ctx.fillStyle = '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.fillText(exportTitle, Math.round(outputCanvas.width / 2), Math.round(titleStripHeight / 2));

        ctx.drawImage(sourceCanvas, 0, titleStripHeight);

        outputCanvas.toBlob((blob) => {
            if (!blob) {
                setStatus('PNG export failed to generate image data.', 'error');
                return;
            }
            triggerDownload(`${safeName}-${stamp}.png`, blob, 'image/png');
            setStatus(`PNG exported for ${nameBase}.`, 'success');
        }, 'image/png');
    } catch (error) {
        setStatus(`PNG export failed: ${error.message}`, 'error');
    } finally {
        if (exportClone && exportClone.parentNode) {
            exportClone.parentNode.removeChild(exportClone);
        }
    }
}

colorBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        colorBtns.forEach((b) => {
            b.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-slate-800');
            b.classList.add('opacity-50');
            b.className = b.className.replace(/ring-\w+-400/g, '');
        });

        const pickedBtn = e.target;
        selectedColor = pickedBtn.dataset.color;
        pickedBtn.classList.remove('opacity-50');

        const colorName = selectedColor.split('-')[1];
        pickedBtn.classList.add('ring-2', 'ring-offset-2', 'ring-offset-slate-800', `ring-${colorName}-400`);
    });
});

function initTimeAxis() {
    let html = '';
    for (let i = START_HOUR; i < END_HOUR; i++) {
        const isPM = i >= 12;
        const displayHour12 = i > 12 ? i - 12 : i;
        const ampm = isPM ? 'PM' : 'AM';
        const displayHour24 = i.toString().padStart(2, '0') + ':00';

        html += `<div class="relative" style="height:${PIXELS_PER_HOUR}px;">
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
    return totalHoursFromStart * PIXELS_PER_HOUR;
}

function renderSchedule() {
    container.innerHTML = '';

    classes.forEach((c, index) => {
        const topPx = timeToPixels(c.start);
        const bottomPx = timeToPixels(c.end);
        const heightPx = bottomPx - topPx;
        const isSmallCell = heightPx <= 72;
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

        container.appendChild(block);
    });

    countDisplay.innerText = classes.length;
    localStorage.setItem('feu_schedule', JSON.stringify(classes));
    syncActionStates();
}

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('course-name').value;
    const selectedDays = getSelectedDays();
    const start = document.getElementById('course-start').value;
    const end = document.getElementById('course-end').value;
    const room = document.getElementById('course-room').value;
    const section = courseSectionInput.value;

    if (selectedDays.length === 0) {
        alert('Pick at least one day.');
        return;
    }

    if (timeToPixels(start) >= timeToPixels(end)) {
        alert('Time glitch: Start time must be before End time.');
        return;
    }

    const hasAnyConflict = selectedDays.some((day) => Boolean(hasConflict(day, start, end)));
    if (hasAnyConflict) {
        if (!confirm('Wait up! One or more selected days overlap with existing classes. Do you still want to plot all selected days?')) {
            return;
        }
    }

    selectedDays.forEach((day) => {
        classes.push({ name, day, start, end, room, section, color: selectedColor });
    });
    renderSchedule();

    document.getElementById('course-name').value = '';
    document.getElementById('course-room').value = '';
    courseSectionInput.value = '';
    document.getElementById('course-name').focus();
});

editForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (editingIndex === null || !classes[editingIndex]) {
        closeEditModal();
        return;
    }

    const name = editCourseName.value.trim();
    const day = Number.parseInt(editCourseDay.value, 10);
    const start = editCourseStart.value.trim();
    const end = editCourseEnd.value.trim();
    const room = editCourseRoom.value.trim();
    const section = editCourseSection.value.trim();

    if (!name) {
        alert('Subject is required.');
        return;
    }
    if (!isValidTime(start) || !isValidTime(end) || timeToPixels(start) >= timeToPixels(end)) {
        alert('Time glitch: Start time must be before End time.');
        return;
    }

    const conflict = hasConflict(day, start, end, editingIndex);
    if (conflict) {
        if (!confirm(`Wait up! This overlaps with ${conflict.name}. Do you still want to save?`)) {
            return;
        }
    }

    classes[editingIndex] = {
        ...classes[editingIndex],
        name,
        day,
        start,
        end,
        room,
        section
    };

    closeEditModal();
    renderSchedule();
    setStatus('Plotted class updated.', 'success');
});

editCancelBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeEditModal();
    }
});

addSecondaryDayBtn.addEventListener('click', () => {
    addSecondaryDayDropdown();
});

window.removeClass = (index) => {
    classes.splice(index, 1);
    renderSchedule();
};
window.openEditModal = openEditModal;

document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Nuke the entire schedule?')) {
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
exportPngBtn.addEventListener('click', exportCurrentTimetablePng);

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

mobilePreviewModal?.addEventListener('click', (event) => {
    if (event.target === mobilePreviewModal) {
        closeMobileFullPreview();
    }
});

window.addEventListener('resize', () => {
    applyLiveTimetableMetrics();
    syncMobileLayoutState();
});

initTimeAxis();
applyLiveTimetableMetrics();
populateSubjectOptions();
renderSavedSchedulesList();
syncColorButtons();
syncMobileLayoutState();
setStatus('Tip: Save snapshots as JSON, then load them back anytime.');
wireDropImport();
renderSchedule();
