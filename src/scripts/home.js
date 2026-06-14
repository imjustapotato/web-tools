import gsap from 'gsap';

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
    launchUrl: "/schedule-visualizer/",
    launchText: "Launch Plotter",
    theme: "theme-primary",
    previewType: "schedule",
    disabled: false
  },
  "portal-parser": {
    kicker: "Parser",
    title: "Pre-requisite Mapping",
    description: "Upload your program curriculum HTML/MHTML files to parse and map subject prerequisites into an interactive SVG node graph. Can copy generated Mermaid code directly or use the companion extension to auto-scrape program details without manual uploads.",
    features: [
      "Interactive SVG graph visualization",
      "Auto-extract curriculum from portal",
      "Filter and highlight prerequisites",
      "Copy and paste generated Mermaid code"
    ],
    launchUrl: "/portal-parser/",
    launchText: "Launch Parser",
    theme: "theme-secondary",
    previewType: "parser",
    disabled: false
  },
  "active-page-utility": {
    kicker: "Extension",
    title: "Active-Page Utility",
    description: "A lightweight browser extension that spoofs whitelisted domains (specifically designed for OSES) to be active. Prevents pages from detecting inactivity or triggering automated logouts when navigating other tabs.",
    features: [
      "Bypass active tab checking",
      "Custom domain whitelist filtering",
      "Low memory background footprint",
      "Prevents automated logout triggers"
    ],
    launchUrl: "/active-page-utility/",
    launchText: "View Extension Page",
    theme: "theme-tertiary",
    previewType: "utility",
    disabled: false
  },
  "companion-page": {
    kicker: "Extension",
    title: "Web Tools Companion",
    description: "Companion browser extension that enhances web tools with real-time integrations. Automatically syncs OSES enrollments to the schedule plotter live, scrapes program requirements, and triggers floating Dynamic Island notifications.",
    features: [
      "Sync OSES schedule to plotter live",
      "Extract curriculum details in one click",
      "Floating Dynamic Island notifications",
      "Chromium and Firefox support"
    ],
    launchUrl: "/companion-page/",
    launchText: "View Companion Page",
    theme: "theme-tertiary",
    previewType: "companion",
    disabled: false
  },
  "pka-toolkit": {
    kicker: "Reverse Engineering",
    title: "Tracer Toolkit",
    description: "A secure packet analysis, decryption, and protocol debugging toolkit. Supports in-memory decryption filters, low-overhead packet capture parsing, and interfaces via a cross-platform Native & Web GUI or CLI.",
    features: [
      "In-memory decryption filters",
      "Cross-platform Native & Web GUI",
      "Interactive Command Line Interface",
      "Low-overhead packet capture parsing"
    ],
    launchUrl: "#",
    launchText: "Coming Soon",
    theme: "theme-quaternary",
    previewType: "toolkit",
    disabled: true
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
          <div class="browser-address">oses.feutech.edu.ph</div>
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
          <div class="island-text">Connected to OSES</div>
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

  // Render features list
  const featuresList = document.getElementById('prev-features');
  featuresList.innerHTML = data.features.map(feat => `<li>${feat}</li>`).join('');

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

  if (data.disabled) {
    launchBtn.classList.add('btn-disabled');
    launchBtn.setAttribute('aria-disabled', 'true');
    launchBtn.style.pointerEvents = 'none';
  } else {
    launchBtn.classList.remove('btn-disabled');
    launchBtn.removeAttribute('aria-disabled');
    launchBtn.style.pointerEvents = 'auto';
  }

  // Render Visual Mockup
  const visualCanvas = document.getElementById('prev-visual-canvas');
  visualCanvas.innerHTML = getMockupHTML(data.previewType);
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
dockItems.forEach(item => {
  const toolId = item.getAttribute('data-tool');
  item.addEventListener('click', () => selectTool(toolId));
});

// Proactively reveal page layout on load
document.body.classList.add('page-ready');
