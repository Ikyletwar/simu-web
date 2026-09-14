// ============================================================
// js/ujian.js - Logika pengerjaan ujian
// ============================================================

let examId = null;
let examData = null;
let soalList = [];        // [{id, question_id, urutan, pertanyaan, pilihan_a..d, jawaban_benar}]
let currentIndex = 0;
let jawaban = {};         // {question_id: 'a'|'b'|'c'|'d'}
let timerInterval = null;
let sisaDetik = 0;
let profile = null;

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
    .select('id, judul, subject_id, durasi_menit, tanggal_mulai, tanggal_selesai, is_published')
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

  soalList = (eqs || []).map(function (e) {
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
      jawaban_benar: q.jawaban_benar
    };
  });

  if (soalList.length === 0) {
    showSnackbar('Ujian ini belum memiliki soal.', 'error');
    setTimeout(function () { window.location.href = 'dashboard-siswa.html'; }, 1000);
    return;
  }

  document.getElementById('examTitle').textContent = exam.judul || 'Ujian';
  document.getElementById('loadingBox').classList.add('hidden');
  document.getElementById('examContent').classList.remove('hidden');

  sisaDetik = exam.durasi_menit * 60;
  startTimer();
  renderSoal();

  lucide.createIcons();
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

  // Soal esai: tulis jawaban bebas, tidak dikoreksi otomatis.
  if (soal.tipe === 'esai') {
    const ta = document.createElement('textarea');
    ta.className = 'exam-essay-input';
    ta.placeholder = 'Tulis jawaban esai kamu di sini...';
    ta.value = jawaban[soal.question_id] || '';
    ta.addEventListener('input', function () {
      jawaban[soal.question_id] = ta.value;
      renderQuestionMap();
      if (typeof window.scheduleRenderMath === 'function') scheduleRenderMath();
    });
    wrap.appendChild(ta);
  } else {
    const opts = [
      { key: 'a', text: soal.pilihan_a },
      { key: 'b', text: soal.pilihan_b },
      { key: 'c', text: soal.pilihan_c },
      { key: 'd', text: soal.pilihan_d }
    ];

    opts.forEach(function (opt) {
      const div = document.createElement('div');
      div.className = 'exam-option' + (jawaban[soal.question_id] === opt.key ? ' selected' : '');
      div.setAttribute('data-key', opt.key);
      div.innerHTML =
        '<span class="option-key">' + opt.key.toUpperCase() + '</span>' +
        '<span class="option-text">' + escapeHtml(opt.text) + '</span>';
      div.addEventListener('click', function () {
        pilihJawaban(opt.key);
      });
      wrap.appendChild(div);
    });
  }

  // Tombol navigasi
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
  renderSoal();
  lucide.createIcons();
}

function goNext() {
  if (currentIndex < soalList.length - 1) {
    currentIndex++;
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

async function submitUjian(autoSubmit) {
  clearInterval(timerInterval);

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

  const nilai = pgTotal > 0
    ? Math.round((benar / pgTotal) * 100 * 100) / 100
    : 0;

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
    showSnackbar('Gagal mengirim jawaban: ' + error.message, 'error');
    return;
  }

  showSnackbar('Ujian berhasil dikumpulkan.', 'success');
  setTimeout(function () {
    window.location.href = 'hasil.html?exam=' + examId;
  }, 800);
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
    const confirmLeave = confirm('Ujian belum selesai. Yakin ingin keluar? Jawaban tidak akan disimpan.');
    if (confirmLeave) {
      window.location.href = 'dashboard-siswa.html';
    }
  });

  loadUjian();
});