import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    // Trigger the animation when the page loads
    document.body.classList.add('page-ready');

    // Hero Section Animation
    const textElement = document.querySelector('.typing-text');
    const cursorElement = document.querySelector('.typing-cursor');
    const modules = [
        { text: "Auto Plotting (OSES)", color: "var(--txt-feature)" },
        { text: "Extract from COR", color: "var(--txt-important)" },
        { text: "Extract Curriculum (Pre-Requisite Mapping)", color: "var(--txt-emphasis)" },
        { text: "More to Come...", color: "var(--accent-2)" }
    ];

    let featureIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeDelay = 100;

    function typeEffect() {
        const currentModule = modules[featureIndex];
        const currentWord = currentModule.text;

        if (isDeleting) {
            // Remove a character
            textElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
            typeDelay = 40; // delete faster
        } else {
            // Add a character
            textElement.textContent = currentWord.substring(0, charIndex + 1);
            textElement.style.color = currentModule.color;
            if (cursorElement) {
                cursorElement.style.backgroundColor = currentModule.color;
                cursorElement.style.boxShadow = `0 0 12px ${currentModule.color}`;
            }
            charIndex++;
            typeDelay = 100; // type normal speed
        }

        // Handle word completion and deletion state.
        if (!isDeleting && charIndex === currentWord.length) {
            // Pause at the end of word
            typeDelay = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            // Move to next word
            isDeleting = false;
            featureIndex = (featureIndex + 1) % modules.length;
            typeDelay = 500; // pause before typing next word
        }

        setTimeout(typeEffect, typeDelay);
    }

    // Start typing loop
    if (textElement) {
        setTimeout(typeEffect, 1000);
    }
});