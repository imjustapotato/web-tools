import gsap from 'gsap';
import '@iconify/iconify';

// Tools Metadata Database
const toolsData = {
  "schedule-plotter": {
    kicker: "Planner",
    title: "Schedule Plotter",
    description: "Plot class schedules, check conflict matches, and spot overlaps or dead hours beforehand. Built local-first with support for local saves, JSON exports, and PNG image downloads. Seamlessly integrates with the companion extension for auto-plotting.",
    features: [
      "Visual weekly calendar grid",
      "Conflict and overlap indicators",
      "Save snapshots locally or export JSON",
      "Companion extension auto-plotting support"
    ],
    notIncluded: ["Convincing your 7 AM professor to move the class"],
    launchUrl: "/schedule-visualizer/",
    launchText: "Launch Plotter",
    theme: "theme-primary",
    previewType: "schedule",
    disabled: false,
    screenshots: [
      "./src/assets/screenshots/Schedule Plotter/visualizer.png",
      "./src/assets/screenshots/Schedule Plotter/visualizer-edit.png",
      "./src/screenshots/plotter.png",
      "./src/screenshots/plotter-new.png",
      "./src/screenshots/plotter-v2.3.1.png"
    ]
  },
  "portal-parser": {
    kicker: "Parser",
    title: "Pre-requisite Mapping",
    description: "Know your curriculum pre-requisites, plan ahead towards your target subjects like Capstone, Thesis, and OJT. Extracts and visualizes the pre-requisite tree from the portal's curriculum page, highlighting locked and unlocked subjects based on your current progress. Provides a Mermaid code export for easy sharing and documentation.",
    features: [
      "Interactive Graph visualization",
      "Extract curriculum from portal",
      "Highlight prerequisites",
      "Copy and paste generated Mermaid code"
    ],
    notIncluded: ["Taking the prerequisites for you"],
    launchUrl: "/portal-parser/",
    launchText: "Launch Parser",
    theme: "theme-secondary",
    previewType: "parser",
    disabled: false,
    screenshots: [
      "./src/assets/screenshots/Pre-Requisite Mapping/prereq.png",
      "./src/assets/screenshots/Pre-Requisite Mapping/prereq-tree.png",
      "./src/screenshots/mapping.png"
    ]
  },
  "active-page-utility": {
    kicker: "Extension",
    title: "Active-Page Utility",
    description: "A Browser Extension that spoofs the whitelisted domains as active tabs, preventing the detection of tab switches and backgrounding. Allowing you to change tabs without those websites knowing that you ever left their page, while you are doing something else. ;)",
    features: [
      "Bypass active tab checking",
      "Custom domain whitelist filtering",
      "Block Tab Switch Detection",
      "Frame host Detection for Cross Domains inside iFrames"
    ],
    notIncluded: ["Guaranteeing you won't get called on"],
    launchUrl: "/active-page-utility/",
    launchText: "View Extension Page",
    theme: "theme-tertiary",
    previewType: "utility",
    disabled: false,
    screenshots: [
      "./src/assets/screenshots/Active-Page Utility/apu.png",
      "./src/screenshots/APU-Home.png"
    ]
  },
  "companion-page": {
    kicker: "Extension",
    title: "Web Tools Companion",
    description: "A Companion Browser Extension that integrates with the web tools to provide enhanced features and seamless connectivity. Notably includes a live schedule sync as you add or drop subjects during enrollment, or extract those schedules from SAF and have them auto-plot in the Schedule Plotter web app.",
    features: [
      "Sync OSES schedule to plotter live",
      "Extract curriculum details in one click",
      "Floating Dynamic Island notifications",
      "Chromium and Firefox support"
    ],
    notIncluded: ["Securing you the last slot in the good professor's section"],
    launchUrl: "/companion-page/",
    launchText: "View Companion Page",
    theme: "theme-tertiary",
    previewType: "companion",
    disabled: false,
    screenshots: [
      "./src/assets/screenshots/Companion/companion.png",
      "./src/screenshots/companion-home.png"
    ]
  },
  "pka-toolkit": {
    kicker: "Reverse Engineering",
    title: "Tracer Toolkit",
    description: "An advanced reverse engineering and analysis suite for Cisco Packet Tracer (.pka/.pkt) activities. Utilizes a high-performance Rust core to decrypt Twofish/EAX-encrypted activity files into raw XML for direct modification, bypassing manual edits on hundreds of thousands of lines of configuration. Features native/cross-platform memory injection to bypass version checks, unlock restricted interfaces, prevent activity resets, and extract network topologies into interactive graphs.",
    features: [
      "Decrypt/Encrypt .pka/.pkt activities via Twofish EAX",
      "Process memory patches to unlock interfaces & bypass versions",
      "Prevent session resets on username/email credential changes",
      "Extract and map network topologies to Graphviz DOT graphs",
      "Cross-platform GUI (Tauri 2), CLI, and Web interfaces"
    ],
    notIncluded: ["A valid alibi for your Cisco instructor"],
    launchUrl: "/tracer-toolkit/",
    launchText: "Probably",
    theme: "theme-quaternary",
    previewType: "toolkit",
    disabled: false,
    launchDisabled: true,
    screenshots: [
      "./src/assets/screenshots/Tracer Toolkit/tracer-status.png",
      "./src/assets/screenshots/Tracer Toolkit/tracer-convert.png",
      "./src/assets/screenshots/Tracer Toolkit/tracer-inject.png",
      "./src/assets/screenshots/Tracer Toolkit/tracer-mod.png"
    ]
  }
};

// Select DOM Elements
const homeShell = document.querySelector('.home-shell');
const heroStage = document.getElementById('hub-stage');
const heroCardPanel = document.getElementById('hero-card-panel');
const previewPanel = document.getElementById('hub-preview-panel');
const dockItems = document.querySelectorAll('.dock-item');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let isFirstSelection = true;
let autoPeekIntervalId = null;
let autoPeekTimeoutId1 = null;
let autoPeekTimeoutId2 = null;

// Clear any active auto-peek timers
function stopAutoPeekTimer() {
  if (autoPeekIntervalId) {
    clearInterval(autoPeekIntervalId);
    autoPeekIntervalId = null;
  }
  if (autoPeekTimeoutId1) {
    clearTimeout(autoPeekTimeoutId1);
    autoPeekTimeoutId1 = null;
  }
  if (autoPeekTimeoutId2) {
    clearTimeout(autoPeekTimeoutId2);
    autoPeekTimeoutId2 = null;
  }
}

// Start auto-peek swapping cycle
function startAutoPeekTimer(visualCanvas) {
  stopAutoPeekTimer(); // Ensure no duplicates
  
  const stackLayers = visualCanvas.querySelectorAll('.stack-layer');
  if (stackLayers.length < 2) return;
  
  const mockupLayer = visualCanvas.querySelector('.layer-mockup');
  const screenshotsLayer = visualCanvas.querySelector('.layer-screenshots');
  
  function triggerSwapToScreenshots() {
    if (!mockupLayer || !screenshotsLayer) return;
    if (mockupLayer.classList.contains('active')) {
      mockupLayer.classList.remove('active');
      mockupLayer.classList.add('inactive');
      screenshotsLayer.classList.remove('inactive');
      screenshotsLayer.classList.add('active');
    }
  }
  
  function triggerSwapToMockup() {
    if (!mockupLayer || !screenshotsLayer) return;
    if (screenshotsLayer.classList.contains('active')) {
      screenshotsLayer.classList.remove('active');
      screenshotsLayer.classList.add('inactive');
      mockupLayer.classList.remove('inactive');
      mockupLayer.classList.add('active');
    }
  }

  // First peek: swap to screenshots after 3.5s, back to mockup at 7.5s (gives user time to understand)
  autoPeekTimeoutId1 = setTimeout(triggerSwapToScreenshots, 3500);
  autoPeekTimeoutId2 = setTimeout(triggerSwapToMockup, 7500);
  
  // Recurring peeks: repeat every 18s (swap to screenshots for 4s, then back)
  autoPeekIntervalId = setInterval(() => {
    triggerSwapToScreenshots();
    autoPeekTimeoutId2 = setTimeout(triggerSwapToMockup, 4000);
  }, 18000);
}

// Custom HTML mockup renderers
function getMockupHTML(type) {
  if (type === "schedule") {
    return `
      <div class="mockup-schedule">
        <div class="mockup-grid-header">
          <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div>
        </div>
        <div class="mockup-grid-body">
          <div class="mockup-block bg-emerald" style="grid-column: 1; grid-row: 2/5;">CCS101</div>
          <div class="mockup-block bg-cyan" style="grid-column: 2; grid-row: 4/7;">GED102</div>
          <div class="mockup-block bg-emerald" style="grid-column: 3; grid-row: 2/5;">CCS101</div>
          <div class="mockup-block bg-purple" style="grid-column: 4; grid-row: 3/5;">CCS103</div>
          <div class="mockup-block bg-rose conflict" style="grid-column: 5; grid-row: 3/6;">CONFLICT</div>
        </div>
      </div>
    `;
  }

  if (type === "parser") {
    return `
      <div class="mockup-parser">
        <svg class="parser-svg-overlay">
          <line x1="28%" y1="20%" x2="50%" y2="50%" stroke="rgba(82, 227, 172, 0.4)" stroke-width="2" />
          <line x1="72%" y1="20%" x2="50%" y2="50%" stroke="rgba(255, 255, 255, 0.15)" stroke-width="2" />
          <line x1="50%" y1="50%" x2="50%" y2="80%" stroke="rgba(255, 255, 255, 0.15)" stroke-width="2" />
        </svg>
        <div class="parser-row">
          <div class="mockup-node active">CCS101</div>
          <div class="mockup-node locked">MATH101</div>
        </div>
        <div class="parser-row">
          <div class="mockup-node active">CCS102</div>
        </div>
        <div class="parser-row">
          <div class="mockup-node locked">CCS103</div>
        </div>
      </div>
    `;
  }

  if (type === "utility") {
    return `
      <div class="mockup-browser">
        <div class="browser-header">
          <div class="browser-dots">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
          <div class="browser-address">feu.instructure.com</div>
        </div>
        <div class="browser-body">
          <div class="utility-pulse-ring"></div>
          <div class="utility-status">
            <span class="iconify" data-icon="mdi:shield-check"></span>
            <span>Tab Spoof Active</span>
          </div>
        </div>
      </div>
    `;
  }

  if (type === "companion") {
    return `
      <div class="mockup-companion">
        <div class="companion-island">
          <div class="island-logo"></div>
          <div class="island-text">Connected to Web Tools</div>
        </div>
        <div class="companion-sync">
          <div class="sync-dot"></div>
        </div>
      </div>
    `;
  }

  if (type === "toolkit") {
    return `
      <div class="mockup-terminal">
        <div class="terminal-header">pka-toolkit-cli</div>
        <div class="terminal-body">
          <div class="line"><span class="prompt">$</span> pka-toolkit --sniff</div>
          <div class="line success">[OK] Interface online: eth0</div>
          <div class="line info">[PKT] Recv TCP len: 128 (AES-256)</div>
          <div class="line warning">[DEC] Decrypting payload...</div>
          <div class="line success">[DATA] Decrypted: "Hello World"</div>
        </div>
      </div>
    `;
  }
  return "";
}

// Update Preview DOM elements
function updatePreviewContent(toolId, data) {
  // Update theme class on preview panel
  previewPanel.className = `hub-preview ${data.theme} theme-${toolId}`;

  // Update kicker, title, description
  document.getElementById('prev-kicker').textContent = data.kicker;
  document.getElementById('prev-title').textContent = data.title;
  document.getElementById('prev-desc').textContent = data.description;

  // Render features and not-included items
  const featuresList = document.getElementById('prev-features');
  const featuresHTML = data.features.map(feat => `<li>${feat}</li>`).join('');
  const notIncludedHTML = (data.notIncluded || []).map(item => `<li class="not-included">${item}</li>`).join('');
  featuresList.innerHTML = featuresHTML + notIncludedHTML;

  // Render platform badges
  const tagsContainer = document.getElementById('prev-tags');

  // Retrieve version and platforms dynamically from the active dock item's tooltip
  const dockItem = document.querySelector(`.dock-item[data-tool="${toolId}"]`);
  const tooltipMeta = dockItem ? dockItem.querySelector('.tooltip-meta') : null;

  let version = data.disabled ? "Coming Soon" : "v1.0.0";
  let platforms = ["Web"];

  if (tooltipMeta) {
    const metaParts = tooltipMeta.textContent.split('•');
    version = metaParts[0].trim();
    if (metaParts[1]) {
      platforms = metaParts[1].split(',').map(p => p.trim());
    }
  }

  // Inject dynamic tags and version tag
  tagsContainer.innerHTML = `
    <span class="platform-tag" style="border-color: rgba(255, 255, 255, 0.25); font-weight: 900; color: #fff;">${version}</span>
    ${platforms.map(plat => `<span class="platform-tag">${plat}</span>`).join('')}
  `;

  // Update launch button action
  const launchBtn = document.getElementById('prev-launch-btn');
  const launchText = document.getElementById('prev-launch-text');

  launchBtn.href = data.launchUrl;
  launchText.textContent = data.launchText;

  if (data.disabled || data.launchDisabled) {
    launchBtn.classList.add('btn-disabled');
    launchBtn.setAttribute('aria-disabled', 'true');
    launchBtn.style.pointerEvents = 'none';
  } else {
    launchBtn.classList.remove('btn-disabled');
    launchBtn.removeAttribute('aria-disabled');
    launchBtn.style.pointerEvents = 'auto';
  }

  // Render Visual Mockup or Stack
  const visualCanvas = document.getElementById('prev-visual-canvas');
  stopAutoPeekTimer(); // Always clear previous timers on swap
  
  if (data.screenshots && data.screenshots.length > 0) {
    visualCanvas.innerHTML = `
      <div class="visual-stack">
        <!-- Mockup Layer -->
        <div class="stack-layer layer-mockup active" data-layer="mockup">
          ${getMockupHTML(data.previewType)}
          <div class="inactive-indicator-badge">
            <span class="iconify" data-icon="mdi:cursor-default-click-outline"></span>
            <span>Click to Swap</span>
          </div>
        </div>
        <!-- Screenshots Layer -->
        <div class="stack-layer layer-screenshots inactive" data-layer="screenshots">
          <div class="screenshot-window">
            <div class="screenshot-window-header">
              <div class="window-dots">
                <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
              </div>
              <div class="window-title">${data.title}</div>
              <button class="window-zoom-btn" id="screenshot-zoom-trigger" aria-label="Open fullscreen screenshot">
                <span class="iconify" data-icon="mdi:fullscreen"></span>
              </button>
            </div>
            <div class="screenshot-carousel">
              <div class="carousel-track">
                ${data.screenshots.map((src, idx) => `
                  <div class="carousel-slide ${idx === 0 ? 'active' : ''}" data-slide="${idx}">
                    <img src="${src}" alt="${data.title} Screenshot ${idx + 1}" loading="lazy">
                  </div>
                `).join('')}
              </div>
              <button class="carousel-btn btn-prev" aria-label="Previous screenshot">
                <span class="iconify" data-icon="mdi:chevron-left"></span>
              </button>
              <button class="carousel-btn btn-next" aria-label="Next screenshot">
                <span class="iconify" data-icon="mdi:chevron-right"></span>
              </button>
              <div class="carousel-dots">
                ${data.screenshots.map((_, idx) => `
                  <button class="carousel-dot ${idx === 0 ? 'active' : ''}" data-dot="${idx}" aria-label="Go to screenshot ${idx + 1}"></button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="inactive-indicator-badge">
            <span class="iconify" data-icon="mdi:cursor-default-click-outline"></span>
            <span>Click to Swap</span>
          </div>
        </div>
      </div>
    `;

    // Layer Swapping Logic
    const stackLayers = visualCanvas.querySelectorAll('.stack-layer');
    stackLayers.forEach(layer => {
      layer.addEventListener('click', (e) => {
        if (layer.classList.contains('inactive')) {
          stopAutoPeekTimer(); // Stop auto-swapping permanently once user interacts
          stackLayers.forEach(l => {
            l.classList.remove('active');
            l.classList.add('inactive');
          });
          layer.classList.remove('inactive');
          layer.classList.add('active');
          e.stopPropagation();
        }
      });
    });

    // Carousel Slide Navigation Logic
    const screenshotsLayer = visualCanvas.querySelector('.layer-screenshots');
    if (screenshotsLayer) {
      let currentSlideIndex = 0;
      const slides = screenshotsLayer.querySelectorAll('.carousel-slide');
      const dots = screenshotsLayer.querySelectorAll('.carousel-dot');
      
      function showSlide(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;
        currentSlideIndex = index;
        
        slides.forEach((slide, idx) => {
          slide.classList.toggle('active', idx === currentSlideIndex);
        });
        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === currentSlideIndex);
        });
      }
      
      const prevBtn = screenshotsLayer.querySelector('.btn-prev');
      const nextBtn = screenshotsLayer.querySelector('.btn-next');
      
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showSlide(currentSlideIndex - 1);
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showSlide(currentSlideIndex + 1);
        });
      }
      
      dots.forEach((dot, idx) => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          showSlide(idx);
        });
      });

      // Fullscreen Zoom/Lightbox Triggers
      const zoomTrigger = screenshotsLayer.querySelector('#screenshot-zoom-trigger');
      const carouselTrack = screenshotsLayer.querySelector('.carousel-track');

      function handleImageZoom(e) {
        e.stopPropagation();
        if (screenshotsLayer.classList.contains('active')) {
          stopAutoPeekTimer(); // Stop peek on lightbox open
          const activeImg = screenshotsLayer.querySelector('.carousel-slide.active img');
          if (activeImg) {
            openLightbox(activeImg.src);
          }
        }
      }

      if (zoomTrigger) {
        zoomTrigger.addEventListener('click', handleImageZoom);
      }
      if (carouselTrack) {
        carouselTrack.addEventListener('click', handleImageZoom);
      }
    }

    // Start auto-peek teasers
    startAutoPeekTimer(visualCanvas);

  } else {
    // Graceful degradation: render single interactive mockup
    visualCanvas.innerHTML = `
      <div class="mockup-standalone">
        ${getMockupHTML(data.previewType)}
      </div>
    `;
  }
}

// First selection: slide the centered stage to the top and reveal the card.
// Uses a FLIP (First-Last-Invert-Play) so only a transform animates — the glass
// backdrops stay crisp at rest and never re-rasterize their blur per frame.
function openHub(toolId, data) {
  // FIRST: record the stage position while still centered
  const firstTop = heroStage.getBoundingClientRect().top;

  // Apply the final layout instantly: stage to top, hero to compact header,
  // card enters the flow. Glass is swapped for its flat fallback during motion.
  homeShell.classList.add('is-animating');
  homeShell.classList.remove('centered');
  updatePreviewContent(toolId, data);

  // Reduced motion: snap to the final state, no slide.
  if (prefersReducedMotion) {
    homeShell.classList.remove('is-animating');
    heroCardPanel.classList.add('is-visible');
    return;
  }

  // LAST + INVERT: measure the settled position and offset the stage back up
  const lastTop = heroStage.getBoundingClientRect().top;
  heroStage.style.transform = `translateY(${firstTop - lastTop}px)`;

  // PLAY: release the offset next frame so it eases to its resting position
  requestAnimationFrame(() => {
    heroStage.style.transition = 'transform 0.55s cubic-bezier(0.25, 1, 0.3, 1)';
    heroStage.style.transform = 'translateY(0)';
  });

  // SETTLE: restore the glass and fade the card in once the slide finishes
  let hasSettled = false;
  const settle = () => {
    if (hasSettled) return;
    hasSettled = true;
    heroStage.removeEventListener('transitionend', onStageEnd);
    heroStage.style.transition = '';
    heroStage.style.transform = '';
    homeShell.classList.remove('is-animating');
    heroCardPanel.classList.add('is-visible');
  };
  const onStageEnd = (event) => {
    if (event.target === heroStage && event.propertyName === 'transform') settle();
  };
  heroStage.addEventListener('transitionend', onStageEnd);
  setTimeout(settle, 650); // fallback if transitionend never fires

}

// Reverse the open: slide the stage back to centered and hide the card.
// Uses the same FLIP technique as openHub so only a transform animates.
function closeHub() {
  // FIRST: record the stage position while at the top
  const firstTop = heroStage.getBoundingClientRect().top;

  // Apply the centered layout instantly
  homeShell.classList.add('is-animating');
  homeShell.classList.add('centered');
  heroCardPanel.classList.remove('is-visible');

  // Reset dock active states
  dockItems.forEach(item => item.classList.remove('active'));

  // Reduced motion: snap to final state, no slide.
  if (prefersReducedMotion) {
    homeShell.classList.remove('is-animating');
    return;
  }

  // LAST + INVERT: measure the settled centered position and offset
  const lastTop = heroStage.getBoundingClientRect().top;
  heroStage.style.transform = `translateY(${firstTop - lastTop}px)`;

  // PLAY: release the offset so it eases back to centered
  requestAnimationFrame(() => {
    heroStage.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.3, 1)';
    heroStage.style.transform = 'translateY(0)';
  });

  // SETTLE: restore glass and clean up
  let hasSettled = false;
  const settle = () => {
    if (hasSettled) return;
    hasSettled = true;
    heroStage.removeEventListener('transitionend', onStageEnd);
    heroStage.style.transition = '';
    heroStage.style.transform = '';
    homeShell.classList.remove('is-animating');
    isFirstSelection = true;
  };
  const onStageEnd = (event) => {
    if (event.target === heroStage && event.propertyName === 'transform') settle();
  };
  heroStage.addEventListener('transitionend', onStageEnd);
  setTimeout(settle, 600); // fallback
}

// Cross-fade the preview body when the card is already open
function swapPreview(toolId, data) {
  gsap.to(".preview-content-wrap", {
    opacity: 0,
    y: 10,
    scale: 0.98,
    duration: 0.25,
    ease: "power2.out",
    onComplete: () => {
      updatePreviewContent(toolId, data);
      gsap.to(".preview-content-wrap", {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.45,
        ease: "power2.out"
      });
    }
  });
}

// Select Tool Trigger Handler
function selectTool(toolId) {
  const data = toolsData[toolId];
  if (!data) return;

  // Update active state in dock items
  dockItems.forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tool') === toolId);
  });

  if (isFirstSelection) {
    isFirstSelection = false;
    openHub(toolId, data);
  } else {
    swapPreview(toolId, data);
  }
}

// Set up Dock Item Click Event Listeners
const dockSelectButtons = document.querySelectorAll('.dock-select-btn');
dockSelectButtons.forEach(button => {
  const parentItem = button.closest('.dock-item');
  const toolId = parentItem.getAttribute('data-tool');
  button.addEventListener('click', () => selectTool(toolId));
});

// Render Mobile Fallback Tool Grid dynamically
function renderMobileToolGrid() {
  const toolGrid = document.querySelector('#mobile-layout-container .tool-grid');
  if (!toolGrid) return;

  toolGrid.innerHTML = Object.keys(toolsData).map(toolId => {
    const data = toolsData[toolId];
    const dockItem = document.querySelector(`.dock-item[data-tool="${toolId}"]`);
    const tooltipMeta = dockItem ? dockItem.querySelector('.tooltip-meta') : null;

    let version = data.disabled ? "Coming Soon" : "v1.0.0";
    if (tooltipMeta) {
      const metaParts = tooltipMeta.textContent.split('•');
      version = metaParts[0].trim();
    }

    const themeName = data.theme.replace('theme-', '');
    const isCardDisabled = data.disabled || data.launchDisabled;
    const disabledAttr = isCardDisabled ? 'aria-disabled="true" tabindex="-1"' : '';
    const disabledClass = isCardDisabled ? 'disabled' : '';

    return `
      <a href="${data.launchUrl}" class="tool-card tool-card-${themeName} ${disabledClass}" ${disabledAttr} aria-label="${data.title}">
        <span class="tool-badge">${version}</span>
        <strong>${data.title}</strong>
        <span class="tool-description">${data.description}</span>
      </a>
    `;
  }).join('');
}

// Initialize Mobile Grid Layout on Page Load
renderMobileToolGrid();

// Global Fullscreen Lightbox Controller
const globalLightbox = document.getElementById('global-lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src) {
  if (!globalLightbox || !lightboxImg) return;
  lightboxImg.src = src;
  globalLightbox.classList.add('is-open');
  globalLightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  if (!globalLightbox || !lightboxImg) return;
  globalLightbox.classList.remove('is-open');
  globalLightbox.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    lightboxImg.src = "";
  }, 300);
}

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

if (globalLightbox) {
  globalLightbox.addEventListener('click', (e) => {
    if (e.target === globalLightbox) {
      closeLightbox();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && globalLightbox && globalLightbox.classList.contains('is-open')) {
    closeLightbox();
  }
});

// Click the collapsed hero-intro pill to revert to centered state
const heroIntro = document.getElementById('hero-intro-content');
heroIntro.addEventListener('click', () => {
  // Only act when the card is open (not centered) and not mid-animation
  if (!homeShell.classList.contains('centered') && !homeShell.classList.contains('is-animating')) {
    closeHub();
  }
});

// Proactively reveal page layout on load
document.body.classList.add('page-ready');
