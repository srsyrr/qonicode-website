/* How I work: one layout travels through the four step cards.
   Wide screens: the cards play in turn once the grid is in view (3 s each).
   Phones (one column): each card plays when it scrolls into view.
   After its turn a card stays on its final frame; Replay starts over. */
const grid = document.querySelector('[data-proc]');
const still = matchMedia('(prefers-reduced-motion: reduce)');

if (grid && 'IntersectionObserver' in window && !still.matches) {
  const cards = [...grid.querySelectorAll('.proc')];
  const replay = document.querySelector('[data-proc-replay]');
  const phone = matchMedia('(max-width: 639px)');
  const STEP = 3; // seconds per card, same as the CSS animations
  let io;

  const play = (card, delay = 0) => {
    card.style.setProperty('--d', `${delay}s`);
    card.classList.add('is-playing');
  };

  const start = () => {
    if (io) io.disconnect();
    // drop the classes, then re-add, so the CSS animations restart from 0%
    cards.forEach((c) => c.classList.remove('is-ready', 'is-playing', 'is-done'));
    void grid.offsetWidth;
    cards.forEach((c) => c.classList.add('is-ready'));

    if (phone.matches) {
      io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        play(en.target);
        io.unobserve(en.target);
      }), { threshold: 0.6 });
      cards.forEach((c) => io.observe(c));
    } else {
      io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        cards.forEach((c, i) => play(c, i * STEP));
        io.disconnect();
      }, { threshold: 0.35 });
      io.observe(grid);
    }
  };

  cards.forEach((card) => card.addEventListener('animationend', (e) => {
    if (!card.classList.contains('is-playing') || !e.target.classList.contains('proc-last')) return;
    card.classList.remove('is-ready', 'is-playing');
    card.classList.add('is-done');
  }));

  if (replay) {
    replay.hidden = false;
    replay.addEventListener('click', start);
  }
  start();
}
