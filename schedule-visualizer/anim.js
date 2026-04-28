/* Import GSAP for animation library
* Houses the animation engine
*/
import { gsap } from 'gsap';

/* 1. Animation Engine Utilities */
// Checks if GSAP is loaded
export function hasGsap() {
    return typeof gsap !== 'undefined';
}

/* 2. Global UI Feedback Animations */
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

/* 3. Modal & Overlay Animations */
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

/* 4. Color Logic Animations */
// v2.0 Color Selector: "Teleport & Snap" Target Lock
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

/* 5. Timetable Block Animations */
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
        const container = blockEl.parentElement;
        if (container && container.classList.contains('is-animating')) return;

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
        const container = blockEl.parentElement;
        if (container && container.classList.contains('is-animating')) return;

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

// Edit interaction - Card Flip & Ripple Ink
export function animateEditInteraction(editBtnEl, blockEl, colorClass, onComplete) {
    if (!blockEl || !hasGsap()) {
        onComplete?.();
        return;
    }

    const container = blockEl.parentElement;
    if (container) container.classList.add('is-animating');
    
    const glowColor = getBlockGlowColor(colorClass);

    // 1. RIPPLE INK
    const btnRect = editBtnEl.getBoundingClientRect();
    
    // Create ripple element
    const ripple = document.createElement('div');
    ripple.className = 'edit-ripple-ink';
    ripple.style.position = 'fixed';
    ripple.style.left = `${btnRect.left + btnRect.width / 2}px`;
    ripple.style.top = `${btnRect.top + btnRect.height / 2}px`;
    ripple.style.width = '40px';
    ripple.style.height = '40px';
    ripple.style.marginTop = '-20px';
    ripple.style.marginLeft = '-20px';
    ripple.style.borderRadius = '50%';
    ripple.style.backgroundColor = glowColor; // Use block's theme color
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '100'; // Ensure it's above the grid but below modal
    document.body.appendChild(ripple);

    // Animate ripple
    gsap.fromTo(ripple,
        { scale: 0, opacity: 0.8 },
        {
            scale: 45, // Enough to cover the screen
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            onComplete: () => ripple.remove()
        }
    );

    // Gather siblings and animate dimming
    const allBlocks = Array.from(container.querySelectorAll('.schedule-block'));
    const otherBlocks = allBlocks.filter(b => b !== blockEl);
    
    const tx = btnRect.left + btnRect.width / 2;
    const ty = btnRect.top + btnRect.height / 2;
    let maxDelay = 0;

    otherBlocks.forEach(block => {
        const rect = block.getBoundingClientRect();
        const bx = rect.left + rect.width / 2;
        const by = rect.top + rect.height / 2;
        const dx = bx - tx;
        const dy = by - ty;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Delay based on distance (ripple wave effect)
        const delay = distance * 0.0005;
        maxDelay = Math.max(maxDelay, delay);

        gsap.to(block, {
            opacity: 0.3,
            filter: 'blur(2px) saturate(0.4)',
            duration: 0.35,
            ease: 'power2.out',
            delay: delay
        });
    });

    // 2. CARD FLIP
    // Set perspective on block for 3D flip
    gsap.set(blockEl, { perspective: 800, transformStyle: 'preserve-3d' });

    const children = Array.from(blockEl.children);
    const totalAnimTime = Math.max(0.6, maxDelay + 0.35); // Flip takes 0.5s

    const tl = gsap.timeline({
        onComplete: () => {
            // Defer completion to let staggered animation finish
            gsap.delayedCall(Math.max(0, totalAnimTime - 0.5) + 0.1, () => {
                if (container) container.classList.remove('is-animating');
                onComplete?.();
                // Note: Siblings will be recovered later by recoverSiblingBlocks()
            });
        }
    });

    // Acknowledgment scale up & hide text
    tl.to(blockEl, { scale: 1.05, duration: 0.15 });
    tl.to(children, { opacity: 0, duration: 0.15 }, 0);
    
    // Flip to back (180deg)
    tl.to(blockEl, { 
        rotateY: 180, 
        boxShadow: `0 0 30px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.2) inset`,
        duration: 0.45, 
        ease: 'back.out(1.4)' 
    }, 0.1);
}

// Recover sibling blocks after edit modal closes
export function recoverSiblingBlocks(blockEl) {
    if (!blockEl || !hasGsap()) return;
    
    const container = blockEl.parentElement;
    if (!container) return;
    
    // Protect recovery animation from hover events
    container.classList.add('is-animating');
    
    const allBlocks = Array.from(container.querySelectorAll('.schedule-block'));
    const otherBlocks = allBlocks.filter(b => b !== blockEl);
    
    // Sort slightly randomly or just left-to-right for a nice recovery stagger
    gsap.to(otherBlocks, {
        opacity: 1,
        filter: 'blur(0px) saturate(1)',
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.02,
        clearProps: 'opacity,filter'
    });

    // Recover flipped block
    const children = Array.from(blockEl.children);
    const tl = gsap.timeline({
        onComplete: () => {
            gsap.set(blockEl, { clearProps: 'transform,boxShadow,transformStyle,perspective' });
            gsap.set(children, { clearProps: 'opacity' });
            container.classList.remove('is-animating');
        }
    });
    
    tl.to(blockEl, { 
        rotateY: 0, 
        scale: 1, 
        boxShadow: '0 0 0 rgba(0,0,0,0)',
        duration: 0.5, 
        ease: 'back.out(1.2)' 
    });
    tl.to(children, { opacity: 1, duration: 0.2 }, 0.2);
}

// Shockwave animation binded on hold - triggers edit modal
export function bindBlockHoldInteraction(blockEl, colorClass, onHoldComplete) {
    if (!blockEl || !hasGsap()) return;
    
    let holdTimer = null;
    let isHolding = false;
    let isAnimatingShockwave = false;
    
    const startHold = (e) => {
        // Ignore if clicking on the action buttons inside the block
        if (e.target.closest('button') || isAnimatingShockwave) return;
        
        isHolding = true;

        // 1. Pre-squish: Physical tell that it's charging
        gsap.to(blockEl, { scale: 0.94, duration: 0.2, ease: 'power2.out' });
        
        holdTimer = setTimeout(() => {
            if (!isHolding) return;
            isAnimatingShockwave = true;
            
            const glowColor = getBlockGlowColor(colorClass);
            const container = blockEl.parentElement;
            
            // Lock pointer events during chaos so we don't trigger phantom hovers
            if (container) container.classList.add('is-animating');

            const allBlocks = Array.from(container.querySelectorAll('.schedule-block'));
            const otherBlocks = allBlocks.filter(b => b !== blockEl);
            
            // Calculate origin point of the blast (Center of held block)
            const targetRect = blockEl.getBoundingClientRect();
            const tx = targetRect.left + targetRect.width / 2;
            const ty = targetRect.top + targetRect.height / 2;

            // Engine logic: Pre-calculate vectors, distance, and blast power for all other blocks
            const shockwaveData = otherBlocks.map(block => {
                const rect = block.getBoundingClientRect();
                const bx = rect.left + rect.width / 2;
                const by = rect.top + rect.height / 2;
                
                // Math time: Calculate distance and trajectory angle
                const dx = bx - tx;
                const dy = by - ty;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Blast decay physics: Closer blocks get yeeted harder (max 45px push, decays over distance)
                const pushStrength = Math.max(10, 45 - (distance * 0.04));
                
                return {
                    block,
                    distance,
                    pushX: Math.cos(angle) * pushStrength,
                    pushY: Math.sin(angle) * pushStrength,
                    rotation: (Math.random() - 0.5) * 8 // Sprinkle in some chaotic wobble
                };
            });

            // Sort by distance so the ripple moves perfectly outward
            shockwaveData.sort((a, b) => a.distance - b.distance);

            const tl = gsap.timeline({
                onComplete: () => {
                    if (container) container.classList.remove('is-animating');
                    isAnimatingShockwave = false;
                    isHolding = false;
                    onHoldComplete();
                }
            });

            // 2. BOOM. The Held block erupts.
            tl.to(blockEl, {
                scale: 1.1,
                boxShadow: `0 0 45px ${glowColor}, 0 0 0 12px rgba(255,255,255,0)`,
                duration: 0.3,
                ease: 'expo.out'
            }, 0);

            // Recover the held block with a satisfying elastic snap while the shockwave propagates
            tl.to(blockEl, {
                scale: 1,
                boxShadow: '0 0 0 rgba(0,0,0,0)',
                duration: 0.6,
                ease: 'elastic.out(1, 0.5)'
            }, 0.3);

            // 3. The Shockwave hits everything else
            shockwaveData.forEach((data) => {
                // Time delay scales exactly with distance to create an expanding wave front
                const delay = data.distance * 0.00035; 

                // Blast Outward
                tl.to(data.block, {
                    x: data.pushX,
                    y: data.pushY,
                    scale: 0.95, // Depth effect as they get bowled over
                    rotation: data.rotation,
                    duration: 0.2,
                    ease: 'power4.out'
                }, delay);

                // Rubber-band Snap Back
                tl.to(data.block, {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    duration: 0.6,
                    ease: 'elastic.out(1, 0.4)'
                }, delay + 0.15); // Trigger right as the outward push peaks
            });
            
        }, 400); // 400ms charge time
    };
    
    const cancelHold = (e) => {
        if (isAnimatingShockwave) return; // Cannot cancel a blast once the trigger is pulled
        
        isHolding = false;
        clearTimeout(holdTimer);
        
        // Recover from the pre-squish charge
        gsap.to(blockEl, { scale: 1, duration: 0.2, ease: 'power2.out' });
    };
    
    blockEl.addEventListener('mousedown', startHold);
    blockEl.addEventListener('touchstart', startHold, { passive: true });
    
    blockEl.addEventListener('mouseup', cancelHold);
    blockEl.addEventListener('mouseleave', cancelHold);
    blockEl.addEventListener('touchend', cancelHold);
    blockEl.addEventListener('touchcancel', cancelHold);
    
    // Nuke the context menu so long-press works cleanly without the browser interfering
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

/* 6. UI Component Animations */
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

// Animation for saved schedule item entrance 
export function animateSavedItemIn(itemEl) {
    if (!itemEl || !hasGsap()) return;

    gsap.killTweensOf(itemEl);
    gsap.fromTo(itemEl,
        { 
            opacity: 0, 
            y: -10, 
            scale: 0.95, 
            height: 0, 
            marginBottom: 0,
            overflow: 'hidden'
        },
        { 
            opacity: 1, 
            y: 0, 
            scale: 1, 
            height: 'auto', 
            marginBottom: 0, 
            duration: 0.5, 
            ease: 'power3.out', 
            clearProps: 'all' 
        }
    );
}

// Animation for saved schedule item removal
export function animateSavedItemOut(itemEl, onComplete) {
    if (!itemEl) {
        onComplete?.();
        return;
    }

    if (!hasGsap()) {
        onComplete?.();
        return;
    }

    gsap.killTweensOf(itemEl);
    gsap.to(itemEl, {
        opacity: 0,
        x: 20,
        scale: 0.9,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        overflow: 'hidden',
        duration: 0.4,
        ease: 'power3.inOut',
        onComplete: () => {
            onComplete?.();
        }
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