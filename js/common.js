// js/common.js - Helper bersama SIMU (dipanggil setelah js/auth.js)
// Digunakan bersama di semua halaman agar kode tidak terduplikasi.

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function truncateText(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max).trimEnd() + '...' : s;
}

function formatNilai(value) {
  if (value == null) return '-';
  const n = parseFloat(value);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

// Daftar huruf opsi yang terisi pada soal PG (A..F, harus kontigu dari A).
// Dipakai untuk render, acak pilihan, import & laporan.
function optionKeys(soal) {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
  const used = [];
  if (!soal) return used;
  for (let i = 0; i < keys.length; i++) {
    const v = soal['pilihan_' + keys[i]];
    if (v != null && String(v).trim() !== '') used.push(keys[i]);
    else break;
  }
  return used;
}
// ============================================================
// Kelas & rombel
// ============================================================

// Basis nama kelas tanpa rombel: "XI TJKT 1" & "XI TJKT 2" => "XI TJKT".
function kelasBasis(nama) {
  if (!nama) return '';
  return String(nama).trim().toUpperCase().replace(/\s+\d+\s*$/, '').trim();
}

// Apakah kelas target ujian mencakup kelas siswa (menghormati rombel).
// - id sama => pasti cocok.
// - Nama kelas target berakhiran angka ("X TJKT 1") => spesifik rombel, hanya
//   id sama yang cocok.
// - Nama kelas target tanpa angka ("X TJKT") => dianggap agregat (TJKT 1 & 2),
//   cocok bila basis nama kedua kelas sama.
function kelasCocok(idTarget, idSiswa, classMap) {
  if (!idTarget || !idSiswa) return false;
  if (idTarget === idSiswa) return true;
  if (!classMap) return false;
  const namaTarget = String(classMap[idTarget] || '').trim();
  const namaSiswa = String(classMap[idSiswa] || '').trim();
  if (namaTarget === '' || namaSiswa === '') return false;
  if (/\d$/.test(namaTarget)) return false;
  return kelasBasis(namaTarget) === kelasBasis(namaSiswa);
}
