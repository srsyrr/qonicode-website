/* Site chrome: floating nav, Let's Talk buttons, carousels, newsletter. */
import { openDialog } from './dialog.js';
import { mountTurnstile } from './turnstile.js';
import './desk.js';
import './process.js';

/* Let's Talk buttons anywhere on the page */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-talk]');
  if (!btn) return;
  e.preventDefault();
  openDialog('talk', { topic: btn.dataset.topic });
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

/* Carousels (Latest work + Testimonials): scroll-snap track, dots, swipe, and mouse drag. */
document.querySelectorAll('[data-carousel]').forEach((root) => {
  const track = root.querySelector('[data-track]');
  const dots = root.querySelector('[data-dots]');
  const slides = [...track.children].filter((el) => el.nodeType === 1);
  const label = root.dataset.carousel || 'slide';
  let dotEls = [];

  const step = () => slides[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
  // With several cards in view, the last positions can't reach the left edge — one dot per reachable position.
  const pages = () => Math.max(1, slides.length - Math.max(1, Math.round((track.clientWidth + 1) / step())) + 1);
  const current = () => Math.min(pages() - 1, Math.round(track.scrollLeft / step()));
  const go = (i, smooth = true) => {
    const n = (i + pages()) % pages();
    track.scrollTo({ left: slides[n].offsetLeft - slides[0].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
  };
  const sync = () => {
    const i = current();
    dotEls.forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
  };
  const buildDots = () => {
    const n = pages();
    if (n === dotEls.length) return sync();
    dots.innerHTML = '';
    dotEls = Array.from({ length: n }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel-dot';
      b.setAttribute('aria-label', `Go to ${label} ${i + 1}`);
      b.addEventListener('click', () => go(i));
      dots.appendChild(b);
      return b;
    });
    dots.hidden = n < 2;
    sync();
  };

  // Mouse drag (touch and trackpads already scroll natively).
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; track.classList.add('is-dragging'); }
    track.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    track.classList.remove('is-dragging');
    go(current());
    // a drag shouldn't also click the card's button
    track.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
  });

  // Keyboard: arrow keys move one slide when the track has focus.
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      go(current() + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });

  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(buildDots).observe(track);
  buildDots();
});

/* Newsletter */
const news = document.querySelector('[data-newsletter]');
if (news) {
  const status = news.querySelector('[data-news-status]');
  // Load the spam check only when someone starts typing an email.
  let captcha;
  news.addEventListener('focusin', () => { if (!captcha) captcha = mountTurnstile(news.querySelector('[data-turnstile]')); });
  news.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!news.reportValidity()) return;
    const email = news.email.value.trim();
    const check = await (captcha || (captcha = mountTurnstile(news.querySelector('[data-turnstile]'))));
    if (check.enabled && !check.token()) {
      status.textContent = 'Checking…';
      if (!(await check.waitToken())) {
        status.textContent = 'Please complete the security check.';
        return;
      }
    }
    status.textContent = 'Subscribing…';
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'newsletter', email, company: news.company.value, turnstile: check.token() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || res.status);
      news.reset();
      status.textContent = 'Thanks! You’re on the list.';
    } catch (err) {
      status.textContent = 'Couldn’t subscribe right now — please try again later.';
    } finally {
      check.reset();
    }
  });
}

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
