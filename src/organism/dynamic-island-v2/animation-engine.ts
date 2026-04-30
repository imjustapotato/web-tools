import { gsap } from 'gsap';
import Flip from 'gsap/Flip';
import { IslandState, PulseConfig, ParticleCommand } from './types';

/**
 * Dynamic Island v2.0 - Animation & Physics Engine
 * Refined with "Squish" mechanics and Omni-Directional Trig.
 */

export const PHYSICS = {
    spring: 'power4.out',
    bounce: 'back.out(1.5)',
    snap: 'expo.out',
    drop: 'power2.in',
    squish: 'elastic.out(1.2, 0.75)'
};

export const AnimEngine = {
    _breathTimelines: new WeakMap<HTMLElement, any>(),

    /**
     * Start or update a GSAP breath timeline on the pill.
     * Options: { color?: string, speed?: number, scale?: number, glow?: number }
     */
    startBreathing: (pillElement: HTMLElement | null, options: { color?: string, speed?: number, scale?: number, glow?: number } = {}) => {
        if (!pillElement) return;

        const color = options.color || getComputedStyle(pillElement).getPropertyValue('--di-color') || '#8b5cf6';
        const speed = (options.speed && options.speed > 0) ? options.speed : 3; // seconds per cycle
        const scale = options.scale || 1.03;
        const glow = options.glow || 30;

        // If an existing timeline exists, kill it so we can replace with updated params
        const existing: any = AnimEngine._breathTimelines.get(pillElement);
        if (existing) {
            try { existing.kill(); } catch (e) {}
        }

        // Ensure the pill has the dataset flag for compatibility with other code
        pillElement.dataset.breathe = 'true';
        const tl = gsap.timeline({ repeat: -1, yoyo: true });

        // Animate scale + glow (boxShadow + borderColor) on the rounded background layer
        tl.to(pillElement, {
            scale: scale,
            boxShadow: `0 0 ${glow}px ${color}, 0 0 0 2px ${color}`,
            borderColor: color,
            duration: speed / 2,
            ease: 'sine.inOut'
        });

        // Reverse step handled via yoyo
        AnimEngine._breathTimelines.set(pillElement, tl);
        return tl;
    },

    stopBreathing: (pillElement: HTMLElement | null) => {
        if (!pillElement) return;
        const existing: any = AnimEngine._breathTimelines.get(pillElement);
        if (existing) {
            try { existing.kill(); } catch (e) {}
            AnimEngine._breathTimelines.delete(pillElement);
        }

        gsap.to(pillElement, { 
            scale: 1, 
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', 
            borderColor: 'rgba(255, 255, 255, 0.1)', 
            duration: 0.25, 
            ease: 'power2.out' 
        });
        delete pillElement.dataset.breathe;
    },
    
    /**
     * Interactivity Engine
     */
    bindInteractivity: (island: any, interactivity?: any) => {
        const element = island.pill;
        if (!element) return;
        
        // Cleanup existing listeners if bound
        if (island._interactivityCleanup) {
            island._interactivityCleanup();
            island._interactivityCleanup = null;
        }

        if (!interactivity || Object.keys(interactivity).length === 0) {
            element.style.cursor = 'default';
            return;
        }

        element.style.cursor = 'pointer';

        const handleHover = () => {
            if (island.config.debug) console.log('[Dynamic Island] MouseEnter triggered:', interactivity);
            gsap.to(element, { scale: 1.03, y: -2, duration: 0.3, ease: PHYSICS.bounce, overwrite: 'auto' });
            if (interactivity.onHover) {
                AnimEngine.executeActions(island, interactivity.onHover);
            }
        };

        const handleLeave = () => {
            gsap.to(element, { scale: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
            if (interactivity.onLeave) {
                AnimEngine.executeActions(island, interactivity.onLeave);
            } else if (interactivity.onHover && interactivity.onHover.some((a: any) => a.type === 'expand')) {
                // Auto-collapse if hover triggered an expand
                if (island.activePersistentState && island.activePersistentState.alwaysSentry) {
                    const sentryState = { ...island.activePersistentState, skipQueue: true, title: '', subtitle: '', description: '', isSentryRestoration: true };
                    island.setState(sentryState);
                }
            }
        };

        const handleClick = (e: Event) => {
            e.stopPropagation();
            AnimEngine.triggerImpactGlow(island.pillBg, '#ffffff');
            if (interactivity.onClick) {
                AnimEngine.executeActions(island, interactivity.onClick);
            }
        };

        element.addEventListener('mouseenter', handleHover);
        element.addEventListener('mouseleave', handleLeave);
        element.addEventListener('click', handleClick);

        island._interactivityCleanup = () => {
            element.removeEventListener('mouseenter', handleHover);
            element.removeEventListener('mouseleave', handleLeave);
            element.removeEventListener('click', handleClick);
        };
    },

    executeActions: (island: any, actions: any[]) => {
        actions.forEach(action => {
            switch(action.type) {
                case 'link':
                    if (action.url) window.open(action.url, '_blank');
                    break;
                case 'particle':
                    if (action.particleCommand) island.fireParticle(action.particleCommand);
                    break;
                case 'payload':
                    if (action.payload) island.setState(action.payload);
                    break;
                case 'animation':
                    if (action.animation === 'breathe') {
                        AnimEngine.startBreathing(island.pillBg || island.pill, { color: action.value });
                    } else if (action.animation === 'color' && action.value) {
                        AnimEngine.applyDynamicColor(island.pill, action.value as string);
                    } else if (action.animation === 'squish') {
                        AnimEngine.triggerImpactGlow(island.pillBg, action.value as string || '#ffffff');
                    }
                    break;
                case 'expand':
                    if (island.activePersistentState && island.activePersistentState.alwaysSentry) {
                         if (island.config.debug) console.log('[Dynamic Island] Expanding sentry state.');
                         // Set a long duration so it stays expanded while hovering; handleLeave will collapse it
                         const tempState = { ...island.activePersistentState, skipQueue: true, isSentryRestoration: false, alwaysSentry: false, persist: false, displayDuration: 60000 };
                         island.setState(tempState); 
                    }
                    break;
                case 'callback':
                    if (action.handler) action.handler();
                    break;
            }
        });
    },

    morphToState: async (island: any, state: IslandState): Promise<void> => {
        return new Promise((resolve) => {
            AnimEngine.fluidLayoutMorph(island, state, resolve);
        });
    },

    fluidLayoutMorph: (island: any, state: IslandState, onComplete: () => void) => {
        try { gsap.registerPlugin(Flip); } catch (e) {}

        const isExpanded = !!state.description;
        const hasText = !!state.title || !!state.subtitle;

        gsap.killTweensOf([island.pill, island.pillBg, island.textWrapper, island.indicatorWrapper, island.descEl]);

        // Apply theme/surface after killing conflicting tweens
        AnimEngine.applyDynamicColor(island.pill, state.color, island.config.defaultColor);
        AnimEngine.applySurfaceAnimation(island.pillBg || island.pill, state.surfaceAnimation);

        // Toggle programmable breathing effect
        if (state.breathe) {
            const color = (state as any).breatheColor || state.color || island.config.defaultColor;
            const speed = (state as any).breatheSpeed || undefined;
            AnimEngine.startBreathing(island.pillBg || island.pill, { color, speed });
        } else {
            AnimEngine.stopBreathing(island.pillBg || island.pill);
        }

        const hadBreathe = !!((island.pillBg || island.pill).dataset?.breathe === 'true');
        if (hadBreathe) (island.pillBg || island.pill).removeAttribute('data-breathe');

        const textWrapperStyle = window.getComputedStyle(island.textWrapper);
        const descStyle = window.getComputedStyle(island.descEl);
        const textWrapperVisible = textWrapperStyle.display !== 'none' && textWrapperStyle.opacity !== '0';
        const descVisible = descStyle.display !== 'none' && descStyle.opacity !== '0';

        const flipState = Flip.getState([island.pill, island.textWrapper, island.indicatorWrapper, island.descEl]);

        // Apply Graceful Text Swapping
        const textAnim = state.textAnimation || 'slide-up';
        const textDur = state.textDuration || 400;

        AnimEngine.transitionText(island.titleEl, state.title || '', textAnim, textDur);
        AnimEngine.transitionText(island.subtitleEl, state.subtitle || '', textAnim, textDur);

        if (isExpanded) {
            if (island.descEl.textContent !== state.description) {
                AnimEngine.transitionText(island.descEl, state.description || '', textAnim, textDur);
            }
            island.descEl.style.display = 'block';
            island.descEl.style.height = 'auto';
            island.descEl.style.marginTop = '8px';
            island.indicatorWrapper.style.width = '0px';
            island.indicatorWrapper.style.opacity = '0';
            island.textWrapper.style.display = 'flex';
            gsap.set(island.pill, { gap: 0 });
        } else if (hasText) {
            island.descEl.style.display = 'none';
            island.descEl.style.height = '0';
            island.descEl.style.marginTop = '0';
            island.indicatorWrapper.style.width = '20px';
            island.indicatorWrapper.style.opacity = '1';
            island.textWrapper.style.display = 'flex';
            gsap.set(island.pill, { gap: 10 });
            AnimEngine.morphIndicator(island.indicatorWrapper, state, island.config.defaultIcon);
        } else {
            island.descEl.style.display = 'none';
            island.descEl.style.height = '0';
            island.descEl.style.marginTop = '0';
            island.indicatorWrapper.style.width = '20px';
            island.indicatorWrapper.style.opacity = '1';
            island.textWrapper.style.display = 'none';
            gsap.set(island.pill, { gap: 0 });
            AnimEngine.morphIndicator(island.indicatorWrapper, state, island.config.defaultIcon);
        }

        // Kill existing animations on the pill and background to prevent property fighting
        gsap.killTweensOf([island.pill, island.pillBg]);

        // --- THE SQUISH: Apply non-uniform scaling to the BACKGROUND layer only ---
        // This keeps the main container (island.pill) stable for the Flip plugin.
        if (island.pillBg) {
            gsap.fromTo(island.pillBg, 
                { scaleX: 1.15, scaleY: 0.85, transformOrigin: 'center center' }, 
                { scaleX: 1, scaleY: 1, duration: 0.8, ease: PHYSICS.squish, overwrite: true }
            );
        }

        Flip.from(flipState, {
            duration: 0.6,
            ease: PHYSICS.spring,
            overwrite: 'auto',
            onComplete: () => {
                if ((hasText || isExpanded) && !textWrapperVisible) {
                    gsap.fromTo(island.textWrapper,
                        { opacity: 0, y: -4 },
                        { opacity: 1, y: 0, duration: 0.35, ease: PHYSICS.bounce, delay: 0.05 }
                    );
                }

                if (isExpanded && !descVisible) {
                    gsap.fromTo(island.descEl,
                        { opacity: 0, y: -4 },
                        { opacity: 1, y: 0, duration: 0.35, ease: PHYSICS.bounce, delay: 0.1 }
                    );
                }

                setTimeout(() => {
                    // Restore breathing if it was active and the new state still wants it
                    if (hadBreathe && state.breathe) {
                        const color = (state as any).breatheColor || state.color || island.config.defaultColor;
                        const speed = (state as any).breatheSpeed || undefined;
                        AnimEngine.startBreathing(island.pillBg || island.pill, { color, speed });
                    }
                    onComplete();
                }, 300);
            }
        });
    },

    applySurfaceAnimation: (pillElement: HTMLElement | null, surfaceType: string = 'none') => {
        if (!pillElement) return;
        pillElement.setAttribute('data-surface', surfaceType);
    },

    morphIndicator: (wrapper: HTMLElement | null, state: IslandState, defaultIcon?: string) => {
        if (!wrapper) return;

        const isIcon = !!state.icon || (!state.pulse && !!defaultIcon);
        const targetHTML = isIcon 
            ? (state.icon || defaultIcon || '')
            : `<div class="di-pulse-dot"><div class="di-pulse-ripple"></div></div>`;

        if (wrapper.innerHTML === targetHTML && isIcon) return;

        gsap.killTweensOf(wrapper, "scale,rotation");
        
        gsap.to(wrapper, {
            scale: 0,
            rotation: -15,
            duration: 0.2,
            ease: PHYSICS.drop,
            onComplete: () => {
                wrapper.innerHTML = targetHTML;
                if (!isIcon && state.pulse) {
                    const ripple = wrapper.querySelector('.di-pulse-ripple') as HTMLElement;
                    AnimEngine.buildPulseTimeline(ripple, state.pulse);
                }
                gsap.fromTo(wrapper,
                    { scale: 0, rotation: 15 },
                    { scale: 1, rotation: 0, duration: 0.4, ease: PHYSICS.spring }
                );
            }
        });
    },

    buildPulseTimeline: (rippleElement: HTMLElement | null, config: PulseConfig) => {
        if (!rippleElement) return;
        gsap.killTweensOf(rippleElement);
        const timeline = gsap.timeline({ repeat: -1, repeatDelay: config.gap });
        for (let i = 0; i < config.count; i++) {
            timeline.fromTo(rippleElement,
                { scale: 1, opacity: 0.8 },
                { scale: 3.5, opacity: 0, duration: config.speed, ease: 'power2.out' },
                i * (config.speed * 0.4) 
            );
        }
    },

    applyDynamicColor: (pillElement: HTMLElement | null, colorCode: string | undefined, defaultColor: string = '#f8fafc') => {
        if (!pillElement) return;
        const targetColor = colorCode || defaultColor;
        const hex = targetColor.replace('#', '');
        const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) || 255;
        
        pillElement.style.setProperty('--di-color-rgb', `${r}, ${g}, ${b}`);
        gsap.to(pillElement, { '--di-color': targetColor, duration: 0.3, ease: PHYSICS.snap, overwrite: 'auto' });
    },

    transitionText: (container: HTMLElement, newText: string, animation: TextAnimation = 'slide-up', duration: number = 400) => {
        // Stop and REMOVE any currently running text animations in this container
        const activeLayers = container.querySelectorAll('.di-text-outgoing, .di-text-incoming');
        if (activeLayers.length > 0) {
            gsap.killTweensOf(activeLayers);
            activeLayers.forEach(el => el.remove());
        }

        // Determine current display text accurately
        // Kill any ongoing text animations on this container
        gsap.killTweensOf(container);
        const existingIncoming = container.querySelector('.di-text-incoming');
        const existingOutgoing = container.querySelector('.di-text-outgoing');
        if (existingIncoming) gsap.killTweensOf(existingIncoming);
        if (existingOutgoing) gsap.killTweensOf(existingOutgoing);

        const currentEffectiveText = container.textContent || '';

        if (currentEffectiveText === newText) {
            // Even if text matches, if we have layers, clean them up
            if (activeLayers.length > 0) container.innerHTML = newText;
            return;
        }

        // Fallback for no animation or rapid-fire cleanup
        if (animation === 'none') {
            container.innerHTML = '';
            container.textContent = newText;
            return;
        }

        // Prepare the "Outgoing" layer with current content
        const outgoing = document.createElement('div');
        outgoing.className = 'di-text-outgoing';
        Object.assign(outgoing.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
        });
        outgoing.textContent = currentEffectiveText;
        
        // Prepare the "Incoming" layer
        const incoming = document.createElement('div');
        incoming.className = 'di-text-incoming';
        Object.assign(incoming.style, {
            width: '100%',
            whiteSpace: 'nowrap',
            opacity: 0 // Explicitly hide to prevent 1-frame flash before GSAP starts
        });
        incoming.textContent = newText;

        // Clear and swap
        container.innerHTML = '';
        container.appendChild(outgoing);
        container.appendChild(incoming);

        const tl = gsap.timeline({ 
            onComplete: () => {
                if (container.contains(incoming)) {
                    // Replace with raw text to return to a natural, stable state
                    container.textContent = newText;
                }
            }
        });

        const d = duration / 1000;

        switch (animation) {
            case 'fade':
                tl.fromTo(outgoing, { opacity: 1 }, { opacity: 0, duration: d });
                tl.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: d }, 0);
                break;
            case 'slide-up':
                tl.fromTo(outgoing, { y: 0, opacity: 1 }, { y: -15, opacity: 0, duration: d, ease: 'power2.in' });
                tl.fromTo(incoming, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: d, ease: 'power2.out' }, d * 0.2);
                break;
            case 'slide-down':
                tl.fromTo(outgoing, { y: 0, opacity: 1 }, { y: 15, opacity: 0, duration: d, ease: 'power2.in' });
                tl.fromTo(incoming, { y: -15, opacity: 0 }, { y: 0, opacity: 1, duration: d, ease: 'power2.out' }, d * 0.2);
                break;
            case 'blur':
                tl.fromTo(outgoing, { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(10px)', opacity: 0, duration: d });
                tl.fromTo(incoming, { filter: 'blur(10px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1, duration: d }, d * 0.1);
                break;
            case 'scale':
                tl.fromTo(outgoing, { scale: 1, opacity: 1 }, { scale: 0.8, opacity: 0, duration: d, ease: 'back.in(1.7)' });
                tl.fromTo(incoming, { scale: 1.2, opacity: 0 }, { scale: 1, opacity: 1, duration: d, ease: 'back.out(1.7)' }, d * 0.2);
                break;
        }
    },

    triggerImpactGlow: (pillElement: HTMLElement | null, hexColor: string, duration: number = 1.2) => {
        if (!pillElement) return;
        gsap.killTweensOf(pillElement, "boxShadow,borderColor,scale");
        gsap.fromTo(pillElement, { scale: 1.04 }, { scale: 1, duration: 0.5, ease: PHYSICS.spring });
        gsap.fromTo(pillElement,
            { boxShadow: `0 0 35px ${hexColor}, 0 0 0 2px ${hexColor}`, borderColor: hexColor },
            { 
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', 
                borderColor: 'rgba(255, 255, 255, 0.1)', 
                duration: duration, 
                ease: PHYSICS.snap,
                clearProps: 'boxShadow,borderColor'
            }
        );
    },

    triggerWaterDroplet: (island: any, command: ParticleCommand) => {
        if (!island.indicatorWrapper || !island.particleLayer) return;

        const particle = document.createElement('div');
        particle.className = `di-particle type-${command.type}`;
        particle.style.top = '0';
        particle.style.left = '0';
        particle.style.setProperty('--di-particle-color', command.color);
        particle.innerHTML = command.type === 'icon' 
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${command.content}</svg>`
            : `<span class="di-particle-emoji">${command.content}</span>`;
        
        island.particleLayer.appendChild(particle);

        const dotRect = island.indicatorWrapper.getBoundingClientRect();
        const layerRect = island.particleLayer.getBoundingClientRect();

        // Coordinates relative to the particle layer
        const startX = (dotRect.left + dotRect.width / 2) - layerRect.left;
        const startY = (dotRect.top + dotRect.height / 2) - layerRect.top;

        const position = island.config.position;
        const isTop = position.includes('top');
        const isBottom = position.includes('bottom');
        const isRight = position.includes('right');

        // Target coordinates (offscreen) relative to the layer
        const vW = window.innerWidth;
        const vH = window.innerHeight;
        const screenCenterX = (vW / 2) - layerRect.left;
        
        // Dynamic trajectory based on position
        const yDirection = isBottom ? -1 : 1;
        const endY = isBottom ? -100 - layerRect.top : vH + 100 - layerRect.top;
        
        // Randomize horizontal spread
        const centerX = screenCenterX + (Math.random() - 0.5) * 200;
        let targetX = centerX + (Math.random() - 0.5) * 400;
        let targetY = endY;

        if (position.includes('center') && !isTop && !isBottom) {
            // Truly center - burst to nearest vertical edge
            targetY = Math.random() > 0.5 ? -100 - layerRect.top : vH + 100 - layerRect.top;
        }

        const tl = gsap.timeline({ onComplete: () => particle.remove() });

        if (command.direction === 'outbound') {
            gsap.set(particle, { x: startX, y: startY, xPercent: -50, yPercent: -50, scale: 0.1, opacity: 0 });
            
            const impactColor = command.impactColor || command.color;
            AnimEngine.triggerImpactGlow(island.pill, impactColor, (command.impactDuration || 1200) / 1000);
            
            if (command.impactColor) {
                // Temporary text flash via CSS var
                const originalColor = island.currentState?.color || island.config.defaultColor || '#f8fafc';
                island.pill.style.setProperty('--di-color', impactColor);
                setTimeout(() => {
                    if (island.pill) island.pill.style.setProperty('--di-color', originalColor);
                }, command.impactDuration || 1200);
            }

            if (command.pillColor) {
                AnimEngine.applyDynamicColor(island.pill, command.pillColor);
            }

            // Phase 1: Squish out from the hub
            tl.to(particle, { 
                x: (startX + centerX) / 2, 
                y: startY, 
                scaleX: 1.5, scaleY: 0.4, 
                opacity: 0.85, 
                duration: 0.35, 
                ease: 'power2.out' 
            });
            // Phase 2: Reform and Beam
            tl.to(particle, { x: centerX, y: startY, scaleX: 1, scaleY: 1, scale: 1, opacity: 1, duration: 0.4, ease: PHYSICS.spring }, "-=0.1");
            tl.to(particle, { x: targetX, y: targetY, rotation: 180, scale: 0.4, opacity: 0, duration: 0.6, ease: 'power3.in' }, "+=0.1");

        } else {
            // Inbound Intercept
            const midX = screenCenterX + (Math.random() - 0.5) * (vW * 0.6);
            const midY = (vH / 2) - layerRect.top + (Math.random() - 0.5) * (vH * 0.6);

            gsap.set(particle, { x: midX, y: midY, xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 });
            tl.to(particle, { x: centerX, y: startY, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' });
            tl.to(particle, { x: (startX + centerX) / 2, y: startY, scaleX: 1.6, scaleY: 0.4, duration: 0.3, ease: 'power2.in' });
            tl.to(particle, { x: startX, y: startY, scale: 0, opacity: 0, duration: 0.2, onComplete: () => {
                const impactColor = command.impactColor || command.color;
                AnimEngine.triggerImpactGlow(island.pill, impactColor, (command.impactDuration || 1200) / 1000);
                
                if (command.impactColor) {
                    const originalColor = island.currentState?.color || island.config.defaultColor || '#f8fafc';
                    island.pill.style.setProperty('--di-color', impactColor);
                    setTimeout(() => {
                        if (island.pill) island.pill.style.setProperty('--di-color', originalColor);
                    }, command.impactDuration || 1200);
                }

                if (command.pillColor) {
                    AnimEngine.applyDynamicColor(island.pill, command.pillColor);
                }
            }});
        }
    },

    triggerEmojiBurst: (island: any, emoji: string = '❤️', count: number = 8, color: string = '#fb7185', pillColor?: string) => {
        if (!island.indicatorWrapper) return;
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                AnimEngine.triggerWaterDroplet(island, {
                    direction: 'outbound',
                    type: 'emoji',
                    content: emoji,
                    color: color,
                    pillColor: pillColor
                });
            }, i * 100);
        }
    }
};