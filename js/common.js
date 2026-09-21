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

// ============================================================
// Penilaian esai
// ============================================================

// Normalisasi satu nilai esai ke rentang 0-100 (1 desimal).
function normalisasiNilaiEsai(value) {
  const v = parseFloat(value);
  if (!isFinite(v)) return null;
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

// Hitung nilai akhir ujian + rata-rata nilai esai dari jawaban PG & esai.
//   benarPG  : jumlah soal pilihan ganda yang benar
//   pgCount  : banyaknya soal pilihan ganda pada ujian
//   grades   : objek { question_id: nilai_esai } — hanya soal yang SUDAH dinilai
// Tiap soal berbobot sama (1 poin); esai menyumbang (nilai/100) poin.
// Soal esai yang belum dinilai tidak dihitung agar tidak tercampur nilai 0.
// Saat semua esai dinilai, hasilnya = nilai penuh ujian.
// Dipakai bersama oleh laporan.html & koreksi-esai.html.
function hitungNilaiEsai(benarPG, pgCount, grades) {
  const keys = Object.keys(grades || {});
  let esaiPoints = 0;
  keys.forEach(function (k) { esaiPoints += (parseFloat(grades[k]) || 0) / 100; });
  const totalGraded = (pgCount || 0) + keys.length;
  const nilaiFinal = totalGraded > 0
    ? Math.round(((benarPG + esaiPoints) / totalGraded) * 100 * 100) / 100
    : 0;
  const nilaiEsaiAvg = keys.length > 0
    ? Math.round((keys.reduce(function (a, k) { return a + (parseFloat(grades[k]) || 0); }, 0) / keys.length) * 100) / 100
    : null;
  return { nilaiFinal: nilaiFinal, nilaiEsaiAvg: nilaiEsaiAvg, gradedCount: keys.length };
}
