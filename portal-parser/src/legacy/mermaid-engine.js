/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/**
 * Legacy Mermaid rendering engine.
 * Wraps init, code generation, and SVG rendering.
 * Preserved as fallback engine behind the settings toggle in v2.0.0.
 */
import mermaid from 'mermaid';

export function initializeMermaid() {
    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
            darkMode: true,
            background: '#0f172a',
            primaryColor: '#1e293b',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#334155',
            lineColor: '#94a3b8',
            fontFamily: 'Inter, sans-serif'
        }
    });

    // Expose globally for the Companion Extension hook which calls window.mermaid
    window.mermaid = mermaid;
}

/** Converts parsed course data into Mermaid `graph LR` definition string */
export function buildMermaidCode(courses) {
    let mermaidCode = 'graph LR\n';
    mermaidCode += 'classDef default fill:#1e293b,stroke:#334155,stroke-width:2px,color:#f8fafc,rx:8,ry:8;\n';

    courses.forEach((course) => {
        const safeTitle = course.title.replace(/["[\]()]/g, '');
        mermaidCode += `${course.code}["${course.code}<br/>${safeTitle}"]\n`;
        course.prerequisites.forEach((prerequisite) => {
            mermaidCode += `${prerequisite} --> ${course.code}\n`;
        });
    });

    return mermaidCode;
}

/** Renders Mermaid code string to SVG — caller handles errors */
export async function renderMermaidSvg(mermaidCode) {
    const { svg } = await window.mermaid.render('mermaid-svg', mermaidCode);
    return svg;
}
