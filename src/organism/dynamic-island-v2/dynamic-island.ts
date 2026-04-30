import { IslandConfig, IslandState, ParticleCommand } from './types';
import { AnimEngine } from './animation-engine';

/**
 * Dynamic Island v2.0 - Core Organism
 * Now with Shadow DOM isolation and Priority Queueing.
 */
export class DynamicIsland {
    public config: IslandConfig;
    public shadowRoot!: ShadowRoot;
    
    // Core Elements (Now inside Shadow DOM)
    public container!: HTMLDivElement;
    public pill!: HTMLDivElement;
    public pillBg!: HTMLDivElement; // The GPU proxy layer
    public content!: HTMLDivElement; // The layout boundary
    
    public indicatorWrapper!: HTMLDivElement;
    public particleLayer!: HTMLDivElement;
    public textWrapper!: HTMLDivElement;
    public titleEl!: HTMLDivElement;
    public subtitleEl!: HTMLDivElement;
    public descEl!: HTMLDivElement;

    private stateQueue: IslandState[] = [];
    private isProcessing: boolean = false;
    public currentState: IslandState | null = null;
    private activePersistentState: IslandState | null = null;
    private currentProcessId: number = 0; 

    constructor(config: IslandConfig) {
        this.config = {
            useShadowDOM: true,
            debug: false,
            ...config
        };
        
        this.buildDOM();
        this.applyAnchoring();
        this.bindEvents();

        if (this.config.debug) {
            console.log('[Dynamic Island v2.0] Initialized with config:', this.config);
        }
    }

    public mount(parent: HTMLElement = document.body) {
        parent.appendChild(this.container);
        if (this.config.debug) console.log('[Dynamic Island] Mounted to:', parent);
    }

    private buildDOM() {
        // 1. Create Host Container
        this.container = document.createElement('div');
        this.container.className = 'di-container-host';
        
        // 2. Initialize Shadow DOM if enabled
        const root = this.config.useShadowDOM 
            ? this.container.attachShadow({ mode: 'open' }) 
            : this.container;
        
        this.shadowRoot = root as ShadowRoot;

        // 3. Particle Layer (Fixed viewport-matching layer inside Shadow DOM)
        this.particleLayer = document.createElement('div');
        this.particleLayer.className = 'di-particle-layer';
        root.appendChild(this.particleLayer);

        // 4. Inner Container (Real styling target)
        const innerContainer = document.createElement('div');
        innerContainer.className = 'di-container';
        
        this.pill = document.createElement('div');
        this.pill.className = 'di-pill';

        this.pillBg = document.createElement('div');
        this.pillBg.className = 'di-pill-bg';
        this.pillBg.setAttribute('data-surface', 'none');

        this.content = document.createElement('div');
        this.content.className = 'di-content mode-sentry'; 

        this.indicatorWrapper = document.createElement('div');
        this.indicatorWrapper.className = 'di-indicator-wrapper';
        
        this.textWrapper = document.createElement('div');
        this.textWrapper.className = 'di-text-wrapper';

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'di-title';

        this.subtitleEl = document.createElement('div');
        this.subtitleEl.className = 'di-subtitle';

        this.descEl = document.createElement('div');
        this.descEl.className = 'di-description';
        
        // Assemble
        this.textWrapper.appendChild(this.titleEl);
        this.textWrapper.appendChild(this.subtitleEl);
        this.content.appendChild(this.indicatorWrapper);
        this.content.appendChild(this.textWrapper);
        this.content.appendChild(this.descEl); 
        this.pill.appendChild(this.pillBg);
        this.pill.appendChild(this.content);
        innerContainer.appendChild(this.pill);
        root.appendChild(innerContainer);

        // Initial State Defaults
        this.syncDefaults();
    }

    public injectStyles(css: string) {
        const styleId = 'di-v2-styles';
        let style = this.shadowRoot.getElementById(styleId) as HTMLStyleElement;
        
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            this.shadowRoot.appendChild(style);
        }
        
        style.textContent = css;
    }

    private syncDefaults() {
        this.titleEl.textContent = this.config.defaultTitle || '';
        this.subtitleEl.textContent = this.config.defaultSubtitle || '';
        
        if (this.config.defaultIcon) {
            this.indicatorWrapper.innerHTML = this.config.defaultIcon;
        } else {
            this.indicatorWrapper.innerHTML = `<div class="di-pulse-dot"><div class="di-pulse-ripple"></div></div>`;
        }

        if (this.config.defaultColor) {
            AnimEngine.applyDynamicColor(this.pill, this.config.defaultColor);
        }
    }

    private bindEvents() {
        const legacyInteractivity = (this.config.interactive || this.config.onClick) ? {
            onHover: this.config.interactive ? [] : undefined,
            onClick: this.config.onClick ? [{ type: 'callback', handler: this.config.onClick }] : undefined
        } : undefined;

        AnimEngine.bindInteractivity(this, this.config.interactivity || legacyInteractivity);
    }

    private applyAnchoring() {
        const { position, offsetX = 0, offsetY = 0 } = this.config;
        
        const isTop = position.includes('top');
        const isBottom = position.includes('bottom');
        const isLeft = position.includes('left');
        const isRight = position.includes('right');
        const isCenterX = position === 'top-center' || position === 'bottom-center';

        const style = this.container.style;
        style.position = 'fixed';
        style.zIndex = '999999';
        style.pointerEvents = 'none';
        style.display = 'flex';
        style.flexDirection = 'column';

        style.top = 'auto';
        style.bottom = 'auto';
        style.left = 'auto';
        style.right = 'auto';
        style.transform = 'none';

        if (isTop) {
            style.top = `${24 + offsetY}px`;
        } else if (isBottom) {
            style.bottom = `${24 + offsetY}px`;
        } else {
            style.top = `calc(50% + ${offsetY}px)`;
            style.transform = 'translateY(-50%)';
        }

        if (isLeft) {
            style.left = `${24 + offsetX}px`;
            style.alignItems = 'flex-start';
        } else if (isRight) {
            style.right = `${24 + offsetX}px`;
            style.alignItems = 'flex-end';
        } else if (isCenterX) {
            style.left = `calc(50% + ${offsetX}px)`;
            style.transform = style.transform 
                ? `${style.transform} translateX(-50%)`
                : 'translateX(-50%)';
            style.alignItems = 'center';
        }
    }

    public setState(state: IslandState) {
        if (this.config.debug) console.log('[Dynamic Island] Queuing state:', state.id, state);

        if (state.priority === 1 || state.skipQueue) {
            if (this.config.debug) console.log('[Dynamic Island] High priority interrupt triggered.');
            this.stateQueue = []; 
            this.currentProcessId++; 
            this.isProcessing = false;
        } 
        
        else if (this.stateQueue.length > 0 && this.stateQueue[this.stateQueue.length - 1].id === state.id) {
            return;
        }
        
        this.stateQueue.push(state);
        this.processQueue();
    }

    private async processQueue() {
        if (this.isProcessing || this.stateQueue.length === 0) return;
        this.isProcessing = true;
        
        const processId = ++this.currentProcessId;

        while (this.stateQueue.length > 0) {
            if (processId !== this.currentProcessId) return; 

            const nextState = this.stateQueue.shift()!;
            this.currentState = nextState;
            
            const isSentryRestoration = (nextState as any).isSentryRestoration;

            if (nextState.persist && !isSentryRestoration) {
                this.activePersistentState = nextState;
            }

            await AnimEngine.morphToState(this, nextState);
            
            // Bind interactivity dynamically per state, fallback to config
            const legacyInteractivity = (this.config.interactive || this.config.onClick) ? {
                onHover: this.config.interactive ? [] : undefined,
                onClick: this.config.onClick ? [{ type: 'callback', handler: this.config.onClick }] : undefined
            } : undefined;
            AnimEngine.bindInteractivity(this, nextState.interactivity || this.config.interactivity || legacyInteractivity);

            if (processId !== this.currentProcessId) return; 
            
            if (nextState.persist) {
                this.isProcessing = false;
                if (this.config.debug) console.log('[Dynamic Island] State persistent. Waiting for next push.');

                if (nextState.alwaysSentry && !isSentryRestoration) {
                     const holdDuration = nextState.displayDuration || 3000;
                     setTimeout(() => {
                         if (this.currentState === nextState && processId === this.currentProcessId) {
                             const sentryState = { ...nextState, title: '', subtitle: '', description: '', isSentryRestoration: true };
                             this.setState({ ...sentryState, skipQueue: true });
                         }
                     }, holdDuration);
                }
                return;
            }

            const holdDuration = nextState.displayDuration || 3000;
            await new Promise(resolve => setTimeout(resolve, holdDuration));
        }

        this.isProcessing = false;
        
        // Restoration Logic: If we just finished a temporary state and have a background state, restore it.
        if (this.activePersistentState && (!this.currentState || !this.currentState.persist)) {
            if (this.config.debug) console.log('[Dynamic Island] Restoring persistent background state.');
            
            const restoreState = { ...this.activePersistentState, skipQueue: true };
            if (this.activePersistentState.alwaysSentry) {
                restoreState.title = '';
                restoreState.subtitle = '';
                restoreState.description = '';
                (restoreState as any).isSentryRestoration = true;
            }
            this.stateQueue.push(restoreState);
            this.processQueue();
        } else if (this.config.debug) {
            console.log('[Dynamic Island] Queue exhausted. No restoration needed.');
        }
    }

    public fireParticle(command: ParticleCommand) {
        if (this.config.debug) console.log('[Dynamic Island] Firing particle:', command);
        AnimEngine.triggerWaterDroplet(this, command);
    }
}