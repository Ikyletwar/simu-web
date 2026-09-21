"use strict";
/* excel-import.js - parser Excel (.xlsx/.csv) berbasis SheetJS.
   Dipakai oleh kelola-siswa.html & kelola-soal.html.
   Tidak menyentuh logika Supabase; hanya menghasilkan teks
   format baris yang sudah dipahami halaman masing-masing.
*/

/* eslint-disable no-undef */ // XLSX global dari SheetJS CDN

window.ExcelImport = (function () {
  function parseArrayBuffer(buf) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Pustaka pembaca Excel belum termuat (SheetJS).');
    }
    var wb = XLSX.read(buf, { type: 'array' });
    var first = wb.SheetNames[0];
    var ws = wb.Sheets[first];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  }

  /* array baris (array of array of string) -> string format SIMU
     rowFormat: template fungsi untuk tiap baris, contoh:
       function (r) { return [r[0], r[1], r[2], r[3], r[4]].join(';'); }
  */
  function toText(rows, rowFormat, skipEmpty) {
    skipEmpty = skipEmpty !== false;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r == null || r.length === 0) continue;
      var line = rowFormat(r);
      if (line == null) continue;
      var has = typeof line === 'string' && line.replace(/;/g, '').trim().length > 0;
      if (!has) continue;
      if (skipEmpty) {
        var trimmed = line.replace(/[;\s]+$/g, '').trim();
        if (trimmed === '') continue;
      }
      out.push(line);
    }
    return out.join('\n');
  }

  function readFileInput(inputEl, callbacks) {
    var f = inputEl.files && inputEl.files[0];
    if (!f) return;
    var rdr = new FileReader();
    rdr.onload = function (e) {
      try {
        var rows = parseArrayBuffer(e.target.result);
        callbacks.onRows(rows);
      } catch (err) {
        if (callbacks.onError) { callbacks.onError(err); }
      }
    };
    rdr.onerror = function () {
      if (callbacks.onError) { callbacks.onError(new Error('Gagal membaca file.')); }
    };
    rdr.readAsArrayBuffer(f);
  }

  return {
    parseArrayBuffer: parseArrayBuffer,
    toText: toText,
    readFileInput: readFileInput
  };
})();
