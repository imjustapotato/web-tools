const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
    window.addEventListener('pageshow', () => {
        document.body.classList.add('page-ready');
    });

    // Fallback for browsers where pageshow may not fire on initial load.
    window.addEventListener('load', () => {
        document.body.classList.add('page-ready');
    });

    document.querySelectorAll('a[href]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (event.defaultPrevented) {
                return;
            }

            const href = link.getAttribute('href');
            const target = link.getAttribute('target');
            const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || target === '_blank' || isModifiedClick) {
                return;
            }

            const destination = new URL(href, window.location.href);
            if (destination.origin !== window.location.origin) {
                return;
            }

            event.preventDefault();
            document.body.classList.add('page-leaving');

            window.setTimeout(() => {
                window.location.assign(destination.href);
            }, 260);
        });
    });
} else {
    document.body.classList.add('page-ready');
}
