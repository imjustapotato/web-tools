/* Import GSAP for animation library
* Houses mostly used anims in the app
* TODO: Improve Animation Selector on line 69 >
*/

import { gsap } from 'gsap';

// Checks if GSAP is loaded
export function hasGsap() {
    return typeof gsap !== 'undefined';
}

// Animation trigger for clickable elements
export function animatePressFeedback(targetEl) {
    if (!targetEl || !hasGsap()) {
        return;
    }

    gsap.killTweensOf(targetEl);
    gsap.fromTo(targetEl,
        { scale: 0.95 },
        { scale: 1, duration: 0.24, ease: 'back.out(2)' }
    );
}

// Animation trigger for modal entrance
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
    gsap.set(cardEl, { opacity: 0, y: -16, scale: 0.965 });
    gsap.to(modalEl, { opacity: 1, duration: 0.22, ease: 'power2.out' });
    gsap.to(cardEl, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' });
}

// Animation trigger for modal exit
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

    timeline.to(cardEl, { opacity: 0, y: 12, scale: 0.97, duration: 0.18, ease: 'power2.in' });
    timeline.to(modalEl, { opacity: 0, duration: 0.16, ease: 'power2.in' }, '<');
}

// Animation for color selector (The Highlight) | May need improvement
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
        highlight.style.opacity = '1';
        highlight.style.width = `${buttonRect.width}px`;
        highlight.style.height = `${buttonRect.height}px`;
        highlight.style.transform = `translate(${nextX}px, ${nextY}px)`;
        return;
    }

    gsap.to(highlight, {
        opacity: 1,
        x: nextX,
        y: nextY,
        width: buttonRect.width,
        height: buttonRect.height,
        duration: 0.28,
        ease: 'power3.out'
    });
}

// Helper to map standard background classes to glow colors for hover effects.
export function getBlockGlowColor(colorClass) {
    const hue = String(colorClass || '').replace(/^bg-/, '').split('-')[0];
    const glowMap = {
        emerald: 'rgba(16, 185, 129, 0.45)',
        cyan: 'rgba(6, 182, 212, 0.45)',
        indigo: 'rgba(99, 102, 241, 0.45)',
        purple: 'rgba(147, 51, 234, 0.45)',
        rose: 'rgba(244, 63, 94, 0.45)',
        amber: 'rgba(245, 158, 11, 0.45)',
        sky: 'rgba(14, 165, 233, 0.45)',
        lime: 'rgba(132, 204, 22, 0.45)',
        pink: 'rgba(236, 72, 153, 0.45)',
        teal: 'rgba(20, 184, 166, 0.45)',
        blue: 'rgba(59, 130, 246, 0.45)'
    };

    return glowMap[hue] || 'rgba(16, 185, 129, 0.45)';
}

// Bind hover interactions to a schedule block.
export function bindBlockHoverAnimation(blockEl, colorClass) {
    if (!blockEl) {
        return;
    }

    const glowColor = getBlockGlowColor(colorClass);

    const onEnter = () => {
        if (!hasGsap()) return;
        gsap.to(blockEl, {
            y: -2,
            scale: 1.01,
            boxShadow: `0 18px 32px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 0 18px ${glowColor}`,
            duration: 0.22,
            ease: 'power2.out'
        });
    };

    const onLeave = () => {
        if (!hasGsap()) return;
        gsap.to(blockEl, {
            y: 0,
            scale: 1,
            boxShadow: '0 0 0 rgba(0,0,0,0)',
            duration: 0.2,
            ease: 'power2.out'
        });
    };

    blockEl.addEventListener('mouseenter', onEnter);
    blockEl.addEventListener('mouseleave', onLeave);
}

// Animation for newly added blocks.
export function animateAddedBlocks(blockElements) {
    if (!hasGsap() || !Array.isArray(blockElements) || blockElements.length === 0) {
        return;
    }

    const timeline = gsap.timeline();
    timeline.fromTo(blockElements,
        {
            autoAlpha: 0,
            x: -10,
            y: -16,
            scale: 0.975,
            rotateX: -4,
            transformOrigin: '50% 100%',
            filter: 'saturate(1.12) blur(3px) brightness(0.95)'
        },
        {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotateX: 0,
            filter: 'saturate(1) blur(0px) brightness(1)',
            duration: 0.46,
            ease: 'power3.out',
            stagger: { each: 0.07 }
        }
    );

    timeline.fromTo(blockElements,
        {
            boxShadow: '0 0 0 rgba(0,0,0,0), 0 0 0 rgba(0,0,0,0)'
        },
        {
            boxShadow: '0 12px 24px rgba(2, 6, 23, 0.28), 0 0 12px rgba(148,163,184,0.14)',
            duration: 0.22,
            yoyo: true,
            repeat: 1,
            ease: 'power1.inOut',
            stagger: { each: 0.06 }
        },
        '-=0.24'
    );
}

// Animation for newly edited blocks.
export function animateEditedBlocks(editedEls) {
    if (!hasGsap() || !Array.isArray(editedEls) || editedEls.length === 0) {
        return;
    }

    gsap.fromTo(editedEls,
        { x: -2 },
        { x: 0, duration: 0.2, ease: 'power2.out', stagger: 0.025 }
    );
}

// Animation for a block being removed.
export function animateBlockExitAndRemove(blockEl, onComplete) {
    if (!blockEl || !hasGsap()) {
        onComplete?.();
        return;
    }

    gsap.killTweensOf(blockEl);
    const timeline = gsap.timeline({ onComplete: () => onComplete?.() });
    timeline.to(blockEl, {
        boxShadow: '0 0 8px rgba(255,255,255,0.14)',
        duration: 0.08,
        ease: 'power1.out'
    });
    timeline.to(blockEl, {
        autoAlpha: 0,
        x: 16,
        y: -7,
        scale: 0.965,
        filter: 'blur(2px) saturate(0.92)',
        duration: 0.18,
        ease: 'power2.in'
    }, '-=0.02');
}
