const explanations = [...document.querySelectorAll('details.explanation')];
document.getElementById('reading-tools')?.removeAttribute('hidden');
for (const [id, open] of [['expand-details', true], ['collapse-details', false]]) {
  document.getElementById(id)?.addEventListener('click', () => explanations.forEach(d => { d.open = open; }));
}
// Reveal targets inside a folded explanation, including references from the contents.
function revealFragment() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  for (let p = target; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  if (target) requestAnimationFrame(() => target.scrollIntoView());
}
addEventListener('hashchange', revealFragment);
revealFragment();
const frame = document.querySelector('.notebook-frame');
frame?.addEventListener('load', () => {
  // Assets are served alongside the article: no external embedding service is needed.
  const doc = frame.contentDocument;
  if (!doc) return;
  const style = doc.createElement('style');
  style.textContent = `body.notebook-page { min-width:0; margin:0; }
    body.notebook-page > header, .skip, .notebook-intro, .design-notes { display:none !important; }
    .notebook-shell { width:100%; max-width:none; padding:12px; margin:0; }
    .experiment { margin-bottom:0; }`;
  doc.head.append(style);
  const resize = () => { frame.style.height = `${Math.ceil(doc.body.getBoundingClientRect().height) + 24}px`; };
  new ResizeObserver(resize).observe(doc.body);
  resize();
});
addEventListener('beforeprint', () => explanations.forEach(d => { d.dataset.wasOpen = String(d.open); d.open = true; }));
addEventListener('afterprint', () => explanations.forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));
