import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    /* 1. Page Initialization & Core GSAP Setup */
    document.body.classList.add('page-ready');

    /* 2. Hero Typing Animation Engine */
    const textElement = document.querySelector('.typing-text');
    const cursorElement = document.querySelector('.typing-cursor');
    const modules = [
        { text: "Block Tracking Events", color: "var(--txt-danger)" },
        { text: "Fake Tab Focus", color: "var(--txt-emphasis)" },
        { text: "Block Tab Switch Detection", color: "var(--txt-feature)" },
        { text: "Shield Page Handlers", color: "var(--txt-success)" },
        { text: "Spoof Active Animations", color: "var(--accent-2)" },
        { text: "Spoof Timer Throttling", color: "var(--txt-important)" },
        { text: "Block Cursor Tracking", color: "var(--accent-3)" }
    ];

    let moduleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeDelay = 100;

    function typeEffect() {
        const currentModule = modules[moduleIndex];
        const currentWord = currentModule.text;

        if (isDeleting) {
            textElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
            typeDelay = 40; // delete faster
        } else {
            textElement.textContent = currentWord.substring(0, charIndex + 1);
            textElement.style.color = currentModule.color;
            if (cursorElement) {
                cursorElement.style.backgroundColor = currentModule.color;
                cursorElement.style.boxShadow = `0 0 12px ${currentModule.color}`;
            }
            charIndex++;
            typeDelay = 100; // type normal speed
        }

        if (!isDeleting && charIndex === currentWord.length) {
            typeDelay = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            moduleIndex = (moduleIndex + 1) % modules.length;
            typeDelay = 500;
        }

        setTimeout(typeEffect, typeDelay);
    }

    if (textElement) {
        setTimeout(typeEffect, 1000);
    }

    /* 3. Centralized Image Fallback System */
    function createImageFallbackDataUrl(label) {
        const safeLabel = (label || 'Image unavailable')
            .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#1a1e2e" width="600" height="400"/><text fill="#4a5568" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">${safeLabel}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    document.querySelectorAll('.carousel-img').forEach((img) => {
        img.addEventListener('error', () => {
            if (img.dataset.fallbackApplied === 'true') return;
            img.dataset.fallbackApplied = 'true';
            img.src = createImageFallbackDataUrl(img.alt || 'Image unavailable');
        });
    });

    /* 4. Global Scroll-Triggered Reveal Logic */
    const revealElements = document.querySelectorAll('.gs-reveal');

    revealElements.forEach((elem) => {
        let initialState = { opacity: 0 };

        if (elem.classList.contains('step-card')) {
            if (elem.classList.contains('reverse')) {
                initialState.x = -80;
            } else {
                initialState.x = 80;
            }
        } else {
            initialState.y = 50;
        }

        gsap.set(elem, initialState);

        ScrollTrigger.create({
            trigger: elem,
            start: "top 88%",
            onEnter: () => gsap.to(elem, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: "power3.out", overwrite: "auto" }),
            onEnterBack: () => gsap.to(elem, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: "power3.out", overwrite: "auto" }),
            onLeaveBack: () => gsap.set(elem, initialState),
            onLeave: () => {
                if (!elem.classList.contains('hero-card')) {
                    gsap.set(elem, initialState);
                }
            }
        });
    });

    /* 5. Feature Card Directional Reveals */
    function resolveModuleCardInitialState(columnPosition) {
        if (columnPosition === 'left') return { x: -80, y: 0, opacity: 0 };
        if (columnPosition === 'right') return { x: 80, y: 0, opacity: 0 };
        return { x: 0, y: 60, opacity: 0 };
    }

    const moduleCards = document.querySelectorAll('.gs-module-card');

    moduleCards.forEach((card) => {
        const columnPosition = card.dataset.columnPosition || 'center';
        const initialState = resolveModuleCardInitialState(columnPosition);

        gsap.set(card, initialState);

        ScrollTrigger.create({
            trigger: card,
            start: 'top 88%',
            onEnter: () => gsap.to(card, { x: 0, y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', overwrite: 'auto' }),
            onEnterBack: () => gsap.to(card, { x: 0, y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', overwrite: 'auto' }),
            onLeaveBack: () => gsap.set(card, initialState),
            onLeave: () => gsap.set(card, initialState),
        });
    });

    /* 6. Parallax Carousel Engine (Depth & Motion) */
    const carousels = document.querySelectorAll('.carousel-container');

    carousels.forEach(container => {
        const track = container.querySelector('.carousel-track');
        const slides = container.querySelectorAll('.carousel-slide');
        const dotsContainer = container.querySelector('.carousel-dots');
        const prevBtn = container.querySelector('.nav-prev');
        const nextBtn = container.querySelector('.nav-next');

        if (slides.length <= 1) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            return;
        }

        let currentIndex = 0;
        let isAnimating = false;
        const autoplayInterval = 5000;
        let timer;

        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });

        const dots = dotsContainer.querySelectorAll('.dot');

        function goToSlide(index, direction = null) {
            if (isAnimating || index === currentIndex) return;
            isAnimating = true;

            const outgoingSlide = slides[currentIndex];
            const incomingSlide = slides[index];
            const outgoingImg = outgoingSlide.querySelector('.carousel-img');
            const incomingImg = incomingSlide.querySelector('.carousel-img');

            if (direction === null) {
                direction = index > currentIndex ? 1 : -1;
            }

            gsap.set(outgoingSlide, { zIndex: 1 });

            const tl = gsap.timeline({
                onComplete: () => {
                    isAnimating = false;
                    currentIndex = index;
                    updateDots();
                    resetTimer();
                    gsap.set(outgoingSlide, { display: 'none', opacity: 1, zIndex: 1 });
                    gsap.set(incomingSlide, { zIndex: 1 });
                }
            });

            gsap.set(incomingSlide, { display: 'block', xPercent: direction * 100, opacity: 1, zIndex: 2 });
            gsap.set(incomingImg, { xPercent: direction * 40 });

            tl.to(outgoingSlide, { xPercent: -direction * 30, opacity: 0.3, duration: 1.2, ease: "expo.inOut" })
                .to(outgoingImg, { xPercent: direction * 10, duration: 1.2, ease: "expo.inOut" }, 0)
                .to(incomingSlide, { xPercent: 0, duration: 1.2, ease: "expo.inOut" }, 0)
                .to(incomingImg, { xPercent: 0, duration: 1.2, ease: "expo.inOut" }, 0);
        }

        function nextSlide() {
            const nextIndex = (currentIndex + 1) % slides.length;
            goToSlide(nextIndex, 1);
        }

        function prevSlide() {
            const nextIndex = (currentIndex - 1 + slides.length) % slides.length;
            goToSlide(nextIndex, -1);
        }

        function updateDots() {
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function resetTimer() {
            clearInterval(timer);
            timer = setInterval(nextSlide, autoplayInterval);
        }

        nextBtn.addEventListener('click', nextSlide);
        prevBtn.addEventListener('click', prevSlide);

        slides.forEach((slide, i) => {
            if (i !== 0) gsap.set(slide, { xPercent: 100, display: 'none' });
            else gsap.set(slide, { xPercent: 0, zIndex: 1 });
        });

        resetTimer();
        container.addEventListener('mouseenter', () => clearInterval(timer));
        container.addEventListener('mouseleave', resetTimer);
    });

    /* 7. Clipboard Integration & Tooltip Feedback */
    const emailLinks = document.querySelectorAll('.email-link');

    emailLinks.forEach(link => {
        link.addEventListener('click', (evt) => {
            evt.preventDefault();
            const email = link.dataset.email || link.textContent.trim();

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(email).catch(() => { });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = email;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try { document.execCommand('copy'); } catch (e) { }
                document.body.removeChild(textarea);
            }

            const wrapper = link.closest('.email-wrapper');
            const tip = wrapper ? wrapper.querySelector('.email-tooltip') : null;
            if (tip) {
                tip.classList.add('show');
                tip.setAttribute('aria-hidden', 'false');
                setTimeout(() => { tip.classList.remove('show'); tip.setAttribute('aria-hidden', 'true'); }, 1200);
            }
        });
    });

    /* 8. Scroll Performance Throttling */
    let scrollTimeout;
    const utilityBody = document.body;

    window.addEventListener('scroll', () => {
        if (!scrollTimeout) {
            utilityBody.classList.add('is-scrolling');
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            utilityBody.classList.remove('is-scrolling');
            scrollTimeout = null;
        }, 150);
    }, { passive: true });

});
