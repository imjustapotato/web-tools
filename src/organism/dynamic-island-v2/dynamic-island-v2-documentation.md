# Dynamic Island v2.0: Developer Documentation

Welcome to the **Dynamic Island v2.0**, a state-of-the-art, API-driven UI organism designed for **Extreme Reusability**. This module decouples logic from presentation, using **TypeScript/GSAP** as the physics engine and **Vanilla CSS** as the painter.

---

## 🏗️ Core Architecture

The organism is split into four distinct layers to ensure zero-collision animations and maximum flexibility:

| File | Responsibility |
| :--- | :--- |
| `types.ts` | **The API Contract**: Strict definitions for states, configs, and commands. |
| `dynamic-island.ts` | **The Controller**: DOM scaffolding, 8-point anchoring, and the Spotlight Queue. |
| `animation-engine.ts` | **The Physics Engine**: GSAP orchestration for morphing, layout, and particle math. |
| `dynamic-island.css` | **The Painter**: Backdrop filters, border-radius, and surface animation shaders. |

---

## 🚀 Getting Started

### 1. Initialization & Mounting
To use the Dynamic Island, instantiate the `DynamicIsland` class with a configuration object and mount it to the DOM.

```typescript
import { DynamicIsland } from './dynamic-island-v2/dynamic-island';

const island = new DynamicIsland({
    position: 'top-center', // Options: top-left, top-center, top-right, etc.
    offsetX: 0,
    offsetY: 10,
    defaultColor: '#3b82f6', // Initial theme color
    defaultTitle: 'System Ready',
    defaultSubtitle: 'Dynamic Island v2.0 Active'
});

// Mount to the body or a specific container
island.mount(document.body);
```

---

## 📝 State Management (The Spotlight Queue)

The Dynamic Island uses an **internal queue**. If you push multiple states at once, it will spotlight them one by one based on the `displayDuration`.

### Updating the UI
Use `setState()` to push new data to the island.

```typescript
island.setState({
    id: 'sync-active',
    title: 'Auto-Sync Active',
    subtitle: 'Monitoring Portal...',
    color: '#22d3ee', // Dynamic color injection
    surfaceAnimation: 'wiping', // Options: wiping, shimmer, scanline, beaming
    pulse: { speed: 0.6, count: 2, gap: 1.5 },
    displayDuration: 5000 // Spotlight for 5 seconds
});
```

### Expanded Mode
If a `description` is provided, the island will gracefully retract the indicator and expand its width to show more data.

```typescript
island.setState({
    id: 'detailed-alert',
    title: 'Security Alert',
    subtitle: 'Unauthorized Access',
    description: 'A login attempt was detected from a new IP address in FEU Alabang.',
    color: '#ef4444' // Error red
});
```

---

## 🌊 Particle Firing Engine (Water Droplets)

Particles are **independent** of the state queue. You can fire them at any time (e.g., during a data sync) without interrupting the current text display.

### Omni-Directional Beam Physics
The physics engine automatically calculates the trajectory based on the island's screen position.

```typescript
// From particle-firing-api.ts

// 1. Sending an Inbound Emoji (e.g., Reward System)
island.fireParticle({
    direction: 'inbound',
    type: 'emoji',
    content: '💙',
    color: '#3b82f6'
});

// 2. Sending an Outbound Sync Request (e.g., Data Packet)
island.fireParticle({
    direction: 'outbound',
    type: 'icon',
    content: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    color: '#10b981'
});
```

> [!TIP]
> You can call `.fireParticle()` rapidly to create a "chaotic flurry" of independent water droplets. They will all snap to the indicator perfectly while the underlying pill remains interactive.

---

## 🎨 Visual Customization

### Surface Animations
The `surfaceAnimation` property on the `IslandState` allows you to change the "feel" of the island:
* `wiping`: A subtle light sweep across the pill.
* `shimmer`: A continuous metallic glint.
* `scanline`: A horizontal data-style line moving vertically.
* `beaming`: A rhythmic glowing border and shadow pulse.

### Pulse Configurations
The `pulse` object allows for granular control over the indicator dot:
* `speed`: Seconds per ripple.
* `count`: Number of ripples per burst.
* `gap`: Pause duration between bursts.

---

## 🛠️ Integration Examples

The Dynamic Island is designed to be a "Global Feedback Bridge." Below are common patterns for integrating it into larger applications.

### 1. Global Event Bridge
Connect the Island to your app's event bus to show system-wide feedback without prop-drilling.

```typescript
window.addEventListener('app:notification', (event: CustomEvent) => {
    const { title, subtitle, type } = event.detail;
    
    island.setState({
        id: Date.now().toString(),
        title: title,
        subtitle: subtitle,
        color: type === 'error' ? '#ef4444' : '#3b82f6',
        surfaceAnimation: type === 'error' ? 'beaming' : 'wiping'
    });
});
```

### 2. Auth State Monitoring
Use the Island to provide premium feedback during login/logout flows.

```typescript
// On Login Success
island.setState({
    id: 'auth-success',
    title: 'Welcome Back, Kenneth!',
    subtitle: 'Session Synchronized',
    color: '#10b981',
    pulse: { speed: 0.4, count: 3, gap: 2 }
});

island.fireParticle({
    direction: 'inbound',
    type: 'emoji',
    content: '🔐',
    color: '#10b981'
});
```

### 3. Network & Connection Status
A classic use case for the "Pulse Dot" indicator.

```typescript
window.addEventListener('offline', () => {
    island.setState({
        id: 'network-offline',
        title: 'Connection Lost',
        subtitle: 'Retrying in background...',
        color: '#94a3b8',
        pulse: { speed: 2, count: 1, gap: 0.5 }
    });
});

window.addEventListener('online', () => {
    island.setState({
        id: 'network-online',
        title: 'Back Online',
        subtitle: 'Syncing local changes',
        color: '#10b981',
        displayDuration: 3000
    });
});
```

### 4. Progress Tracking (e.g., File Upload)
Use the surface animations to indicate background processing.

```typescript
function onUploadStart() {
    island.setState({
        id: 'upload-proc',
        title: 'Uploading Files',
        subtitle: 'Sending to Cloud Storage',
        surfaceAnimation: 'shimmer', // Visual "working" state
        displayDuration: 0 // Keep active until manual change
    });
}

function onUploadComplete() {
    island.setState({
        id: 'upload-done',
        title: 'Upload Complete',
        subtitle: '3 files secured',
        color: '#10b981',
        displayDuration: 4000
    });
}
```
