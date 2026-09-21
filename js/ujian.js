// ============================================================
// js/ujian.js - Logika pengerjaan ujian
// Fitur:
//   - Jadwal ujian (mulai/selesai), hitung mundur
//   - Anti curang: acak urutan soal & pilihan (urutan soal bisa dimatikan
//     per ujian lewat form Kelola Ujian), deteksi pindah tab,
//     autolock setelah beberapa peringatan, permintaan fullscreen
//   - Autosave jawaban ke localStorage (tahan koneksi terputus),
//     bisa dilanjutkan kembali saat membuka ujian lagi
// ============================================================

let examId = null;
let examData = null;
let soalList = [];        // [{id, question_id, urutan, pertanyaan, pilihan_a..f, jawaban_benar}] (urutannya sesuai aturan acak ujian)
let optsMap = {};         // { question_id: ['a'..'f'] diacak } -> posisi tampil -> huruf asli
let currentIndex = 0;
let jawaban = {};         // {question_id: 'a'|'b'|'c'|'d'}
let timerInterval = null;
let sisaDetik = 0;
let profile = null;

// Autosave & anti curang
const MAX_VIOLATIONS = 3;        // setelah 3x => otomatis dikumpulkan (nilai 0)
let cheatViolations = 0;
let cheatAwayMs = 0;
let awaySince = null;            // timestamp saat tab mulai ditinggal
let cheatLog = [];               // bukti pelanggaran per kejadian: {jenis:'tab'|'fullscreen', waktu, durasi_detik}
let draftPathPrefix = 'simu_draft_v2_';
let autoSaveTimer = null;

// Helper snackbar (fallback)
if (typeof showSnackbar !== 'function') {
  function showSnackbar(message, type) {
    let snackbar = document.getElementById('snackbar');
    if (!snackbar) {
      snackbar = document.createElement('div');
      snackbar.id = 'snackbar';
      snackbar.className = 'snackbar';
      document.body.appendChild(snackbar);
    }
    snackbar.textContent = message;
    snackbar.className = 'snackbar snackbar-' + (type || 'error') + ' show';
    clearTimeout(showSnackbar._t);
    showSnackbar._t = setTimeout(function () {
      snackbar.classList.remove('show');
    }, 3000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// Huruf opsi yang benar-benar terisi pada satu soal PG (A..F, kontigu dari A).
// Kalau soal lama/aneh tidak punya satu pun isi, kembalikan A-D sebagai fallback.
function optionKeys(soal) {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
  const used = [];
  if (!soal) return keys.slice(0, 4);
  for (let i = 0; i < keys.length; i++) {
    const v = soal['pilihan_' + keys[i]];
    if (v != null && String(v).trim() !== '') used.push(keys[i]);
    else break;
  }
  return used.length > 0 ? used : keys.slice(0, 4);
}

// ============================================================
// PRNG deterministik (untuk acak urutan yang sama saat reload)
// ============================================================
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// ============================================================
// DRAFT (autosave lokal)
// ============================================================
function draftKey() {
  return draftPathPrefix + (profile ? profile.id : 'anon') + '_' + examId;
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey(), JSON.stringify({
      v: 2,
      jawaban: jawaban,
      currentIndex: currentIndex,
      sisaDetik: sisaDetik,
      cheatViolations: cheatViolations,
      cheatAwayMs: cheatAwayMs,
      cheatLog: cheatLog,
      updatedAt: Date.now()
    }));
  } catch (e) {
    // storage penuh / blocked - abaikan
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftKey());
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 2) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(draftKey()); } catch (e) {}
}

// -- Cache map id kelas -> nama (dipakai untuk penyetaraan rombel TJKT/TK) --
let classMapCache = null;
async function getClassMap() {
  if (classMapCache) return classMapCache;
  const { data, error } = await supabaseClient.from('classes').select('id, nama');
  if (error) return {};
  classMapCache = {};
  (data || []).forEach(function (c) { classMapCache[c.id] = c.nama; });
  return classMapCache;
}

// ============================================================
// LOAD UJIAN
// ============================================================
async function loadUjian() {
  examId = new URLSearchParams(window.location.search).get('exam');
  if (!examId) {
    showSnackbar('Parameter ujian tidak ditemukan.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  profile = await guard('siswa');
  if (!profile) return;

  const { data: exam, error: examErr } = await supabaseClient
    .from('exams')
    .select('id, judul, subject_id, durasi_menit, tanggal_mulai, tanggal_selesai, is_published, class_id, major_id, acak_soal')
    .eq('id', examId)
    .maybeSingle();

  if (examErr || !exam) {
    showSnackbar('Ujian tidak ditemukan.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  if (!exam.is_published) {
    showSnackbar('Ujian belum dipublikasikan.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  // Ujian hanya untuk kelas/jurusan tertentu (atau untuk semua).
  const globalExam = !exam.class_id && !exam.major_id;
  let kelasTarget = false;
  if (exam.class_id && profile.class_id) {
    if (exam.class_id === profile.class_id) {
      kelasTarget = true;
    } else {
      // Cocokkan basis nama kelas (rombel): target "X TJKT" berlaku untuk
      // siswa X TJKT 1 maupun X TJKT 2.
      const map = await getClassMap();
      kelasTarget = kelasCocok(exam.class_id, profile.class_id, map);
    }
  }
  const jurusanTarget = !exam.class_id && exam.major_id && profile.major_id && exam.major_id === profile.major_id;
  if (!globalExam && !kelasTarget && !jurusanTarget) {
    showSnackbar('Ujian tidak ditujukan untuk kelas/jurusan Anda.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  const now = new Date();
  if (now < new Date(exam.tanggal_mulai) || now > new Date(exam.tanggal_selesai)) {
    showSnackbar('Ujian sudah tidak tersedia / belum dimulai.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  // Cek sudah pernah submit
  const { data: existing } = await supabaseClient
    .from('submissions')
    .select('id')
    .eq('exam_id', examId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existing) {
    clearDraft();
    window.location.href = 'hasil.html?exam=' + examId;
    return;
  }

  examData = exam;

  // Load soal ujian
  const { data: eqs, error: eqErr } = await supabaseClient
    .from('exam_questions')
    .select('id, urutan, question_id, questions(*)')
    .eq('exam_id', examId)
    .order('urutan');

  if (eqErr) {
    showSnackbar('Gagal memuat soal ujian.', 'error');
    console.error('load soal ujian error:', eqErr.message);
    return;
  }

  const baseList = (eqs || []).map(function (e) {
    const q = e.questions;
    return {
      id: e.id,
      question_id: q.id,
      urutan: e.urutan,
      tipe: q.tipe || 'pg',
      pertanyaan: q.pertanyaan,
      pilihan_a: q.pilihan_a,
      pilihan_b: q.pilihan_b,
      pilihan_c: q.pilihan_c,
      pilihan_d: q.pilihan_d,
      pilihan_e: q.pilihan_e,
      pilihan_f: q.pilihan_f,
      jawaban_benar: q.jawaban_benar
    };
  });

  if (baseList.length === 0) {
    showSnackbar('Ujian ini belum memiliki soal.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  // ---- Urutan soal: diacak (deterministik per siswa) bila acak_soal ON ----
  // Kalau admin mematikan acak soal, urutan mengikuti daftar di Kelola Ujian.
  let order;
  if (exam.acak_soal === false) {
    order = baseList.map(function (_, i) { return i; });
  } else {
    order = seededShuffle(
      baseList.map(function (_, i) { return i; }),
      hashSeed(examId + '_' + profile.id + '::soal')
    );
  }
  soalList = order.map(function (i) { return baseList[i]; });

  // ---- Acak urutan pilihan tiap soal PG (hanya opsi yang benar-benar terisi) ----
  optsMap = {};
  soalList.forEach(function (s) {
    if (s.tipe === 'esai') return;
    const keys = optionKeys(s);
    optsMap[s.question_id] = keys.length === 0
      ? ['a', 'b', 'c', 'd']
      : seededShuffle(
          keys,
          hashSeed(s.question_id + '_' + profile.id + '::opt')
        );
  });

  document.getElementById('examTitle').textContent = exam.judul || 'Ujian';

  // ---- Siapkan layar mulai / lanjut ----
  setupStartScreen();
}

// ============================================================
// LAYAR MULAI / LANJUT
// ============================================================
function formatJam(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) +
    ' WIB, ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
}

// Hitung sisa waktu hingga jadwal selesai (maksimum durasi)
function sisaHinggaSelesai() {
  const end = new Date(examData.tanggal_selesai);
  const ms = Math.floor((end - Date.now()) / 1000);
  if (ms <= 0) return 0;
  // batasi oleh durasi ujian
  const durasi = examData.durasi_menit * 60;
  return Math.min(durasi, ms);
}

function setupStartScreen() {
  const overlay = document.getElementById('startScreen');
  const info = document.getElementById('startInfo');
  const btnText = document.getElementById('startBtnText');
  const btn = document.getElementById('startBtn');
  const draft = loadDraft();

  const pgCount = soalList.filter(function (s) { return s.tipe !== 'esai'; }).length;
  const esaiCount = soalList.length - pgCount;

  let infoHtml =
    '<ul class="exam-start-list">' +
    '<li><i data-lucide="list-checks"></i><span>' + soalList.length + ' soal' +
      (pgCount > 0 ? ' pilihan ganda' : '') +
      (esaiCount > 0 ? ' + ' + esaiCount + ' esai' : '') + '</span></li>' +
    '<li><i data-lucide="timer"></i><span>Durasi ' + examData.durasi_menit + ' menit</span></li>' +
    '<li><i data-lucide="clock"></i><span>Waktu berakhir: ' + formatJam(examData.tanggal_selesai) + '</span></li>' +
    '</ul>' +
    '<div class="exam-start-rule">' +
    '<i data-lucide="shield-alert"></i>' +
    '<div><b>Aturan:</b> Dilarang pindah tab / keluar dari halaman ujian. Setelah ' +
    MAX_VIOLATIONS + ' peringatan, ujian otomatis dikumpulkan.</div>' +
    '</div>' +
    '<div class="exam-start-rule">' +
    '<i data-lucide="cloud-off"></i>' +
    '<div><b>Koneksi putus?</b> Jawaban kamu disimpan otomatis di perangkat ini dan bisa dilanjutkan.</div>' +
    '</div>';

  if (draft) {
    const sisaLabel = formatDurasi(draft.sisaDetik);
    infoHtml =
      '<div class="exam-resume-notice">' +
      '<i data-lucide="refresh-cw"></i>' +
      '<div><b>Ada pengerjaan tersimpan.</b> Lanjutkan ujian kamu dari soal ' +
      ((draft.currentIndex || 0) + 1) + ' (sisa waktu ' + sisaLabel + ').</div>' +
      '</div>' +
      infoHtml;
    btnText.textContent = 'Lanjutkan Ujian';
  } else {
    btnText.textContent = 'Mulai Ujian';
  }

  info.innerHTML = infoHtml;

  btn.addEventListener('click', async function () {
    const draft2 = loadDraft();
    if (draft2) {
      // Resume pengerjaan
      jawaban = draft2.jawaban || {};
      currentIndex = draft2.currentIndex || 0;
      sisaDetik = Math.max(1, Math.min(sisaHinggaSelesai(), draft2.sisaDetik || 0));
      cheatViolations = draft2.cheatViolations || 0;
      cheatAwayMs = draft2.cheatAwayMs || 0;
      cheatLog = draft2.cheatLog || [];
    } else {
      // Mulai baru
      jawaban = {};
      currentIndex = 0;
      sisaDetik = sisaHinggaSelesai();
      cheatViolations = 0;
      cheatAwayMs = 0;
      cheatLog = [];
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) { /* fullscreen mungkin ditolak, lanjut saja */ }

    document.getElementById('loadingBox').classList.add('hidden');
    overlay.classList.add('hidden');
    document.getElementById('examContent').classList.remove('hidden');

    startTimer();
    renderSoal();
    scheduleAutosave();
    startAntiCheat();
    lucide.createIcons();
  });

  document.getElementById('loadingBox').classList.add('hidden');
  overlay.classList.remove('hidden');
  lucide.createIcons();
}

function formatDurasi(detik) {
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// ============================================================
// TIMER
// ============================================================
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(function () {
    sisaDetik--;
    if (sisaDetik <= 0) {
      clearInterval(timerInterval);
      sisaDetik = 0;
      updateTimerDisplay();
      showSnackbar('Waktu habis. Ujian dikumpulkan otomatis.', 'warning');
      setTimeout(function () {
        submitUjian(true);
      }, 500);
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('examTimer');
  const mm = String(Math.floor(sisaDetik / 60)).padStart(2, '0');
  const ss = String(sisaDetik % 60).padStart(2, '0');
  el.textContent = mm + ':' + ss;
  if (sisaDetik < 60) {
    el.classList.add('danger');
  } else {
    el.classList.remove('danger');
  }
}

// ============================================================
// RENDER SOAL
// ============================================================
function renderSoal() {
  const soal = soalList[currentIndex];
  document.getElementById('soalNumber').textContent = 'Soal ' + (currentIndex + 1);
  document.getElementById('examProgress').textContent =
    'Soal ' + (currentIndex + 1) + ' dari ' + soalList.length;
  document.getElementById('soalPertanyaan').innerHTML =
    (typeof formatQuestionText === 'function') ? formatQuestionText(soal.pertanyaan) : escapeHtml(soal.pertanyaan);

  const wrap = document.getElementById('soalPilihan');
  wrap.innerHTML = '';

  if (soal.tipe === 'esai') {
    const ta = document.createElement('textarea');
    ta.className = 'exam-essay-input';
    ta.placeholder = 'Tulis jawaban esai kamu di sini...';
    ta.value = jawaban[soal.question_id] || '';
    ta.addEventListener('input', function () {
      jawaban[soal.question_id] = ta.value;
      renderQuestionMap();
      saveDraft();
      if (typeof window.scheduleRenderMath === 'function') scheduleRenderMath();
    });
    wrap.appendChild(ta);
  } else {
    const order = optsMap[soal.question_id] || optionKeys(soal);
    order.forEach(function (origKey, pos) {
      const div = document.createElement('div');
      div.className = 'exam-option' + (jawaban[soal.question_id] === origKey ? ' selected' : '');
      div.setAttribute('data-key', origKey);
      div.innerHTML =
        '<span class="option-key">' + String.fromCharCode(65 + pos) + '</span>' +
        '<span class="option-text">' + escapeHtml(soal['pilihan_' + origKey]) + '</span>';
      div.addEventListener('click', function () {
        pilihJawaban(origKey);
      });
      wrap.appendChild(div);
    });
  }

  const prevBtn = document.getElementById('prevBtn');
  prevBtn.disabled = currentIndex === 0;

  const nextBtn = document.getElementById('nextBtn');
  const nextBtnText = document.getElementById('nextBtnText');
  const chevron = document.getElementById('nextBtnChevron');
  if (currentIndex === soalList.length - 1) {
    nextBtnText.textContent = 'Submit Ujian';
    chevron.classList.add('hidden');
  } else {
    nextBtnText.textContent = 'Selanjutnya';
    chevron.classList.remove('hidden');
  }

  renderQuestionMap();
}

function pilihJawaban(key) {
  const soal = soalList[currentIndex];
  jawaban[soal.question_id] = key;
  saveDraft();
  renderSoal();
  lucide.createIcons();
}

function goNext() {
  if (currentIndex < soalList.length - 1) {
    currentIndex++;
    saveDraft();
    renderSoal();
  } else {
    openSubmitModal();
  }
}

function goPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    renderSoal();
  }
}

// ============================================================
// PETA SOAL
// ============================================================
function renderQuestionMap() {
  const wrap = document.getElementById('questionMap');
  wrap.innerHTML = '';
  soalList.forEach(function (soal, idx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qmap-item';
    if (idx === currentIndex) btn.classList.add('current');
    if (jawaban[soal.question_id]) btn.classList.add('answered');
    btn.textContent = idx + 1;
    btn.addEventListener('click', function () {
      currentIndex = idx;
      renderSoal();
    });
    wrap.appendChild(btn);
  });
}

// ============================================================
// AUTOSAVE (jadwal berkala + sebelum keluar)
// ============================================================
function scheduleAutosave() {
  clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(saveDraft, 5000);

  window.addEventListener('beforeunload', function (e) {
    saveDraft();
    // Blokir reload/close yang tidak disengaja supaya ujian tidak hilang
    if (examData && !examData._submitted) {
      e.preventDefault();
      e.returnValue = '';
    }
    return e.returnValue;
  });
}

// ============================================================
// ANTI CURANG
// ============================================================
function startAntiCheat() {
  // Deteksi pindah tab / jendela
  document.addEventListener('visibilitychange', handleAwayChange);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);

  // Blokir klik kanan
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // Blokir shortcut umum (save/print/devtools/pintasan sistem)
  window.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    if (ctrl && (k === 's' || k === 'p' || k === 'u' || k === 'i' || k === 'j' || k === 'c')) {
      e.preventDefault();
    }
    if (e.key === 'PrintScreen' || (e.key === 'p' && ctrl && e.shiftKey)) {
      e.preventDefault();
    }
  });

  // Jika meninggalkan fullscreen saat ujian berlangsung => hitung sebagai pelanggaran.
  // Kalau sekalian berpindah tab (visibilityState hidden) biar handler tab yang mencatat,
  // supaya satu kali kepergian tidak dihitung dua kali.
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && examData && !examData._submitted && document.visibilityState !== 'hidden') {
      registerViolation('fullscreen');
    }
  });
}

// ============================================================
// PELANGGARAN (ANTI CURANG)
// ============================================================

// Setiap pergantian tab / kehilangan fokus LANGSUNG dicatat sebagai 1 pelanggaran
// (tanpa jeda 5 detik seperti sebelumnya). Semua kejadian disimpan di cheatLog
// sebagai bukti untuk guru. Setelah mencapai MAX_VIOLATIONS => ujian otomatis
// dikumpulkan dan nilai dijadikan 0.
function registerViolation(jenis) {
  if (examData && examData._submitted) return;
  cheatLog.push({
    jenis: jenis,                     // 'tab' | 'fullscreen'
    waktu: new Date().toISOString(),
    durasi_detik: 0
  });
  cheatViolations++;
  showCheatWarning(jenis === 'fullscreen');
}

// Mulai sesi "pergi". Hanya satu pelanggaran per sesi: blur dan visibilitychange
// bisa datang bersamaan untuk kepergian yang sama, jadi awalnya lewat awaySince.
function beginAway(jenis) {
  if (awaySince === null) {
    awaySince = Date.now();
    registerViolation(jenis);
  }
}

// Tutup sesi "pergi": catat durasi sebenarnya di kejadian terakhir.
function finishAway() {
  if (awaySince === null) return;
  const durasi = Date.now() - awaySince;
  cheatAwayMs += durasi;
  awaySince = null;
  const last = cheatLog[cheatLog.length - 1];
  if (last) last.durasi_detik = Math.round(durasi / 1000);
}

function handleWindowBlur() {
  beginAway('tab');
}

function handleWindowFocus() {
  finishAway();
}

function handleAwayChange() {
  if (document.visibilityState === 'hidden') {
    beginAway('tab');
  } else if (document.visibilityState === 'visible') {
    finishAway();
  }
}

function showCheatWarning(fromFullscreen) {
  const sisa = MAX_VIOLATIONS - cheatViolations;
  const msg = fromFullscreen
    ? 'Mode layar penuh dihentikan! '
    : 'Terdeteksi pindah tab / keluar dari ujian! ';
  if (sisa <= 0) {
    showSnackbar('Ujian dikumpulkan otomatis karena melanggar aturan anti curang. Nilai dijadikan 0.', 'error');
    submitUjian(true, true);
    return;
  }
  showSnackbar(msg + 'Peringatan ke-' + cheatViolations + ' dari ' + MAX_VIOLATIONS +
    '. Sisa ' + sisa + ' peringatan lagi sebelum ujian dikumpulkan otomatis.', 'warning');
  saveDraft();
}

// ============================================================
// STATUS KONEKSI (banner offline)
// ============================================================
function setupConnectionMonitor() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  function update() {
    if (!navigator.onLine) {
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }
  window.addEventListener('offline', function () {
    update();
    saveDraft();
    showSnackbar('Koneksi terputus. Jawaban tetap aman (tersimpan otomatis).', 'warning');
  });
  window.addEventListener('online', function () {
    update();
    showSnackbar('Koneksi kembali. Lanjutkan ujian.', 'success');
  });
  update();
}

// ============================================================
// SUBMIT
// ============================================================
function openSubmitModal() {
  const total = soalList.length;
  const terjawab = soalList.filter(function (s) {
    if (s.tipe === 'esai') return (jawaban[s.question_id] || '').trim() !== '';
    return !!jawaban[s.question_id];
  }).length;
  const modal = document.getElementById('submitModal');
  let msg = 'Anda sudah mengisi ' + terjawab + ' dari ' + total + ' soal.';
  if (soalList.some(function (s) { return s.tipe === 'esai'; })) {
    msg += ' Soal esai tidak dikoreksi otomatis dan akan dinilai oleh guru.';
  }
  document.getElementById('submitModalText').textContent = msg;
  modal.classList.add('active');
}

function closeSubmitModal() {
  document.getElementById('submitModal').classList.remove('active');
}

async function submitUjian(autoSubmit, karenaCurang) {
  clearInterval(timerInterval);
  clearInterval(autoSaveTimer);
  if (examData) examData._submitted = true;

  const btn = document.getElementById('submitConfirmBtn');
  const text = document.getElementById('submitConfirmText');
  const loader = document.getElementById('submitConfirmLoader');
  btn.disabled = true;
  text.textContent = 'Mengirim...';
  loader.classList.remove('hidden');

  // Hitung nilai (soal esai tidak dikoreksi otomatis)
  let benar = 0;
  let salah = 0;
  let pgTotal = 0;
  let esaiTerisi = 0;
  const jawabanPayload = {};
  soalList.forEach(function (soal) {
    const j = jawaban[soal.question_id];
    if (soal.tipe === 'esai') {
      const t = (j || '').trim();
      if (t) {
        jawabanPayload[soal.question_id] = t;
        esaiTerisi++;
      }
      return;
    }
    pgTotal++;
    if (j) {
      jawabanPayload[soal.question_id] = j;
      if (j === soal.jawaban_benar) {
        benar++;
      } else {
        salah++;
      }
    } else {
      salah++;
    }
  });

  let nilai = pgTotal > 0
    ? Math.round((benar / pgTotal) * 100 * 100) / 100
    : 0;

  // Kalau ujian dipaksa dikumpulkan karena pelanggaran anti curang,
  // nilai dijadikan 0 (tidak peduli seberapa benar jawabannya).
  if (karenaCurang) nilai = 0;

  // Catatan anti curang ikut terkirim (bukti lengkap untuk guru di laporan):
  // ringkasan + log per kejadian (jenis, waktu, durasi).
  jawabanPayload._meta = {
    pelanggaran: cheatViolations,
    pindah_tab: cheatViolations,
    waktu_pergi: Math.round(cheatAwayMs / 1000),
    dikumpulkan_otomatis: !!autoSubmit,
    alasan: karenaCurang ? 'pelanggaran anti curang' : (autoSubmit ? 'waktu habis' : 'manual'),
    catatan: cheatLog.slice()
  };

  const { error } = await supabaseClient
    .from('submissions')
    .upsert({
      exam_id: examId,
      user_id: profile.id,
      jawaban: jawabanPayload,
      nilai: nilai,
      jumlah_benar: benar,
      jumlah_salah: salah,
      submitted_at: new Date().toISOString()
    }, { onConflict: 'exam_id,user_id' });

  btn.disabled = false;
  text.textContent = 'Ya, Submit';
  loader.classList.add('hidden');

  if (error) {
    console.error('submit error:', error.message);
    if (/row-level security|RLS|permission|policy/i.test(error.message)) {
      showSnackbar('Jawaban sudah pernah dikumpulkan. Mengarahkan ke hasil...', 'info');
      setTimeout(function () {
        window.location.href = 'hasil.html?exam=' + examId;
      }, 900);
    } else {
      showSnackbar('Gagal mengirim jawaban: ' + error.message, 'error');
    }
    return;
  }

  clearDraft();
  showSnackbar('Ujian berhasil dikumpulkan.', 'success');
  setTimeout(function () {
    window.location.href = 'hasil.html?exam=' + examId;
  }, 700);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('prevBtn').addEventListener('click', goPrev);
  document.getElementById('nextBtn').addEventListener('click', goNext);
  document.getElementById('submitCancelBtn').addEventListener('click', closeSubmitModal);
  document.getElementById('submitModal').addEventListener('click', function (e) {
    if (e.target === this) closeSubmitModal();
  });
  document.getElementById('submitConfirmBtn').addEventListener('click', function () {
    submitUjian(false);
  });

  document.getElementById('backBtn').addEventListener('click', function (e) {
    e.preventDefault();
    const confirmLeave = confirm('Ujian belum selesai. Yakin ingin keluar?\n\nJawaban kamu TERSIMPAN OTOMATIS dan bisa dilanjutkan lagi lewat ujian yang sama.');
    if (confirmLeave) {
      if (examData) examData._submitted = true;  // biar beforeunload tidak prompt ganda
      clearTimeout(autoSaveTimer);
      window.location.href = 'dashboard-siswa.html';
    }
  });

  setupConnectionMonitor();
  loadUjian();
});