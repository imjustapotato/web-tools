const cards = document.querySelectorAll('.tool-card');

cards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
        card.setAttribute('aria-current', 'true');
    });

    card.addEventListener('mouseleave', () => {
        card.removeAttribute('aria-current');
    });
});
