import mermaid from 'mermaid';

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

let scale = 1;
let pointX = 0;
let pointY = 0;
let startX = 0;
let startY = 0;
let panning = false;

const dropzone = document.getElementById('dropzone');
const wrapper = document.getElementById('graph-wrapper');
const container = document.getElementById('graph-container');
const controls = document.getElementById('controls');
const copyBtn = document.getElementById('copy-btn');
const resetBtn = document.getElementById('reset-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');
const fullViewBtn = document.getElementById('full-view-btn');
const fullViewCloseBtn = document.getElementById('full-view-close');
let isFullView = false;

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

async function parseAndRender(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let codeIdx = 0;
    let titleIdx = 1;
    let prereqIdx = 4;

    const headers = Array.from(doc.querySelectorAll('th')).map((th) => th.innerText.trim().toUpperCase());
    headers.forEach((header, idx) => {
        if (header.includes('CODE')) {
            codeIdx = idx;
        }
        if (header.includes('TITLE') || header.includes('DESCRIPTION')) {
            titleIdx = idx;
        }
        if (header.includes('PRE-REQUISITE') || header.includes('PREREQUISITE')) {
            prereqIdx = idx;
        }
    });

    const courses = [];
    const rows = Array.from(doc.querySelectorAll('tr'));

    rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) => td.innerText.trim());
        if (cells.length > Math.max(codeIdx, titleIdx, prereqIdx)) {
            const code = cells[codeIdx];
            const title = cells[titleIdx];
            const prereqsRaw = cells[prereqIdx];

            if (/^[A-Z]{2,4}\s*\d{2,4}[A-Z]?$/.test(code)) {
                const cleanCode = code.replace(/\s+/g, '');
                const prereqMatches = prereqsRaw.match(/[A-Z]{2,4}\s*\d{2,4}[A-Z]?/g);
                const prereqs = prereqMatches ? prereqMatches.map((p) => p.replace(/\s+/g, '')) : [];
                courses.push({ code: cleanCode, title, prereqs });
            }
        }
    });

    if (courses.length === 0) {
        container.innerHTML = '<p class="status-message status-message--error">Error: Couldn\'t extract course data. Ensure this is a valid portal HTML/MHTML export.</p>';
        return;
    }

    let mermaidCode = 'graph LR\n';
    mermaidCode += 'classDef default fill:#1e293b,stroke:#334155,stroke-width:2px,color:#f8fafc,rx:8,ry:8;\n';

    courses.forEach((c) => {
        const safeTitle = c.title.replace(/["\[\]()]/g, '');
        mermaidCode += `${c.code}["${c.code}<br/>${safeTitle}"]\n`;
        c.prereqs.forEach((p) => {
            mermaidCode += `${p} --> ${c.code}\n`;
        });
    });

    mermaidRawCode = mermaidCode;
    controls.classList.remove('is-hidden');
    container.innerHTML = '<p class="status-message status-message--loading">Rendering Skill Tree...</p>';

    try {
        const { svg } = await window.mermaid.render('mermaid-svg', mermaidCode);
        container.innerHTML = svg;
        resetZoom();
    } catch (err) {
        console.error('Mermaid error:', err);
        container.innerHTML = '<p class="status-message status-message--error">Failed to render graph visually. You can still copy the raw code.</p>';
    }
}

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
    wrapper.classList.add('is-panning');
});

wrapper.addEventListener('mouseup', () => {
    panning = false;
    wrapper.classList.remove('is-panning');
});
wrapper.addEventListener('mouseleave', () => {
    panning = false;
    wrapper.classList.remove('is-panning');
});

wrapper.addEventListener('mousemove', (e) => {
    if (!panning || mermaidRawCode === '') {
        return;
    }
    e.preventDefault();
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    setTransform();
});

wrapper.addEventListener('wheel', (e) => {
    if (mermaidRawCode === '') {
        return;
    }
    e.preventDefault();

    const xs = (e.clientX - pointX) / scale;
    const ys = (e.clientY - pointY) / scale;
    const delta = e.deltaY > 0 ? -1 : 1;

    const zoomSpeed = 1.1;
    if (delta > 0) {
        scale *= zoomSpeed;
    } else {
        scale /= zoomSpeed;
    }

    scale = Math.max(0.1, Math.min(scale, 8));

    pointX = e.clientX - xs * scale;
    pointY = e.clientY - ys * scale;

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

copyBtn.addEventListener('click', () => {
    if (!mermaidRawCode) {
        return;
    }

    const el = document.createElement('textarea');
    el.value = mermaidRawCode;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    const originalText = copyBtn.innerText;
    copyBtn.innerText = 'Copied!';
    copyBtn.classList.add('is-success');
    setTimeout(() => {
        copyBtn.innerText = originalText;
        copyBtn.classList.remove('is-success');
    }, 2000);
});

fullViewBtn.addEventListener('click', () => {
    if (!mermaidRawCode) {
        return;
    }

    wrapper.classList.add('is-fullscreen');
    document.body.classList.add('modal-open');
    isFullView = true;
});

function closeFullView() {
    wrapper.classList.remove('is-fullscreen');
    document.body.classList.remove('modal-open');
    isFullView = false;
}

fullViewCloseBtn.addEventListener('click', closeFullView);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullView) {
        closeFullView();
    }
});

resetBtn.addEventListener('click', () => {
    container.innerHTML = '<p id="status-text" class="status-text">Waiting for MHTML file...</p>';
    controls.classList.add('is-hidden');
    mermaidRawCode = '';
    panning = false;
    wrapper.classList.remove('is-panning');
    closeFullView();
    resetZoom();
});
