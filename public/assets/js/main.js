/* Site chrome: floating nav, Let's Talk buttons, work carousel, newsletter. */
import { openDialog } from './dialog.js';
import './desk.js';

/* Let's Talk buttons anywhere on the page */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-talk]');
  if (!btn) return;
  e.preventDefault();
  openDialog('talk');
});

/* Footer links that open the playground on a given page type */
document.querySelectorAll('[data-goto-page]').forEach((a) => a.addEventListener('click', () => {
  const btn = document.querySelector(`[data-page="${a.dataset.gotoPage}"]`);
  if (btn) btn.click();
}));

/* Highlight the nav segment of the section in view */
const navLinks = [...document.querySelectorAll('[data-spy]')];
const spied = navLinks.map((a) => document.getElementById(a.dataset.spy)).filter(Boolean);
if ('IntersectionObserver' in window && spied.length) {
  const visible = new Map();
  const update = () => {
    let best = null;
    visible.forEach((ratio, id) => { if (!best || ratio > visible.get(best)) best = id; });
    navLinks.forEach((a) => {
      const on = a.dataset.spy === best;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) visible.set(en.target.id, en.intersectionRatio); else visible.delete(en.target.id); });
    update();
  }, { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
  spied.forEach((s) => io.observe(s));
}

/* Work carousel: native scroll-snap, with buttons and dots */
document.querySelectorAll('[data-carousel]').forEach((root) => {
  const track = root.querySelector('[data-track]');
  const slides = [...track.children];
  const dots = root.querySelector('[data-dots]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const dotEls = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carousel-dot';
    b.setAttribute('aria-label', `Go to project ${i + 1}`);
    b.addEventListener('click', () => go(i));
    dots.appendChild(b);
    return b;
  });
  const current = () => Math.round(track.scrollLeft / (slides[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0)));
  const go = (i) => {
    const n = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[n].offsetLeft - track.offsetLeft, behavior: 'smooth' });
  };
  const sync = () => {
    const i = current();
    dotEls.forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
  };
  prev.addEventListener('click', () => go(current() - 1));
  next.addEventListener('click', () => go(current() + 1));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  sync();
});

/* Newsletter */
const news = document.querySelector('[data-newsletter]');
if (news) {
  const status = news.querySelector('[data-news-status]');
  news.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!news.reportValidity()) return;
    const email = news.email.value.trim();
    status.textContent = 'Subscribing…';
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'newsletter', email, company: news.company.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || res.status);
      news.reset();
      status.textContent = 'Thanks! You’re on the list.';
    } catch (err) {
      status.textContent = 'Couldn’t subscribe right now — please try again later.';
    }
  });
}

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
