// Example: Sending an Inbound Emoji (Reward System)
islandOrganism.fireParticle({
    direction: 'inbound',
    type: 'emoji',
    content: '💙',
    color: '#3b82f6'
});

// Example: Sending an Outbound Sync Request
islandOrganism.fireParticle({
    direction: 'outbound',
    type: 'icon',
    content: '<path d="M..."/>',
    color: '#10b981'
});

// Because of the non-destructive architecture, you can literally call `.fireParticle()` 10 times in a row, and it will spawn a chaotic flurry of independent water droplets that all snap out from the island perfectly while the underlying pill pulses furiously with stacked neon shadows!