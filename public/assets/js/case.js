/* Case page (work/skinhale/): pick a change request, pick a width, drag the before / after divider.
   Without JS every request and width is shown in full, one after another. */
const page = document.querySelector('.case');

if (page) {
  page.classList.add('is-interactive');
  const picks = [...page.querySelectorAll('[data-cr-pick]')];
  const panels = [...page.querySelectorAll('[data-cr]')];
  const widthBtns = [...page.querySelectorAll('[data-width]')];
  const slides = [...page.querySelectorAll('.ba')];
  let width = matchMedia('(max-width: 639px)').matches ? '390' : '1440';

  const showCR = (id) => {
    picks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.crPick === id)));
    panels.forEach((p) => { p.hidden = p.dataset.cr !== id; });
  };
  const showWidth = (w) => {
    width = w;
    widthBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.width === w)));
    slides.forEach((s) => { s.hidden = s.dataset.w !== w; });
  };

  picks.forEach((b) => b.addEventListener('click', () => showCR(b.dataset.crPick)));
  widthBtns.forEach((b) => b.addEventListener('click', () => showWidth(b.dataset.width)));
  page.querySelectorAll('.ba__range').forEach((r) => r.addEventListener('input', () => {
    r.closest('.ba__frame').style.setProperty('--pos', `${r.value}%`);
  }));

  showCR(picks[0]?.dataset.crPick);
  showWidth(width);

  /* Light up the step in the sticky bar that is on screen */
  const links = [...page.querySelectorAll('[data-step-link]')];
  if ('IntersectionObserver' in window && links.length) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.dataset.stepLink === en.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    links.forEach((a) => { const s = document.getElementById(a.dataset.stepLink); if (s) io.observe(s); });
  }
}
