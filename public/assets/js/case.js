/* Case pages (work/<project>/): CR tabs, a width switch and a before / after divider in each CR frame.
   Without JS every request and width is shown in full, one after another. */
const page = document.querySelector('.case');

if (page) {
  page.classList.add('is-interactive');
  const tabs = [...page.querySelectorAll('[data-cr-pick]')];
  const frames = [...page.querySelectorAll('.cr-frame')];
  const widthBtns = [...page.querySelectorAll('[data-width]')];

  const showCR = (id) => {
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.crPick === id)));
    frames.forEach((f) => { f.hidden = f.dataset.cr !== id; });
  };
  // one width for every CR, so switching tabs keeps the chosen screen size;
  // a CR without that width shows its closest one
  const showWidth = (w) => {
    frames.forEach((f) => {
      const own = [...f.querySelectorAll('.ba')];
      const pick = own.map((s) => s.dataset.w)
        .sort((a, b) => Math.abs(a - w) - Math.abs(b - w))[0];
      own.forEach((s) => { s.hidden = s.dataset.w !== pick; });
      f.querySelectorAll('[data-width]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.width === pick)));
    });
  };

  tabs.forEach((b) => b.addEventListener('click', () => showCR(b.dataset.crPick)));
  widthBtns.forEach((b) => b.addEventListener('click', () => showWidth(b.dataset.width)));
  page.querySelectorAll('.ba__range').forEach((r) => r.addEventListener('input', () => {
    r.closest('.ba__frame').style.setProperty('--pos', `${r.value}%`);
  }));

  showCR(tabs[0]?.dataset.crPick);
  showWidth(matchMedia('(max-width: 639px)').matches ? '390' : '1440');
}
