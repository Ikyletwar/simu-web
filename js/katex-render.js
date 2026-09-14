// ============================================================
// RENDER LATEX (KaTeX) - dipakai di halaman yang menampilkan soal
// Otomatis merender $...$ (inline) dan $$...$$ (display) setiap
// kali ada perubahan DOM, tanpa harus memanggil manual.
// Tanpa internet tetap aman: teks $...$ tampil apa adanya.
// ============================================================

let mathRenderTimer = null;
let mathRendering = false;

function renderMath() {
  if (mathRendering) return;
  if (typeof window.renderMathInElement !== 'function') return;
  mathRendering = true;
  try {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false,
      errorColor: '#cc0000'
    });
  } catch (err) {
    console.error('render math error:', err);
  } finally {
    mathRendering = false;
  }
}

function scheduleRenderMath() {
  window.clearTimeout(mathRenderTimer);
  mathRenderTimer = window.setTimeout(renderMath, 60);
}

if (window.MutationObserver) {
  const mo = new MutationObserver(scheduleRenderMath);
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false
  });
}

document.addEventListener('DOMContentLoaded', function () {
  scheduleRenderMath();
});