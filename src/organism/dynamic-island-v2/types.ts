/**
 * Dynamic Island v2.0 - API Contract
 * Define how the organism behaves, its visual state, and its physics.
 */

export type IslandPosition = 
    | 'top-left' 
    | 'top-center' 
    | 'top-right' 
    | 'bottom-left' 
    | 'bottom-center' 
    | 'bottom-right' 
    | 'center-left' 
    | 'center-right';

/**
 * Initial configuration for bootstrapping the Island organism.
 */
export interface IslandConfig {
    position: IslandPosition; /** Target anchor point on the viewport */
    offsetX?: number; /** Horizontal nudge from the anchor point (px) */
    offsetY?: number; /** Vertical nudge from the anchor point (px) */
    defaultTitle?: string; /** Text shown in the primary title slot by default */
    defaultSubtitle?: string; /** Text shown in the secondary subtitle slot by default */
    defaultColor?: string; /** HEX color for the pill's theme and glow */
    defaultIcon?: string; /** SVG markup or Emoji for the default indicator */
    defaultPulse?: PulseConfig; /** Default ripple pulse configuration */
    interactive?: boolean; /** Enable tactile GSAP hover feedback and cursor pointers */
    onClick?: () => void;  /** Global click handler for the island pill (Legacy, prefer interactivity.onClick) */
    debug?: boolean;       /** Enable verbose console logging for queue processing and physics events */
    useShadowDOM?: boolean; /** Use Shadow DOM for style encapsulation (Defaults to true) */
    alwaysSentry?: boolean; /** Global default: Return to sentry (icon-only) mode after states finish */
}

/** 
 * Interactivity Action Definition 
 * Defines what happens when a user clicks or hovers the island.
 */
export interface InteractivityAction {
    type: 'link' | 'particle' | 'payload' | 'animation' | 'expand' | 'callback';
    url?: string; // For 'link'
    particleCommand?: ParticleCommand; // For 'particle'
    payload?: IslandState; // For 'payload'
    animation?: 'breathe' | 'color' | 'squish'; // For 'animation'
    value?: string | number; // General value (e.g. color hex)
    handler?: () => void; // For 'callback'
}

/**
 * Event-driven interactivity configuration
 */
export interface InteractivityConfig {
    onClick?: InteractivityAction[];
    onHover?: InteractivityAction[];
    onLeave?: InteractivityAction[];
}

/** Shaders and surface effects applied to the background proxy layer */
export type SurfaceAnimation = 'none' | 'wiping' | 'shimmer' | 'scanline' | 'beaming' | 'pulse';

/** Text transition styles for entering/exiting content */
export type TextAnimation = 'fade' | 'slide-up' | 'slide-down' | 'blur' | 'scale' | 'none';

/**
 * A discrete visual state to be queued and displayed by the island.
 */
export interface IslandState {
    id: string; /** Unique identifier for the state (prevents duplicate consecutive pushes) */
    title: string; /** Primary heading text */
    subtitle: string; /** Secondary text or status line */
    description?: string; /** Detailed body text (Triggers "Expanded" mode if present) */
    color?: string; /** Theme color for this specific state. Overrides defaultColor. */
    icon?: string; /** Icon markup/emoji for this specific state. Overrides defaultIcon. */
    pulse?: PulseConfig; /** Ripple pulse override for this state. */
    surfaceAnimation?: SurfaceAnimation; /** Surface shader override for this state. */
    breathe?: boolean; /** Enable the GSAP breath timeline (pulsing scale and glow) */
    breatheColor?: string; /** Specific color for the breath glow (Defaults to state color) */
    breatheSpeed?: number; /** Duration of a full breath cycle in seconds */
    displayDuration?: number; /** How long to hold this state before clearing (ms). 0 = use system default (3s). */
    
    // Text Swapping & Graceful Transitions
    textAnimation?: TextAnimation; /** Preset for how text swaps (Defaults to 'slide-up') */
    textDuration?: number; /** Duration of the text swap animation (ms) */

    // Advanced Queue Logic
    /** 
     * Priority Level: 
     * 0 = Normal (Queued)
     * 1 = Critical (Interrupts current state, wipes queue, and displays immediately)
     */
    priority?: number; 
    
    /** If true, the island won't auto-clear this state. Stays until a new state is pushed. */
    persist?: boolean;
    /** Force-clears the queue before adding this state, even if priority is 0. */
    skipQueue?: boolean; 
    
    // Sentry & Interactivity
    /** If true, the island returns to icon-only "Sentry" mode after displayDuration, even if persist is true. */
    alwaysSentry?: boolean;
    /** Interactive actions for click, hover, etc. */
    interactivity?: InteractivityConfig;
}

/** Commands for firing one-off physics particles from the island hub */
export interface ParticleCommand {
    /** outbound (from island to screen) or inbound (from screen to island) */
    direction: 'outbound' | 'inbound';
    /** Content type: 'icon' (expects SVG) or 'emoji' (expects string) */
    type: 'icon' | 'emoji';
    /** The actual content (SVG path or Emoji character) */
    content: string;
    /** Theme color for the particle trail and impact glow */
    color: string;
    /** Optional: Override the pill's theme color PERMANENTLY after the interaction */
    pillColor?: string;
    /** Optional: Flash the pill/text this color temporarily on impact */
    impactColor?: string;
    /** Optional: Duration of the temporary impact flash (ms) */
    impactDuration?: number;
}

/** Configuration for the ripple pulse indicator */
export interface PulseConfig {
    /** Duration of one ripple expansion (s) */
    speed: number;
    /** Number of concurrent ripples */
    count: number;
    /** Seconds to wait between pulse groups */
    gap: number;
}