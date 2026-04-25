/* Import GSAP for animation library
* Houses mostly used anims in the app
*/

import { gsap } from 'gsap';

// Checks if GSAP is loaded
export function hasGsap() {
    return typeof gsap !== 'undefined';
}

// Animation trigger for clickable elements - Upgraded to a tactile spring
export function animatePressFeedback(targetEl) {
    if (!targetEl || !hasGsap()) {
        return;
    }

    gsap.killTweensOf(targetEl);
    gsap.fromTo(targetEl,
        { scale: 0.92 },
        { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' }
    );
}

// Animation trigger for modal entrance - Upgraded to modern snappy expo
export function animateModalIn(modalEl, cardEl) {
    if (!modalEl) {
        return;
    }

    modalEl.classList.remove('hidden');
    if (!hasGsap()) {
        return;
    }

    gsap.killTweensOf([modalEl, cardEl]);
    gsap.set(modalEl, { opacity: 0 });
    // Increased drop distance and scale difference for a more dramatic, premium pop-in
    gsap.set(cardEl, { opacity: 0, y: 24, scale: 0.94 });
    
    gsap.to(modalEl, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.to(cardEl, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out' });
}

// Animation trigger for modal exit - Fast and physically weighted drop
export function animateModalOut(modalEl, cardEl, onComplete) {
    if (!modalEl || modalEl.classList.contains('hidden')) {
        onComplete?.();
        return;
    }

    if (!hasGsap()) {
        modalEl.classList.add('hidden');
        onComplete?.();
        return;
    }

    gsap.killTweensOf([modalEl, cardEl]);
    const timeline = gsap.timeline({
        onComplete: () => {
            modalEl.classList.add('hidden');
            onComplete?.();
        }
    });

    timeline.to(cardEl, { opacity: 0, y: 16, scale: 0.96, duration: 0.2, ease: 'power3.in' });
    timeline.to(modalEl, { opacity: 0, duration: 0.2, ease: 'power2.in' }, '<0.05');
}

// 🚀 v2.0 Color Selector: "Teleport & Snap" Target Lock
export function animateColorSelectorTo(buttonEl, colorPicker, immediate = false) {
    if (!colorPicker || !buttonEl) {
        return;
    }

    const highlight = colorPicker.querySelector('.color-selector-highlight');
    if (!highlight) {
        return;
    }

    const pickerRect = colorPicker.getBoundingClientRect();
    const buttonRect = buttonEl.getBoundingClientRect();
    const nextX = buttonRect.left - pickerRect.left;
    const nextY = buttonRect.top - pickerRect.top;

    if (!hasGsap() || immediate) {
        gsap.set(highlight, {
            opacity: 1,
            x: nextX,
            y: nextY,
            width: buttonRect.width,
            height: buttonRect.height,
            scale: 1
        });
        return;
    }

    // 1. The button being clicked does a satisfying deep squish and twist
    gsap.killTweensOf(buttonEl);
    gsap.fromTo(buttonEl,
        { scale: 0.65, rotation: -10 },
        { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' }
    );

    // 2. Kill the old sliding animation. Teleport the ring instantly, but invisible and tiny.
    gsap.killTweensOf(highlight);
    gsap.set(highlight, {
        x: nextX,
        y: nextY,
        width: buttonRect.width,
        height: buttonRect.height,
        scale: 0.4,
        opacity: 0
    });

    // 3. Explode the ring outward to lock onto the rebounding button
    gsap.to(highlight, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: 'back.out(2)', 
        delay: 0.05 // Tiny delay so the button squish leads the interaction
    });
}

// Helper to map standard background classes to glow colors for hover effects.
export function getBlockGlowColor(colorClass) {
    const hue = String(colorClass || '').replace(/^bg-/, '').split('-')[0];
    const glowMap = {
        emerald: 'rgba(16, 185, 129, 0.55)',
        cyan: 'rgba(6, 182, 212, 0.55)',
        indigo: 'rgba(99, 102, 241, 0.55)',
        purple: 'rgba(147, 51, 234, 0.55)',
        rose: 'rgba(244, 63, 94, 0.55)',
        amber: 'rgba(245, 158, 11, 0.55)',
        sky: 'rgba(14, 165, 233, 0.55)',
        lime: 'rgba(132, 204, 22, 0.55)',
        pink: 'rgba(236, 72, 153, 0.55)',
        teal: 'rgba(20, 184, 166, 0.55)',
        blue: 'rgba(59, 130, 246, 0.55)'
    };

    return glowMap[hue] || 'rgba(16, 185, 129, 0.55)';
}

// Bind hover interactions to a schedule block - Fixes the GSAP overlap bug
export function bindBlockHoverAnimation(blockEl, colorClass) {
    if (!blockEl) {
        return;
    }

    const glowColor = getBlockGlowColor(colorClass);

    const onEnter = () => {
        if (!hasGsap()) return;
        // Kill existing tweens on this specific block so rapid hovers don't stack and deadlock
        gsap.killTweensOf(blockEl); 
        gsap.to(blockEl, {
            y: -3,
            scale: 1.015,
            boxShadow: `0 20px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.2) inset, 0 0 24px ${glowColor}`,
            duration: 0.35,
            ease: 'back.out(1.5)',
            overwrite: true // Force overwrite
        });
    };

    const onLeave = () => {
        if (!hasGsap()) return;
        gsap.killTweensOf(blockEl);
        gsap.to(blockEl, {
            y: 0,
            scale: 1,
            boxShadow: '0 0 0 rgba(0,0,0,0)',
            duration: 0.25,
            ease: 'power2.out',
            overwrite: true
        });
    };

    blockEl.addEventListener('mouseenter', onEnter);
    blockEl.addEventListener('mouseleave', onLeave);
}

// Bind hold interaction for blocks (wave animation + trigger edit)
export function bindBlockHoldInteraction(blockEl, colorClass, onHoldComplete) {
    if (!blockEl || !hasGsap()) return;
    
    let holdTimer = null;
    let isHolding = false;
    let waveTween = null;
    
    const startHold = (e) => {
        // Ignore if clicking on the action buttons inside the block
        if (e.target.closest('button')) return;
        
        isHolding = true;
        
        holdTimer = setTimeout(() => {
            if (!isHolding) return;
            
            const glowColor = getBlockGlowColor(colorClass);
            
            // Animate wave on the classblock
            waveTween = gsap.to(blockEl, {
                scale: 1.05,
                boxShadow: `0 0 30px ${glowColor}, 0 0 0 6px rgba(255,255,255,0.5)`,
                duration: 0.25,
                yoyo: true,
                repeat: 1,
                ease: 'sine.inOut',
                onComplete: () => {
                    // After the wave animation ends, open the edit modal
                    onHoldComplete();
                    
                    // Recover gracefully
                    gsap.to(blockEl, {
                        scale: 1,
                        boxShadow: '0 0 0 rgba(0,0,0,0)',
                        duration: 0.3
                    });
                }
            });
            
        }, 400); // Hold required before wave starts
    };
    
    const cancelHold = (e) => {
        isHolding = false;
        clearTimeout(holdTimer);
        
        if (waveTween && waveTween.isActive()) {
            waveTween.kill();
            gsap.to(blockEl, { 
                scale: 1, 
                boxShadow: '0 0 0 rgba(0,0,0,0)', 
                duration: 0.2, 
                ease: 'power2.out' 
            });
        }
    };
    
    blockEl.addEventListener('mousedown', startHold);
    blockEl.addEventListener('touchstart', startHold, { passive: true });
    
    blockEl.addEventListener('mouseup', cancelHold);
    blockEl.addEventListener('mouseleave', cancelHold);
    blockEl.addEventListener('touchend', cancelHold);
    blockEl.addEventListener('touchcancel', cancelHold);
    
    // Prevent default context menu to allow custom long-press to work cleanly
    blockEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Animation for newly added blocks - Drops in like physical cards
export function animateAddedBlocks(blockElements) {
    if (!hasGsap() || !Array.isArray(blockElements) || blockElements.length === 0) {
        return;
    }

    const container = blockElements[0]?.parentElement;
    if (container) container.classList.add('is-animating');

    const timeline = gsap.timeline({
        onComplete: () => {
            if (container) container.classList.remove('is-animating');
            // Clean up any leftover properties from the entrance animation
            gsap.set(blockElements, { clearProps: 'filter,opacity,transform' });
        }
    });

    timeline.fromTo(blockElements,
        {
            autoAlpha: 0,
            x: -16,
            y: -24,
            scale: 0.92,
            rotateX: -8,
            rotateY: 4,
            transformOrigin: '50% 100%',
            filter: 'saturate(1.5) blur(5px) brightness(1.2)'
        },
        {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            filter: 'saturate(1) blur(0px) brightness(1)',
            duration: 0.6,
            ease: 'back.out(1.2)', // Snappy elastic drop
            stagger: { each: 0.08 }
        }
    );

    timeline.fromTo(blockElements,
        {
            boxShadow: '0 0 0 rgba(0,0,0,0), 0 0 0 rgba(0,0,0,0)'
        },
        {
            boxShadow: '0 16px 32px rgba(2, 6, 23, 0.35), 0 0 16px rgba(148,163,184,0.2)',
            duration: 0.3,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
            stagger: { each: 0.08 }
        },
        '-=0.4'
    );
}

// Animation for newly edited blocks - Satisfying physical "tick"
export function animateEditedBlocks(editedEls) {
    if (!hasGsap() || !Array.isArray(editedEls) || editedEls.length === 0) {
        return;
    }

    gsap.fromTo(editedEls,
        { scale: 0.97, y: 2 },
        { scale: 1, y: 0, duration: 0.4, ease: 'back.out(2)', stagger: 0.04 }
    );
}

// Animation for a block being removed - Rapid zoom out and fade
export function animateBlockExitAndRemove(blockEl, onComplete) {
    if (!blockEl || !hasGsap()) {
        onComplete?.();
        return;
    }

    gsap.killTweensOf(blockEl);
    const timeline = gsap.timeline({ onComplete: () => onComplete?.() });
    timeline.to(blockEl, {
        boxShadow: '0 0 12px rgba(255,255,255,0.25)',
        duration: 0.1,
        ease: 'power1.out'
    });
    timeline.to(blockEl, {
        autoAlpha: 0,
        x: 20,
        y: -10,
        scale: 0.9,
        filter: 'blur(4px) saturate(0.5)',
        duration: 0.25,
        ease: 'power3.in'
    }, '-=0.05');
}

// Animation for all blocks clearing in a staggered wave.
export function animateMassBlockExit(blockElements, onComplete) {
    if (!hasGsap() || !Array.isArray(blockElements) || blockElements.length === 0) {
        onComplete?.();
        return;
    }

    const container = blockElements[0]?.parentElement;
    if (container) container.classList.add('is-animating');

    const timeline = gsap.timeline({
        onComplete: () => {
            if (container) container.classList.remove('is-animating');
            onComplete?.();
        }
    });

    timeline.to(blockElements, {
        autoAlpha: 0,
        y: 32,
        scale: 0.92,
        filter: 'blur(6px) saturate(0.4)',
        duration: 0.4,
        ease: 'power3.in',
        stagger: {
            each: 0.05,
            from: 'start'
        }
    });

    timeline.to(blockElements, {
        boxShadow: '0 0 0 rgba(0,0,0,0)',
        duration: 0.2,
        ease: 'power1.in'
    }, '<');
}

// Animation for toast entrance - Elastic jump
export function animateToastIn(toastEl) {
    if (!toastEl || !hasGsap()) {
        return;
    }

    gsap.killTweensOf(toastEl);
    gsap.fromTo(toastEl,
        { opacity: 0, y: -20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' }
    );
}

// Animation for toast exit
export function animateToastOut(toastEl, onComplete) {
    if (!toastEl) {
        onComplete?.();
        return;
    }

    if (!hasGsap()) {
        onComplete?.();
        return;
    }

    gsap.killTweensOf(toastEl);
    gsap.to(toastEl, {
        opacity: 0,
        y: -12,
        scale: 0.95,
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => onComplete?.()
    });
}

// Animation for secondary day row entrance
export function animateSecondaryRowIn(rowEl) {
    if (!rowEl || !hasGsap()) {
        return;
    }

    gsap.killTweensOf(rowEl);
    gsap.fromTo(rowEl,
        { 
            opacity: 0, 
            y: -12, 
            scale: 0.98, 
            height: 0, 
            paddingTop: 0, 
            paddingBottom: 0, 
            marginTop: 0, 
            marginBottom: 0, 
            overflow: 'hidden',
            borderWidth: 0
        },
        { 
            opacity: 1, 
            y: 0, 
            scale: 1, 
            height: 'auto', 
            paddingTop: 12, 
            paddingBottom: 12, 
            marginTop: 0, 
            marginBottom: 0, 
            borderWidth: 1,
            duration: 0.6, 
            ease: 'power4.out', 
            clearProps: 'all' 
        }
    );
}

// Animation for secondary day row removal
export function animateSecondaryRowOut(rowEl, onComplete) {
    if (!rowEl) {
        onComplete?.();
        return;
    }

    if (!hasGsap()) {
        onComplete?.();
        return;
    }

    gsap.killTweensOf(rowEl);
    gsap.to(rowEl, {
        opacity: 0,
        y: -12,
        scale: 0.95,
        height: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        overflow: 'hidden',
        duration: 0.4,
        ease: 'power4.in',
        onComplete: () => onComplete?.()
    });
}

// Hover physics for interactive sidebar elements like schedule saves
export function bindInteractiveHover(element) {
    if (!element || !hasGsap()) return;
    
    element.addEventListener('mouseenter', () => {
        gsap.killTweensOf(element);
        gsap.to(element, { scale: 1.015, y: -1, duration: 0.3, ease: 'back.out(2)' });
    });
    
    element.addEventListener('mouseleave', () => {
        gsap.killTweensOf(element);
        gsap.to(element, { scale: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    });
}

// Press physics
export function bindInteractivePress(element) {
    if (!element || !hasGsap()) return;
    
    element.addEventListener('mousedown', () => {
        gsap.killTweensOf(element);
        gsap.to(element, { scale: 0.96, duration: 0.15, ease: 'power2.out' });
    });
    
    element.addEventListener('mouseup', () => {
        gsap.killTweensOf(element);
        gsap.to(element, { scale: 1.015, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
    });
    
    element.addEventListener('mouseleave', () => {
        // cleanup if dragging off
        gsap.to(element, { scale: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    });
}