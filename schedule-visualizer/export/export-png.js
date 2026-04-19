import { toCanvas } from 'html-to-image';

const START_HOUR = 7;
const END_HOUR = 22;
const LIVE_ROW_HEIGHT_PIXELS = 84;
const HEADER_HEIGHT_PIXELS = 40;
const EXPORT_CAPTURE_PIXEL_RATIO = 2;
const EXPORT_STYLE_ELEMENT_ID = 'schedule-export-fallback-style';

const EXPORT_SIZE_PRESETS = {
    desktop: {
        minimumWidth: 1220,
        rowHeightPixels: 90,
        horizontalStretch: 1
    },
    tablet: {
        minimumWidth: 1024,
        rowHeightPixels: 88,
        horizontalStretch: 0.93
    },
    mobile: {
        minimumWidth: 760,
        rowHeightPixels: 86,
        horizontalStretch: 0.88
    }
};

const EXPORT_BLOCK_BACKGROUND_BY_TAILWIND_CLASS = {
    'bg-emerald-600': '#059669',
    'bg-cyan-600': '#0891b2',
    'bg-indigo-600': '#4f46e5',
    'bg-purple-600': '#9333ea',
    'bg-rose-600': '#e11d48',
    'bg-amber-600': '#d97706',
    'bg-sky-600': '#0284c7',
    'bg-lime-600': '#65a30d',
    'bg-pink-600': '#db2777',
    'bg-teal-600': '#0d9488'
};

function getPresetConfig(sizePreset) {
    return EXPORT_SIZE_PRESETS[sizePreset] || EXPORT_SIZE_PRESETS.desktop;
}

function parseCssPixels(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const rawText = String(value ?? '').trim();
    if (!rawText) {
        return fallback;
    }

    const numericMatch = rawText.match(/-?\d+(?:\.\d+)?/);
    if (!numericMatch) {
        return fallback;
    }

    const parsed = Number.parseFloat(numericMatch[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getExportBackgroundColor(classNameText) {
    const classNames = String(classNameText || '').split(/\s+/).filter(Boolean);
    const backgroundClass = classNames.find((className) => className.startsWith('bg-'));
    return EXPORT_BLOCK_BACKGROUND_BY_TAILWIND_CLASS[backgroundClass] || '#334155';
}

function injectExportFallbackStyles(exportClone) {
    if (!exportClone || exportClone.querySelector(`#${EXPORT_STYLE_ELEMENT_ID}`)) {
        return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = EXPORT_STYLE_ELEMENT_ID;
    styleElement.textContent = `
        .timetable-canvas {
            position: relative;
            min-width: 700px;
            overflow: hidden;
            background: #1e293b;
            font-family: 'Open Sans', Arial, sans-serif;
        }
        .days-header {
            position: absolute;
            top: 0;
            left: 5rem;
            right: 0;
            height: 2.5rem;
            display: flex;
            border-bottom: 1px solid #334155;
            background: rgba(30, 41, 59, 0.92);
            z-index: 20;
        }
        .day-cell {
            flex: 1;
            text-align: center;
            padding: 0.5rem 0;
            font-size: 0.85rem;
            font-weight: 700;
            color: #cbd5e1;
        }
        .day-cell-border { border-right: 1px solid rgba(51, 65, 85, 0.7); }
        .time-axis-wrap {
            position: absolute;
            top: 2.5rem;
            left: 0;
            width: 5rem;
            bottom: 0;
            border-right: 1px solid #334155;
            background: rgba(30, 41, 59, 0.5);
            z-index: 10;
        }
        .grid-layer {
            position: absolute;
            top: 2.5rem;
            left: 5rem;
            right: 0;
            bottom: 0;
            opacity: 0.3;
            z-index: 0;
        }
        .day-dividers {
            position: absolute;
            top: 2.5rem;
            left: 5rem;
            right: 0;
            bottom: 0;
            display: flex;
            z-index: 0;
        }
        .day-divider { flex: 1; border-right: 1px solid rgba(51, 65, 85, 0.45); }
        .day-divider:last-child { border-right: none; }
        .blocks-layer {
            position: absolute;
            top: 2.5rem;
            left: 5rem;
            right: 0;
            bottom: 0;
            z-index: 10;
        }
        #time-axis { width: 100%; height: 100%; }
        #time-axis > * {
            display: flex;
            align-items: flex-start;
            justify-content: flex-end;
            padding: 0.5rem 0.5rem 0 0;
            font-size: 0.65rem;
            color: #94a3b8;
            box-sizing: border-box;
        }
        .schedule-block {
            position: absolute;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            overflow: hidden;
            padding: 0.55rem;
            border-radius: 0.5rem;
            color: #f8fafc;
        }
    `;

    exportClone.prepend(styleElement);
}

function buildExportClone(timetableCanvas, presetConfig) {
    const baseWidth = Math.ceil(timetableCanvas.getBoundingClientRect().width || timetableCanvas.scrollWidth || 900);
    const baseAxisWidth = 80;

    const exportRowHeight = presetConfig.rowHeightPixels;
    const exportScaleRatio = exportRowHeight / LIVE_ROW_HEIGHT_PIXELS;

    const exportWidth = Math.max(
        Math.round(baseWidth * presetConfig.horizontalStretch),
        presetConfig.minimumWidth
    );
    const exportHeaderHeight = Math.max(40, Math.round(HEADER_HEIGHT_PIXELS * 1.05));
    const exportAxisWidth = Math.max(86, Math.round(baseAxisWidth * 1.1));
    const exportBodyHeight = Math.max(1, (END_HOUR - START_HOUR) * exportRowHeight);
    const exportHeight = exportHeaderHeight + exportBodyHeight;

    const exportClone = timetableCanvas.cloneNode(true);
    exportClone.style.width = `${exportWidth}px`;
    exportClone.style.minWidth = `${exportWidth}px`;
    exportClone.style.height = `${exportHeight}px`;
    exportClone.style.background = '#1e293b';
    exportClone.style.overflow = 'hidden';
    exportClone.style.position = 'relative';
    exportClone.setAttribute('data-export', 'true');

    injectExportFallbackStyles(exportClone);

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
        timeAxisWrap.style.bottom = 'auto';
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
        Array.from(blocksLayer.children).forEach((block) => {
            const topPixels = parseCssPixels(block.style.top);
            const heightPixels = parseCssPixels(block.style.height);
            const adjustedHeight = Math.max(1, Math.round(heightPixels * exportScaleRatio));
            const adjustedTop = Math.round(topPixels * exportScaleRatio);

            block.style.transform = 'none';
            block.style.filter = 'none';
            block.style.boxShadow = 'none';
            block.style.top = `${adjustedTop}px`;
            block.style.height = `${adjustedHeight}px`;
            block.style.padding = '0.55rem';
            block.style.overflow = 'hidden';
            block.style.backgroundImage = 'none';
            block.style.backgroundColor = getExportBackgroundColor(block.className);
            block.style.color = '#f8fafc';
            block.style.border = '1px solid rgba(255, 255, 255, 0.12)';
            block.style.borderRadius = '0.5rem';

            const codeElement = block.querySelector('.schedule-block-code');
            const titleElement = block.querySelector('.schedule-block-title');
            const metadataElement = block.querySelector('.schedule-block-meta');
            const tagsWrap = block.querySelector('.schedule-block-tags');
            const tagElements = block.querySelectorAll('.schedule-tag');

            if (codeElement) {
                codeElement.classList.remove('truncate');
                codeElement.style.whiteSpace = 'normal';
                codeElement.style.overflow = 'visible';
                codeElement.style.textOverflow = 'clip';
                codeElement.style.lineHeight = '1.2';
                codeElement.style.fontSize = '0.82rem';
            }

            if (titleElement) {
                titleElement.classList.remove('truncate');
                titleElement.classList.remove('wrap');
                titleElement.style.display = 'block';
                titleElement.style.whiteSpace = 'normal';
                titleElement.style.overflow = 'visible';
                titleElement.style.textOverflow = 'clip';
                titleElement.style.webkitLineClamp = 'unset';
                titleElement.style.lineClamp = 'unset';
                titleElement.style.webkitBoxOrient = 'unset';
                titleElement.style.lineHeight = '1.24';
                titleElement.style.fontSize = '0.68rem';
            }

            if (metadataElement) {
                metadataElement.style.whiteSpace = 'normal';
                metadataElement.style.overflow = 'visible';
                metadataElement.style.textOverflow = 'clip';
                metadataElement.style.fontSize = '0.66rem';
            }

            if (tagsWrap) {
                tagsWrap.style.overflow = 'visible';
                tagsWrap.style.rowGap = '0.22rem';
            }

            tagElements.forEach((tagElement) => {
                tagElement.style.display = 'inline-flex';
                tagElement.style.boxSizing = 'border-box';
                tagElement.style.alignItems = 'center';
                tagElement.style.justifyContent = 'center';
                tagElement.style.verticalAlign = 'middle';
                tagElement.style.height = 'auto';
                tagElement.style.minHeight = '1.48rem';
                tagElement.style.padding = '0.18rem 0.45rem';
                tagElement.style.lineHeight = '1';
                tagElement.style.fontSize = '0.58rem';
                tagElement.style.transform = 'none';
                tagElement.style.maxWidth = 'none';
                tagElement.style.whiteSpace = 'nowrap';
                tagElement.style.overflow = 'visible';
                tagElement.style.textOverflow = 'clip';
            });
        });
    }

    const offscreenHost = document.createElement('div');
    offscreenHost.style.position = 'fixed';
    offscreenHost.style.left = '-20000px';
    offscreenHost.style.top = '0';
    offscreenHost.style.width = `${exportWidth}px`;
    offscreenHost.style.height = `${exportHeight}px`;
    offscreenHost.style.overflow = 'hidden';
    offscreenHost.style.pointerEvents = 'none';
    offscreenHost.style.zIndex = '-1';
    offscreenHost.appendChild(exportClone);

    return {
        offscreenHost,
        exportClone,
        exportWidth,
        exportHeight
    };
}

function drawTitleStrip(sourceCanvas, exportTitle, includeWatermark, watermarkText) {
    const titleStripHeight = Math.max(56, Math.round(sourceCanvas.height * 0.07));
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height + titleStripHeight;

    const drawingContext = outputCanvas.getContext('2d');
    if (!drawingContext) {
        throw new Error('Unable to prepare image context.');
    }

    drawingContext.fillStyle = '#0b1220';
    drawingContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    if (includeWatermark) {
        const watermarkFontPixels = Math.max(13, Math.min(20, Math.round(sourceCanvas.width * 0.013)));
        drawingContext.fillStyle = 'rgba(203, 213, 225, 0.58)';
        drawingContext.font = `600 ${watermarkFontPixels}px "Open Sans", Arial, sans-serif`;
        drawingContext.textAlign = 'left';
        drawingContext.textBaseline = 'middle';
        drawingContext.fillText(watermarkText, 16, Math.round(titleStripHeight / 2));
    }

    let titleFontPixels = Math.max(24, Math.min(54, Math.round(sourceCanvas.width * 0.034)));
    const titleMaxWidth = sourceCanvas.width * 0.62;

    while (titleFontPixels > 18) {
        drawingContext.font = `800 ${titleFontPixels}px "Open Sans", Arial, sans-serif`;
        if (drawingContext.measureText(exportTitle).width <= titleMaxWidth) {
            break;
        }
        titleFontPixels -= 1;
    }

    drawingContext.fillStyle = '#f1f5f9';
    drawingContext.textAlign = 'center';
    drawingContext.textBaseline = 'middle';
    drawingContext.fillText(exportTitle, Math.round(outputCanvas.width / 2), Math.round(titleStripHeight / 2));

    drawingContext.drawImage(sourceCanvas, 0, titleStripHeight);

    return outputCanvas;
}

function canvasToBlob(canvasElement, mimeType) {
    return new Promise((resolve) => {
        canvasElement.toBlob((blob) => resolve(blob), mimeType);
    });
}

export async function exportScheduleAsPng({
    classes,
    timetableExportArea,
    exportName,
    sizePreset,
    watermarkText,
    setStatus,
    slugify,
    formatTimestamp,
    triggerDownload
}) {
    if (!Array.isArray(classes) || classes.length === 0) {
        setStatus('Plot classes first before exporting PNG.', 'error');
        return false;
    }

    const timetableCanvas = timetableExportArea?.querySelector('.timetable-canvas');
    if (!timetableCanvas) {
        setStatus('PNG export failed: timetable area not found.', 'error');
        return false;
    }

    const nameBase = String(exportName || '').trim() || 'Schedule';
    const safeName = slugify(nameBase) || 'schedule';
    const stamp = formatTimestamp();

    let offscreenHost = null;

    try {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        const presetConfig = getPresetConfig(sizePreset);
        const preparedClone = buildExportClone(timetableCanvas, presetConfig);
        offscreenHost = preparedClone.offscreenHost;
        document.body.appendChild(offscreenHost);

        const sourceCanvas = await toCanvas(preparedClone.exportClone, {
            cacheBust: true,
            pixelRatio: EXPORT_CAPTURE_PIXEL_RATIO,
            backgroundColor: '#1e293b',
            width: preparedClone.exportWidth,
            height: preparedClone.exportHeight,
            canvasWidth: preparedClone.exportWidth,
            canvasHeight: preparedClone.exportHeight
        });

        const outputCanvas = drawTitleStrip(
            sourceCanvas,
            nameBase,
            true,
            watermarkText
        );

        const blob = await canvasToBlob(outputCanvas, 'image/png');
        if (!blob) {
            setStatus('PNG export failed to generate image data.', 'error');
            return false;
        }

        triggerDownload(`${safeName}-${stamp}.png`, blob, 'image/png');
        setStatus(`PNG exported for ${nameBase}.`, 'success');
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown export error.';
        setStatus(`PNG export failed: ${message}`, 'error');
        return false;
    } finally {
        offscreenHost?.remove();
    }
}
