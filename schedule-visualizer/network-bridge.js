import { gsap } from 'gsap';

/**
 * NETWORK BRIDGE
 * Manages the TCP-like handshake protocol between the Web App and the Extension.
 * Displays a non-blocking GSAP overlay to indicate sync state, and relays validated payloads.
 */

const OVERLAY_ID = 'network-bridge-overlay';
let overlayEl = null;
let overlayTextEl = null;
let currentBlurTween = null;

function buildOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
        overlayEl = document.getElementById(OVERLAY_ID);
        overlayTextEl = overlayEl.querySelector('.bridge-text');
        return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    Object.assign(overlayEl.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '9999999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: 'rgba(2, 6, 23, 0.4)',
        backdropFilter: 'blur(0px)',
        opacity: '0',
        color: '#f8fafc',
        fontFamily: 'Outfit, sans-serif'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '24px 32px',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
    });

    const spinner = document.createElement('div');
    spinner.innerHTML = `<span class="iconify" data-icon="lucide:loader-2" style="font-size: 32px; color: #3b82f6; animation: spin 1s linear infinite;"></span>`;
    
    // Fallback animation style if not defined globally
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    overlayTextEl = document.createElement('div');
    overlayTextEl.className = 'bridge-text';
    Object.assign(overlayTextEl.style, {
        fontSize: '16px',
        fontWeight: '600',
        letterSpacing: '0.05em'
    });
    overlayTextEl.textContent = 'Probing Connection...';

    box.appendChild(spinner);
    box.appendChild(overlayTextEl);
    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);
}

function showOverlay(message) {
    if (!overlayEl) buildOverlay();
    overlayTextEl.textContent = message;
    
    if (currentBlurTween) currentBlurTween.kill();
    gsap.set(overlayEl, { display: 'flex' });
    currentBlurTween = gsap.to(overlayEl, {
        opacity: 1,
        backdropFilter: 'blur(12px)',
        duration: 0.4,
        ease: 'power2.out'
    });
}

function updateOverlayText(message) {
    if (!overlayEl || !overlayTextEl) return;
    
    gsap.to(overlayTextEl, {
        opacity: 0,
        y: -5,
        duration: 0.15,
        onComplete: () => {
            overlayTextEl.textContent = message;
            gsap.fromTo(overlayTextEl, 
                { opacity: 0, y: 5 }, 
                { opacity: 1, y: 0, duration: 0.25, ease: 'back.out(1.5)' }
            );
        }
    });
}

function hideOverlay() {
    if (!overlayEl) return;
    if (currentBlurTween) currentBlurTween.kill();
    
    currentBlurTween = gsap.to(overlayEl, {
        opacity: 0,
        backdropFilter: 'blur(0px)',
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => gsap.set(overlayEl, { display: 'none' })
    });
}

// Ensure the App is ready
window.addEventListener('load', () => {
    window.postMessage({ type: 'WEB_TOOLS_APP_READY' }, '*');
});

// Primary Handshake Listener
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_PROBE') {
        console.log('[Network Bridge] Received PROBE. Replying with ACK...');
        showOverlay('Connection Established. Preparing Data...');
        window.postMessage({ type: 'WEB_TOOLS_PROBE_ACK' }, '*');
    }

    if (event.data.type === 'WEB_TOOLS_EXTENSION_SYNC') {
        const payload = event.data.payload;
        const dataType = event.data.dataType;
        
        console.log('[Network Bridge] Received SYNC_DATA payload.');
        
        // Show overlay if it wasn't already triggered by a probe (e.g., initial load cache sync)
        if (!overlayEl || overlayEl.style.display === 'none') {
            showOverlay('Assembling Incoming Data...');
        } else {
            updateOverlayText('Assembling Data Structure...');
        }

        // 1. Reply to Extension: Clear Ephemeral Storage
        window.postMessage({ 
            type: 'WEB_TOOLS_SYNC_ACK',
            dataType: dataType
        }, '*');

        // 2. Unblur smoothly, THEN dispatch data to app logic
        setTimeout(() => {
            updateOverlayText('Finalizing...');
            
            // Allow text to animate, then unblur
            setTimeout(() => {
                hideOverlay();
                
                // Fire after unblur starts, so native GSAP logic is fully visible
                setTimeout(() => {
                    console.log('[Network Bridge] Dispatching PAYLOAD_READY event to app context.');
                    window.dispatchEvent(new CustomEvent('NETWORK_PAYLOAD_READY', {
                        detail: { payload, dataType }
                    }));
                }, 150);
            }, 500);

        }, 400); // Artificial delay to ensure user witnesses the "sync" event
    }
});