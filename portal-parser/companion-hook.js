/**
 * This script handles all communications to my companion extension such as,
 * managing the connection handshake, status UI updates, and incoming curriculum data syncs.
 */

const CURRICULUM_CACHE_KEY = 'portal_parser_curriculum_cache';
let hasLoadedFromSync = false;

// Initialize the parser from cache if available
// We use DOMContentLoaded and a small timeout to ensure the main script.js and Mermaid are ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (hasLoadedFromSync) return; 

        const cachedData = sessionStorage.getItem(CURRICULUM_CACHE_KEY);
        if (cachedData && typeof window.parseAndRender === 'function') {
            console.log("[Companion Hook] Restoring curriculum from session cache...");
            window.parseAndRender(cachedData).catch(err => {
                console.error("[Companion Hook] Failed to render from cache:", err);
            });
        }
    }, 100); 

    // Wire up the reset button to also clear the session cache
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            sessionStorage.removeItem(CURRICULUM_CACHE_KEY);
            console.log("[Companion Hook] Curriculum session cache cleared.");
        });
    }
});

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_TOOLS_EXTENSION_SYNC') {
        const { payload, dataType } = event.data;

        if (dataType === 'CURRICULUM' && payload) {
            console.log("[Companion Hook] Received curriculum data. Preparing for safe reload...");
            hasLoadedFromSync = true;
            
            // 1. Buffer the data to session cache
            sessionStorage.setItem(CURRICULUM_CACHE_KEY, payload);
            
            // 2. Acknowledge the sync so the extension can clear its ephemeral storage
            window.postMessage({ 
                type: 'WEB_TOOLS_SYNC_ACK',
                dataType: 'CURRICULUM'
            }, '*');

            // 3. Perform a full reload to ensure a clean slate for the parsing engine
            // We use a tiny delay to ensure the ACK message is dispatched first
            setTimeout(() => {
                window.location.reload();
            }, 50);
        }
    }
});
