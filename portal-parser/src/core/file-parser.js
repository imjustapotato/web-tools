/*
 * Copyright (C) 2026 Kenneth Westhle Davila (kendavila.me)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 */

/* File ingestion and heuristic HTML parsing — MHTML decode, course extraction */
export async function extractHtmlFromFile(file) {
    const text = await file.text();
    let rawHtml = text;

    const htmlPartMatch = text.match(
        /Content-Type:\s*text\/html([\s\S]*?)(?=\r?\n------MultipartBoundary|\r?\n--[a-zA-Z0-9=_-]+--|$)/i
    );

    if (!htmlPartMatch) return rawHtml;

    const headersAndBody = htmlPartMatch[1];
    const bodyMatch = headersAndBody.match(/\r?\n\r?\n([\s\S]*)/);
    if (!bodyMatch) return rawHtml;

    rawHtml = bodyMatch[1];

    if (headersAndBody.match(/Content-Transfer-Encoding:\s*base64/i)) {
        rawHtml = atob(rawHtml.replace(/[^A-Za-z0-9+/=]/g, ''));
    } else if (headersAndBody.match(/Content-Transfer-Encoding:\s*quoted-printable/i)) {
        rawHtml = rawHtml.replace(/=\r?\n/g, '');
        rawHtml = rawHtml.replace(/=([A-F0-9]{2})/ig, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    return rawHtml;
}

/* Parse portal HTML into structured course data — heuristic column detection */
export function parseCurriculumHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let codeColumnIndex = 0;
    let titleColumnIndex = 1;
    let prerequisiteColumnIndex = 4;

    const headers = Array.from(doc.querySelectorAll('th')).map((th) => th.innerText.trim().toUpperCase());
    headers.forEach((header, index) => {
        if (header.includes('CODE')) codeColumnIndex = index;
        if (header.includes('TITLE') || header.includes('DESCRIPTION')) titleColumnIndex = index;
        if (header.includes('PRE-REQUISITE') || header.includes('PREREQUISITE')) prerequisiteColumnIndex = index;
    });

    const courses = [];
    const parsedCourseTitleMap = new Map();
    const rows = Array.from(doc.querySelectorAll('tr'));

    rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) => td.innerText.trim());
        if (cells.length <= Math.max(codeColumnIndex, titleColumnIndex, prerequisiteColumnIndex)) return;

        const code = cells[codeColumnIndex];
        const title = cells[titleColumnIndex];
        const prerequisitesRaw = cells[prerequisiteColumnIndex];

        if (!/^[A-Z]{2,4}\s*\d{2,4}[A-Z]?$/.test(code)) return;

        const cleanCode = code.replace(/\s+/g, '');
        const prerequisiteMatches = prerequisitesRaw.match(/[A-Z]{2,4}\s*\d{2,4}[A-Z]?/g);
        const prerequisites = prerequisiteMatches
            ? prerequisiteMatches.map((prerequisite) => prerequisite.replace(/\s+/g, ''))
            : [];

        courses.push({ code: cleanCode, title, prerequisites });
        parsedCourseTitleMap.set(cleanCode, title);
    });

    return { courses, courseTitleMap: parsedCourseTitleMap };
}
