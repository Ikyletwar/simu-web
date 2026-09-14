// ============================================================
// js/format-text.js - Memformat teks soal: blok kode ```...```
// (dan kode inline `...`) menjadi HTML. Aman dimuat tanpa internet:
// kalau fungsi ini tidak ada, teks tetap tampil apa adanya.
// ============================================================

(function () {
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  window.formatQuestionText = function (text) {
    if (text == null) return '';
    let html = escapeHtml(text);

    // Blok kode dengan pembatas ``` (opsional nama bahasa).
    html = html.replace(/```([\w.#+-]*)?[ \t]*\r?\n?([\s\S]*?)```/g, function (m, lang, code) {
      const cls = lang ? ' class="language-' + escapeHtml(lang.trim()) + '"' : '';
      return '<pre class="code-block"><code' + cls + '>' + code + '</code></pre>';
    });

    // Kode inline `...` dalam satu baris.
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    return html;
  };
})();