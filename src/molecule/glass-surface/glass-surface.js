/**
 * GlassSurfaceController
 * Translates React Bits GlassSurface to Vanilla JS.
 * Manages dynamically-generated SVG filters, ResizeObservers, and browser support checks.
 */
export class GlassSurfaceController {
    constructor(element) {
        if (!element) return;
        this.containerElement = element;
        this.uniqueId = `glass-${Math.random().toString(36).substring(2, 9)}`;
        this.filterId = `glass-filter-${this.uniqueId}`;
        this.redGradId = `red-grad-${this.uniqueId}`;
        this.blueGradId = `blue-grad-${this.uniqueId}`;

        this.isDarkMode = false;
        this.svgSupported = false;
        this.resizeObserver = null;
        this.svgElement = null;

        this.feImageElement = null;
        this.displacementMapRed = null;
        this.displacementMapGreen = null;
        this.displacementMapBlue = null;
        this.gaussianBlurElement = null;

        this.config = this.parseConfigAttributes();

        this.init();
    }

    /* Parsing Configurations */
    parseConfigAttributes() {
        const dataset = this.containerElement.dataset;
        return {
            width: dataset.width || '200',
            height: dataset.height || '80',
            borderRadius: parseInt(dataset.borderRadius, 10) ?? 20,
            borderWidth: parseFloat(dataset.borderWidth) ?? 0.07,
            brightness: parseInt(dataset.brightness, 10) ?? 50,
            opacity: parseFloat(dataset.opacity) ?? 0.93,
            blur: parseInt(dataset.blur, 10) ?? 11,
            displace: parseInt(dataset.displace, 10) ?? 0,
            backgroundOpacity: parseFloat(dataset.backgroundOpacity) ?? 0,
            saturation: parseFloat(dataset.saturation) ?? 1.0,
            distortionScale: parseInt(dataset.distortionScale, 10) ?? -180,
            redOffset: parseInt(dataset.redOffset, 10) ?? 0,
            greenOffset: parseInt(dataset.greenOffset, 10) ?? 10,
            blueOffset: parseInt(dataset.blueOffset, 10) ?? 20,
            xChannel: dataset.xChannel || 'R',
            yChannel: dataset.yChannel || 'G',
            mixBlendMode: dataset.mixBlendMode || 'difference'
        };
    }

    /* Core Initialization */
    init() {
        this.detectDarkMode();
        this.checkSvgFilterSupport();
        
        this.buildSvgFilterDOM();
        this.applyContainerDimensions();
        this.applyBaseStyles();

        this.updateDisplacementMap();
        this.setupObservers();
    }

    detectDarkMode() {
        if (typeof window === 'undefined') return;
        this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
            this.isDarkMode = event.matches;
            this.applyBaseStyles();
            this.updateDisplacementMap();
        });
    }

    /* Browser Compatibility Checks */
    checkSvgFilterSupport() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            this.svgSupported = false;
            return;
        }

        const userAgent = navigator.userAgent;
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        const isFirefox = /Firefox/.test(userAgent);

        if (isSafari || isFirefox) {
            this.svgSupported = false;
            return;
        }

        const testingElement = document.createElement('div');
        testingElement.style.backdropFilter = `url(#${this.filterId})`;
        this.svgSupported = testingElement.style.backdropFilter !== '';
    }

    supportsBackdropFilter() {
        if (typeof window === 'undefined') return false;
        return CSS.supports('backdrop-filter', 'blur(10px)') || 
               CSS.supports('-webkit-backdrop-filter', 'blur(10px)');
    }

    /* Build SVG Nodes */
    buildSvgFilterDOM() {
        const svgNamespace = 'http://www.w3.org/2000/svg';
        
        this.svgElement = document.createElementNS(svgNamespace, 'svg');
        this.svgElement.setAttribute('class', 'glass-surface-filter-svg');
        
        const defsElement = document.createElementNS(svgNamespace, 'defs');
        const filterElement = document.createElementNS(svgNamespace, 'filter');
        filterElement.setAttribute('id', this.filterId);
        filterElement.setAttribute('color-interpolation-filters', 'sRGB');
        filterElement.setAttribute('x', '0%');
        filterElement.setAttribute('y', '0%');
        filterElement.setAttribute('width', '100%');
        filterElement.setAttribute('height', '100%');

        this.feImageElement = document.createElementNS(svgNamespace, 'feImage');
        this.feImageElement.setAttribute('x', '0');
        this.feImageElement.setAttribute('y', '0');
        this.feImageElement.setAttribute('width', '100%');
        this.feImageElement.setAttribute('height', '100%');
        this.feImageElement.setAttribute('preserveAspectRatio', 'none');
        this.feImageElement.setAttribute('result', 'map');

        // Red Channel displacement pipeline
        this.displacementMapRed = document.createElementNS(svgNamespace, 'feDisplacementMap');
        this.displacementMapRed.setAttribute('in', 'SourceGraphic');
        this.displacementMapRed.setAttribute('in2', 'map');
        this.displacementMapRed.setAttribute('id', 'redchannel');
        this.displacementMapRed.setAttribute('result', 'dispRed');

        const matrixRed = document.createElementNS(svgNamespace, 'feColorMatrix');
        matrixRed.setAttribute('in', 'dispRed');
        matrixRed.setAttribute('type', 'matrix');
        matrixRed.setAttribute('values', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0');
        matrixRed.setAttribute('result', 'red');

        // Green Channel displacement pipeline
        this.displacementMapGreen = document.createElementNS(svgNamespace, 'feDisplacementMap');
        this.displacementMapGreen.setAttribute('in', 'SourceGraphic');
        this.displacementMapGreen.setAttribute('in2', 'map');
        this.displacementMapGreen.setAttribute('id', 'greenchannel');
        this.displacementMapGreen.setAttribute('result', 'dispGreen');

        const matrixGreen = document.createElementNS(svgNamespace, 'feColorMatrix');
        matrixGreen.setAttribute('in', 'dispGreen');
        matrixGreen.setAttribute('type', 'matrix');
        matrixGreen.setAttribute('values', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0');
        matrixGreen.setAttribute('result', 'green');

        // Blue Channel displacement pipeline
        this.displacementMapBlue = document.createElementNS(svgNamespace, 'feDisplacementMap');
        this.displacementMapBlue.setAttribute('in', 'SourceGraphic');
        this.displacementMapBlue.setAttribute('in2', 'map');
        this.displacementMapBlue.setAttribute('id', 'bluechannel');
        this.displacementMapBlue.setAttribute('result', 'dispBlue');

        const matrixBlue = document.createElementNS(svgNamespace, 'feColorMatrix');
        matrixBlue.setAttribute('in', 'dispBlue');
        matrixBlue.setAttribute('type', 'matrix');
        matrixBlue.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0');
        matrixBlue.setAttribute('result', 'blue');

        // Blend colors together
        const blendRg = document.createElementNS(svgNamespace, 'feBlend');
        blendRg.setAttribute('in', 'red');
        blendRg.setAttribute('in2', 'green');
        blendRg.setAttribute('mode', 'screen');
        blendRg.setAttribute('result', 'rg');

        const blendAll = document.createElementNS(svgNamespace, 'feBlend');
        blendAll.setAttribute('in', 'rg');
        blendAll.setAttribute('in2', 'blue');
        blendAll.setAttribute('mode', 'screen');
        blendAll.setAttribute('result', 'output');

        this.gaussianBlurElement = document.createElementNS(svgNamespace, 'feGaussianBlur');
        this.gaussianBlurElement.setAttribute('in', 'output');

        // Append to definitions block
        filterElement.appendChild(this.feImageElement);
        filterElement.appendChild(this.displacementMapRed);
        filterElement.appendChild(matrixRed);
        filterElement.appendChild(this.displacementMapGreen);
        filterElement.appendChild(matrixGreen);
        filterElement.appendChild(this.displacementMapBlue);
        filterElement.appendChild(matrixBlue);
        filterElement.appendChild(blendRg);
        filterElement.appendChild(blendAll);
        filterElement.appendChild(this.gaussianBlurElement);

        defsElement.appendChild(filterElement);
        this.svgElement.appendChild(defsElement);
        
        this.containerElement.appendChild(this.svgElement);
    }

    applyContainerDimensions() {
        const widthVal = this.config.width;
        const heightVal = this.config.height;

        this.containerElement.style.width = isNaN(widthVal) ? widthVal : `${widthVal}px`;
        this.containerElement.style.height = isNaN(heightVal) ? heightVal : `${heightVal}px`;
        this.containerElement.style.borderRadius = `${this.config.borderRadius}px`;
    }

    /* SVG Map Data URL Generation */
    generateDisplacementMapMarkup() {
        const boundingBox = this.containerElement.getBoundingClientRect();
        const actualWidth = boundingBox.width || 400;
        const actualHeight = boundingBox.height || 200;
        const edgeSize = Math.min(actualWidth, actualHeight) * (this.config.borderWidth * 0.5);

        // SVG containing the specific linear gradients and edge structures
        const svgContent = `
            <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="${this.redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#0000"/>
                        <stop offset="100%" stop-color="red"/>
                    </linearGradient>
                    <linearGradient id="${this.blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#0000"/>
                        <stop offset="100%" stop-color="blue"/>
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
                <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${this.config.borderRadius}" fill="url(#${this.redGradId})" />
                <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${this.config.borderRadius}" fill="url(#${this.blueGradId})" style="mix-blend-mode: ${this.config.mixBlendMode}" />
                <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${this.config.borderRadius}" fill="hsl(0 0% ${this.config.brightness}% / ${this.config.opacity})" style="filter:blur(${this.config.blur}px)" />
            </svg>
        `;

        return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    }

    /* Apply Filter Parameters */
    updateDisplacementMap() {
        if (this.feImageElement) {
            this.feImageElement.setAttribute('href', this.generateDisplacementMapMarkup());
        }

        const mapConfigurations = [
            { element: this.displacementMapRed, offset: this.config.redOffset },
            { element: this.displacementMapGreen, offset: this.config.greenOffset },
            { element: this.displacementMapBlue, offset: this.config.blueOffset }
        ];

        mapConfigurations.forEach(({ element, offset }) => {
            if (element) {
                const totalScale = this.config.distortionScale + offset;
                element.setAttribute('scale', totalScale.toString());
                element.setAttribute('xChannelSelector', this.config.xChannel);
                element.setAttribute('yChannelSelector', this.config.yChannel);
            }
        });

        if (this.gaussianBlurElement) {
            this.gaussianBlurElement.setAttribute('stdDeviation', this.config.displace.toString());
        }
    }

    setupObservers() {
        if (typeof window === 'undefined') return;

        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => this.updateDisplacementMap());
        });

        this.resizeObserver.observe(this.containerElement);
    }

    /* Apply CSS styles */
    applyBaseStyles() {
        const styles = this.containerElement.style;
        styles.setProperty('--glass-frost', this.config.backgroundOpacity);
        styles.setProperty('--glass-saturation', this.config.saturation);

        const backdropFilterSupported = this.supportsBackdropFilter();

        if (this.svgSupported) {
            styles.background = this.isDarkMode 
                ? `rgba(0, 0, 0, ${this.config.backgroundOpacity})` 
                : `rgba(255, 255, 255, ${this.config.backgroundOpacity})`;
            styles.backdropFilter = `url(#${this.filterId}) saturate(${this.config.saturation})`;
            
            // Outer and inner shadows representing high quality glass borders
            styles.boxShadow = this.isDarkMode
                ? `0 0 2px 1px rgba(255, 255, 255, 0.35) inset,
                   0 0 10px 4px rgba(255, 255, 255, 0.1) inset,
                   0px 4px 16px rgba(17, 17, 26, 0.05),
                   0px 8px 24px rgba(17, 17, 26, 0.05),
                   0px 16px 56px rgba(17, 17, 26, 0.05),
                   0px 4px 16px rgba(17, 17, 26, 0.05) inset`
                : `0 0 2px 1px rgba(0, 0, 0, 0.15) inset,
                   0 0 10px 4px rgba(0, 0, 0, 0.1) inset,
                   0px 4px 16px rgba(17, 17, 26, 0.05),
                   0px 8px 24px rgba(17, 17, 26, 0.05),
                   0px 16px 56px rgba(17, 17, 26, 0.05),
                   0px 4px 16px rgba(17, 17, 26, 0.05) inset`;
        } else {
            // Standard CSS Backdrop Filter fallback
            if (this.isDarkMode) {
                if (!backdropFilterSupported) {
                    styles.background = 'rgba(0, 0, 0, 0.65)';
                    styles.border = '1px solid rgba(255, 255, 255, 0.15)';
                    styles.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 0 rgba(255, 255, 255, 0.08)';
                } else {
                    styles.background = 'rgba(20, 20, 20, 0.55)';
                    styles.backdropFilter = 'blur(12px) saturate(1.8) brightness(1.1)';
                    styles.webkitBackdropFilter = 'blur(12px) saturate(1.8) brightness(1.1)';
                    styles.border = '1px solid rgba(255, 255, 255, 0.15)';
                    styles.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 0 rgba(255, 255, 255, 0.08)';
                }
            } else {
                if (!backdropFilterSupported) {
                    styles.background = 'rgba(255, 255, 255, 0.85)';
                    styles.border = '1px solid rgba(0, 0, 0, 0.1)';
                    styles.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 0 rgba(0, 0, 0, 0.05)';
                } else {
                    styles.background = 'rgba(255, 255, 255, 0.25)';
                    styles.backdropFilter = 'blur(12px) saturate(1.8) brightness(1.1)';
                    styles.webkitBackdropFilter = 'blur(12px) saturate(1.8) brightness(1.1)';
                    styles.border = '1px solid rgba(255, 255, 255, 0.25)';
                    styles.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.35)';
                }
            }
        }
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.svgElement && this.svgElement.parentNode) {
            this.svgElement.parentNode.removeChild(this.svgElement);
        }
    }
}
