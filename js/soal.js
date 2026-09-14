// ============================================================
// js/soal.js - CRUD Bank Soal
// ============================================================

let mapelList = [];
let deleteTargetId = null;
let topicList = [];
let lastLoadedSoal = [];
let deleteAllScope = null;
let deleteTopicTarget = null;
let editTopicTarget = null;

// -- Helper: tampilkan snackbar (reuse dari auth.js) --
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
    clearTimeout(showSnackbar._timer);
    showSnackbar._timer = setTimeout(function () {
      snackbar.classList.remove('show');
    }, 3000);
  }
}

// -- Muat pilihan mapel ke dropdown filter --
async function initMapelFilter() {
  const { data, error } = await supabaseClient
    .from('subjects')
    .select('id, nama')
    .order('nama');
  if (error) {
    console.error('Gagal memuat mapel:', error.message);
    return;
  }
  mapelList = data || [];
  const filter = document.getElementById('filterMapel');
  if (filter) {
    mapelList.forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nama;
      filter.appendChild(opt);
    });
  }
  const topicSubject = document.getElementById('topicSubject');
  if (topicSubject) {
    mapelList.forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nama;
      topicSubject.appendChild(opt);
    });
  }
}

function getMapelName(id) {
  const found = mapelList.find(function (m) { return m.id === id; });
  return found ? found.nama : '-';
}

// -- Helper topik --
async function loadTopicsForSubject(subjectId) {
  if (!subjectId) return [];
  const { data, error } = await supabaseClient
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('nama');
  if (error) {
    console.error('Gagal memuat topik:', error.message);
    return [];
  }
  return data || [];
}

async function initTopicFilter() {
  const filterMapel = document.getElementById('filterMapel');
  const filterTopik = document.getElementById('filterTopik');
  if (!filterTopik) return;
  const sid = filterMapel ? filterMapel.value : '';
  filterTopik.innerHTML = '';
  const defOpt = document.createElement('option');
  defOpt.value = '';
  defOpt.textContent = sid ? 'Semua Topik' : 'Pilih Mapel dulu';
  filterTopik.appendChild(defOpt);
  if (!sid) return;
  topicList = await loadTopicsForSubject(sid);
  topicList.forEach(function (t) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nama;
    filterTopik.appendChild(opt);
  });
}

async function loadAllTopics() {
  const { data, error } = await supabaseClient
    .from('topics')
    .select('*')
    .order('subject_id')
    .order('nama');
  if (!error) topicList = data || [];
}

function getTopicName(topicId) {
  if (!topicId) return '';
  const found = topicList.find(function (t) { return t.id === topicId; });
  return found ? found.nama : '';
}

function truncate(text, len) {
  if (!text) return '';
  return text.length > len ? text.substring(0, len) + '...' : text;
}

// -- READ: muat daftar soal --
async function loadSoal() {
  const filterValue = document.getElementById('filterMapel').value;
  const filterTopikEl = document.getElementById('filterTopik');
  const filterTopicValue = filterTopikEl ? filterTopikEl.value : '';
  const loadingBox = document.getElementById('loadingBox');
  const emptyState = document.getElementById('emptyState');
  const tableCard = document.getElementById('tableCard');
  const cardList = document.getElementById('soalCardList');
  const tbody = document.getElementById('soalTableBody');

  loadingBox.classList.remove('hidden');
  emptyState.classList.add('hidden');
  tableCard.classList.add('hidden');
  cardList.innerHTML = '';
  tbody.innerHTML = '';

  let query = supabaseClient
    .from('questions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filterValue) {
    query = query.eq('subject_id', filterValue);
  }
  if (filterTopicValue) {
    query = query.eq('topic_id', filterTopicValue);
  }

  const { data, error } = await query;

  loadingBox.classList.add('hidden');

  if (error) {
    console.error('loadSoal error:', error.message);
    showSnackbar('Gagal memuat soal: ' + error.message, 'error');
    return;
  }

  const soalList = data || [];
  lastLoadedSoal = soalList;

  if (soalList.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  if (filterValue) {
    topicList = await loadTopicsForSubject(filterValue);
  } else if (!filterTopicValue) {
    await loadAllTopics();
  }

  tableCard.classList.remove('hidden');

  // Render tabel (PC)
  soalList.forEach(function (soal, idx) {
    const topicName = getTopicName(soal.topic_id);
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escapeHtml(truncate(soal.pertanyaan, 60)) + '</td>' +
      '<td>' +
      '  <span class="badge badge-neutral">' + escapeHtml(getMapelName(soal.subject_id)) + '</span>' +
      (soal.tipe === 'esai' ? ' <span class="badge badge-warning">Esai</span>' : '') +
      (topicName ? ' <span class="badge badge-outline">' + escapeHtml(topicName) + '</span>' : '') +
      '</td>' +
      '<td>' +
      '  <div class="flex gap-8">' +
      '    <a href="form-soal.html?id=' + soal.id + '" class="btn btn-secondary btn-sm"><i data-lucide="pencil"></i> Edit</a>' +
      '    <button class="btn btn-danger btn-sm btn-delete" data-id="' + soal.id + '"><i data-lucide="trash-2"></i> Hapus</button>' +
      '  </div>' +
      '</td>';
    tbody.appendChild(tr);
  });

  // Render card (HP)
  soalList.forEach(function (soal, idx) {
    const topicName = getTopicName(soal.topic_id);
    const card = document.createElement('div');
    card.className = 'card card-mobile soal-card';
    card.innerHTML =
      '<div class="flex justify-between items-center">' +
      '  <div class="flex gap-8 flex-wrap">' +
      '    <span class="badge badge-neutral">' + escapeHtml(getMapelName(soal.subject_id)) + '</span>' +
      (soal.tipe === 'esai' ? '<span class="badge badge-warning">Esai</span>' : '') +
      (topicName ? '<span class="badge badge-outline">' + escapeHtml(topicName) + '</span>' : '') +
      '  </div>' +
      '  <span class="hint">Soal #' + (idx + 1) + '</span>' +
      '</div>' +
      '<p class="font-medium">' + escapeHtml(truncate(soal.pertanyaan, 90)) + '</p>' +
      '<div class="flex gap-8">' +
      '  <a href="form-soal.html?id=' + soal.id + '" class="btn btn-secondary btn-sm"><i data-lucide="pencil"></i> Edit</a>' +
      '  <button class="btn btn-danger btn-sm btn-delete" data-id="' + soal.id + '"><i data-lucide="trash-2"></i> Hapus</button>' +
      '</div>';
    cardList.appendChild(card);
  });

  bindDeleteButtons();
  lucide.createIcons();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// -- DELETE: bind tombol hapus + modal konfirmasi --
function bindDeleteButtons() {
  document.querySelectorAll('.btn-delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteTargetId = btn.getAttribute('data-id');
      openDeleteModal();
    });
  });
}

function openDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.add('active');
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('active');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  const confirmBtn = document.getElementById('deleteConfirmBtn');
  const confirmText = document.getElementById('deleteConfirmText');
  const confirmLoader = document.getElementById('deleteConfirmLoader');

  confirmBtn.disabled = true;
  confirmText.textContent = 'Menghapus...';
  confirmLoader.classList.remove('hidden');

  const { error } = await supabaseClient
    .from('questions')
    .delete()
    .eq('id', deleteTargetId);

  confirmBtn.disabled = false;
  confirmText.textContent = 'Ya, Hapus';
  confirmLoader.classList.add('hidden');

  if (error) {
    console.error('Hapus soal error:', error.message);
    showSnackbar('Gagal menghapus soal: ' + error.message, 'error');
    return;
  }

  closeDeleteModal();
  showSnackbar('Soal berhasil dihapus.', 'success');
  await loadSoal();
}

// -- DELETE ALL: hapus semua soal sesuai filter saat ini --
function openDeleteAllModal() {
  const modal = document.getElementById('deleteAllModal');
  if (!modal) return;
  const mapel = document.getElementById('filterMapel');
  const topik = document.getElementById('filterTopik');
  const mname = mapel && mapel.selectedOptions[0] ? mapel.selectedOptions[0].textContent : '';
  const tname = topik && topik.selectedOptions[0] ? topik.selectedOptions[0].textContent : '';
  deleteAllScope = {};
  if (mapel && mapel.value) deleteAllScope.subject_id = mapel.value;
  if (topik && topik.value) deleteAllScope.topic_id = topik.value;
  const n = lastLoadedSoal.length;
  const text = document.getElementById('deleteAllModalText');
  if (deleteAllScope.topic_id) {
    text.textContent = 'Hapus semua soal pada topik "' + tname + '" (' + n + ' soal)? Soal pada ujian yang menaruh soal ini juga ikut terhapus. Tindakan tidak bisa dibatalkan.';
  } else if (deleteAllScope.subject_id) {
    text.textContent = 'Hapus semua soal pada mapel "' + mname + '" (' + n + ' soal)? Soal pada ujian yang menaruh soal ini juga ikut terhapus. Tindakan tidak bisa dibatalkan.';
  } else {
    text.textContent = 'Hapus SEMUA soal dari bank soal kamu (' + n + ' soal)? Soal pada semua ujian juga ikut terhapus. Tindakan TIDAK BISA DIBATALKAN.';
  }
  document.getElementById('deleteAllCount').textContent = n;
  modal.classList.add('active');
}

function closeDeleteAllModal() {
  const modal = document.getElementById('deleteAllModal');
  if (modal) modal.classList.remove('active');
  deleteAllScope = null;
}

async function confirmDeleteAll() {
  const confirmBtn = document.getElementById('deleteAllConfirmBtn');
  const confirmText = document.getElementById('deleteAllConfirmText');
  const confirmLoader = document.getElementById('deleteAllConfirmLoader');
  confirmBtn.disabled = true;
  confirmText.textContent = 'Menghapus...';
  confirmLoader.classList.remove('hidden');

  let query = supabaseClient.from('questions').delete();
  if (deleteAllScope && deleteAllScope.topic_id) query = query.eq('topic_id', deleteAllScope.topic_id);
  else if (deleteAllScope && deleteAllScope.subject_id) query = query.eq('subject_id', deleteAllScope.subject_id);
  else query = query.not('id', 'is', null);
  const { error } = await query;

  confirmBtn.disabled = false;
  confirmText.textContent = 'Ya, Hapus Semua';
  confirmLoader.classList.add('hidden');

  if (error) {
    console.error('Hapus semua soal error:', error.message);
    showSnackbar('Gagal menghapus soal: ' + error.message, 'error');
    return;
  }

  closeDeleteAllModal();
  showSnackbar('Semua soal berhasil dihapus.', 'success');
  await loadSoal();
  await loadTopicManagement();
}

// -- Kelola Topik (kartu di kelola-soal.html) --
async function loadTopicManagement() {
  const body = document.getElementById('topicMgmtBody');
  if (!body) return;
  const sid = document.getElementById('topicSubject').value;
  if (!sid) {
    body.innerHTML = '<p class="hint">Pilih mata pelajaran untuk melihat daftar topik.</p>';
    return;
  }
  body.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  const topics = await loadTopicsForSubject(sid);
  const { data: qs } = await supabaseClient
    .from('questions')
    .select('topic_id')
    .eq('subject_id', sid);
  const countMap = {};
  (qs || []).forEach(function (q) {
    const k = q.topic_id || '__none';
    countMap[k] = (countMap[k] || 0) + 1;
  });

  if (topics.length === 0) {
    body.innerHTML = '<p class="hint">Belum ada topik untuk mapel ini. Buat topik pertama di bawah.</p>';
    return;
  }

  body.innerHTML = '';
  topics.forEach(function (t) {
    const row = document.createElement('div');
    row.className = 'topic-row';
    row.innerHTML =
      '<div class="flex items-center gap-8 flex-wrap">' +
      '  <span class="font-medium">' + escapeHtml(t.nama) + '</span>' +
      '  <span class="badge badge-neutral">' + (countMap[t.id] || 0) + ' soal</span>' +
      '</div>' +
      '<div class="flex gap-8">' +
      '  <button class="btn btn-secondary btn-sm btn-edit-topic" data-id="' + t.id + '" data-nama="' + escapeHtml(t.nama) + '">' +
      '    <i data-lucide="pencil"></i> Edit' +
      '  </button>' +
      '  <button class="btn btn-danger btn-sm btn-del-topic" data-id="' + t.id + '" data-nama="' + escapeHtml(t.nama) + '">' +
      '    <i data-lucide="trash-2"></i> Hapus' +
      '  </button>' +
      '</div>';
    body.appendChild(row);
  });

  body.querySelectorAll('.btn-edit-topic').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openEditTopicModal(btn.getAttribute('data-id'), btn.getAttribute('data-nama'));
    });
  });

  body.querySelectorAll('.btn-del-topic').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteTopicTarget = { id: btn.getAttribute('data-id'), nama: btn.getAttribute('data-nama') };
      document.getElementById('topicDeleteText').textContent =
        'Hapus topik "' + deleteTopicTarget.nama + '"? Soal di dalamnya tidak ikut terhapus, hanya tidak ber-topik lagi.';
      document.getElementById('topicDeleteModal').classList.add('active');
    });
  });
  lucide.createIcons();
}

async function addTopicHandler() {
  const sidEl = document.getElementById('topicSubject');
  const nameEl = document.getElementById('newTopicName');
  if (!sidEl || !nameEl) return;
  const sid = sidEl.value;
  const nama = (nameEl.value || '').trim();
  if (!sid) { showSnackbar('Pilih mata pelajaran dulu.', 'error'); return; }
  if (!nama) { showSnackbar('Isi nama topik.', 'error'); return; }
  const { error } = await supabaseClient
    .from('topics')
    .insert({ subject_id: sid, nama: nama });
  if (error) {
    showSnackbar('Gagal tambah topik: ' + error.message, 'error');
    return;
  }
  nameEl.value = '';
  showSnackbar('Topik berhasil ditambahkan.', 'success');
  await loadTopicManagement();
  await initTopicFilter();
}

async function confirmDeleteTopic() {
  if (!deleteTopicTarget) return;
  const confirmBtn = document.getElementById('topicDeleteConfirmBtn');
  const confirmLoader = document.getElementById('topicDeleteConfirmLoader');
  confirmBtn.disabled = true;
  confirmLoader.classList.remove('hidden');
  const { error } = await supabaseClient
    .from('topics')
    .delete()
    .eq('id', deleteTopicTarget.id);
  confirmBtn.disabled = false;
  confirmLoader.classList.add('hidden');
  if (error) {
    console.error('Hapus topik error:', error.message);
    showSnackbar('Gagal menghapus topik: ' + error.message, 'error');
    return;
  }
  document.getElementById('topicDeleteModal').classList.remove('active');
  deleteTopicTarget = null;
  showSnackbar('Topik berhasil dihapus.', 'success');
  await loadTopicManagement();
  await initTopicFilter();
  await loadSoal();
}

function closeTopicDeleteModal() {
  const modal = document.getElementById('topicDeleteModal');
  if (modal) modal.classList.remove('active');
  deleteTopicTarget = null;
}

// -- Edit (rename) topik --
function openEditTopicModal(id, nama) {
  editTopicTarget = { id: id, nama: nama };
  document.getElementById('topicEditName').value = nama;
  document.getElementById('topicEditModal').classList.add('active');
  document.getElementById('topicEditName').focus();
  document.getElementById('topicEditName').select();
}

function closeEditTopicModal() {
  const modal = document.getElementById('topicEditModal');
  if (modal) modal.classList.remove('active');
  editTopicTarget = null;
}

async function confirmEditTopic() {
  if (!editTopicTarget) return;
  const input = document.getElementById('topicEditName');
  const nama = (input.value || '').trim();
  if (!nama) {
    showSnackbar('Nama topik tidak boleh kosong.', 'error');
    return;
  }
  const confirmBtn = document.getElementById('topicEditConfirmBtn');
  const confirmLoader = document.getElementById('topicEditConfirmLoader');
  confirmBtn.disabled = true;
  confirmLoader.classList.remove('hidden');
  const { error } = await supabaseClient
    .from('topics')
    .update({ nama: nama })
    .eq('id', editTopicTarget.id);
  confirmBtn.disabled = false;
  confirmLoader.classList.add('hidden');
  if (error) {
    console.error('Ganti nama topik error:', error.message);
    showSnackbar('Gagal mengganti nama topik: ' + error.message, 'error');
    return;
  }
  closeEditTopicModal();
  showSnackbar('Nama topik berhasil diubah.', 'success');
  await loadTopicManagement();
  await initTopicFilter();
  await loadSoal();
}

document.addEventListener('DOMContentLoaded', function () {
  const cancelBtn = document.getElementById('deleteCancelBtn');
  const confirmBtn = document.getElementById('deleteConfirmBtn');
  const overlay = document.getElementById('deleteModal');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeDeleteModal);
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmDelete);
  }
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDeleteModal();
    });
  }

  // Hapus semua soal
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) deleteAllBtn.addEventListener('click', openDeleteAllModal);
  const deleteAllCancelBtn = document.getElementById('deleteAllCancelBtn');
  if (deleteAllCancelBtn) deleteAllCancelBtn.addEventListener('click', closeDeleteAllModal);
  const deleteAllModal = document.getElementById('deleteAllModal');
  if (deleteAllModal) {
    deleteAllModal.addEventListener('click', function (e) {
      if (e.target === deleteAllModal) closeDeleteAllModal();
    });
  }
  const deleteAllConfirmBtn = document.getElementById('deleteAllConfirmBtn');
  if (deleteAllConfirmBtn) deleteAllConfirmBtn.addEventListener('click', confirmDeleteAll);

  // Kelola topik
  const topicSubject = document.getElementById('topicSubject');
  if (topicSubject) topicSubject.addEventListener('change', loadTopicManagement);
  const addTopicBtn = document.getElementById('addTopicBtn');
  if (addTopicBtn) addTopicBtn.addEventListener('click', addTopicHandler);
  const newTopicName = document.getElementById('newTopicName');
  if (newTopicName) {
    newTopicName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTopicHandler();
      }
    });
  }
  const topicDeleteCancel = document.getElementById('topicDeleteCancelBtn');
  const topicDeleteConfirm = document.getElementById('topicDeleteConfirmBtn');
  const topicDeleteModal = document.getElementById('topicDeleteModal');
  if (topicDeleteCancel) topicDeleteCancel.addEventListener('click', closeTopicDeleteModal);
  if (topicDeleteConfirm) topicDeleteConfirm.addEventListener('click', confirmDeleteTopic);
  if (topicDeleteModal) {
    topicDeleteModal.addEventListener('click', function (e) {
      if (e.target === topicDeleteModal) closeTopicDeleteModal();
    });
  }

  const topicEditCancel = document.getElementById('topicEditCancelBtn');
  const topicEditConfirm = document.getElementById('topicEditConfirmBtn');
  const topicEditModal = document.getElementById('topicEditModal');
  const topicEditName = document.getElementById('topicEditName');
  if (topicEditCancel) topicEditCancel.addEventListener('click', closeEditTopicModal);
  if (topicEditConfirm) topicEditConfirm.addEventListener('click', confirmEditTopic);
  if (topicEditModal) {
    topicEditModal.addEventListener('click', function (e) {
      if (e.target === topicEditModal) closeEditTopicModal();
    });
  }
  if (topicEditName) {
    topicEditName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEditTopic();
      }
    });
  }
});

// ============================================================
// CREATE / UPDATE (dipakai di form-soal.html)
// ============================================================

async function getSoalById(id) {
  const { data, error } = await supabaseClient
    .from('questions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('getSoalById error:', error.message);
    return null;
  }
  return data;
}

async function saveSoal(payload, soalId) {
  let result;
  if (soalId) {
    result = await supabaseClient
      .from('questions')
      .update(payload)
      .eq('id', soalId);
  } else {
    result = await supabaseClient
      .from('questions')
      .insert(payload);
  }
  return result;
}

// ============================================================
// IMPORT SOAL (dipakai di kelola-soal.html)
// ============================================================

// Heuristik: apakah baris ini kelihatan seperti awal soal (bukan prosa lanjutan)?
function looksLikeQuestionStart(t) {
  return (
    /^(?:pertanyaan|soal|no\.?|nomor)\s*\d+/i.test(t) ||
    /^\d+[.)\]]/.test(t) ||
    t.indexOf('?') >= 0 ||
    /\.\.\./.test(t)
  );
}

// Penanda soal yang jelas: "Pertanyaan 2?", "Soal 2.", "No. 1", "Nomor 4:", "1." ...
function strongQuestionMarker(t) {
  return (
    /^(?:pertanyaan|soal|no\.?|nomor)\s*\d+/i.test(t) ||
    /^\d+[.)\]]/.test(t)
  );
}

// Buang penanda nomor soal: "Pertanyaan 3?", "Soal 2.", "No. 1", "Nomor 4:", "1)", "#5"
function stripQuestionNumber(t) {
  return t
    .replace(/^(?:pertanyaan|soal|no\.?|nomor)\s*\d+\s*[?.:)\]-]*\s*/i, '')
    .replace(/^(?:#\s*\d+|\(\s*\d+\)|\d+\s*[.)\]:-])\s*/i, '')
    .trim();
}

// Normalisasi teks hasil paste: sisipkan baris baru di depan penanda yang
// menempel (paste tanpa enter), mis. "...adalah...A. ...B. ...Jawaban: ...Topik: ...
// Pertanyaan 2?..." Berbagai gaya opsi didukung: "A.", "A)", "A]", "A:", "(A)".
// Math seperti (2x - 3)(x + 4) tidak ikut terpecah.
function normalizeImportText(text) {
  if (!text) return '';
  const glued =
    /([^\n\r])(\s*)(?=(?:pertanyaan|soal|no\.?|nomor)\s*\d+\??|[a-dA-D][.)\]]\$|\(([a-dA-D])\)\s|[a-dA-D][.):\]]\s|jawaban\s*[:=]|kunci(?:\s+jawaban)?\s*[:=]|answer\s*[:=]|jenis\s*[:=]|tipe\s*[:=]|type\s*[:=]|topik\s*[:=]|materi\s*[:=]|bab\s*[:=])/gi;
  return text.replace(glued, '$1\n');
}

// Tentukan baris pertama yang benar-benar soal.
// Hanya menggeser jika ada penanda soal yang jelas ("Pertanyaan N?", "1." ...),
// jadi teks soal bebas (tanpa nomor/tanda tanya) tidak ikut termakan.
function findImportStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (strongQuestionMarker(t)) return i;
    // Kalau ketemu bagian opsi/jawaban sebelum ada yang mirip soal,
    // artinya baris-baris sebelumnya memang teks soal tanpa penanda -> mulai dari 0.
    if (/^[a-dA-D][.)\]:-]/.test(t) ||
        /^(?:ja?waban|kunci|answer)\s*[:=]/i.test(t) ||
        /^(?:topik|materi|bab)\s*[:=]/i.test(t)) return 0;
  }
  return 0;
}

function parseImportSoal(text) {
  const allLines = normalizeImportText(text).split(/\r?\n/);
  const start = findImportStart(allLines);
  const lines = allLines.slice(start);
  const blocks = [];
  let cur = null;
  let fenceOpen = false;

  const newBlock = function () {
    return { pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', jawaban_benar: '', topik: '', tipe: 'pg' };
  };

  function finalizeBlock() {
    if (cur) {
      cur.pertanyaan = cur.pertanyaan.trim();
      blocks.push(cur);
      cur = null;
    }
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line) continue;

    // Blok kode ```...```: gabung pakai baris baru dan JANGAN
    // ditafsirkan sebagai opsi/jawaban.
    const isFence = /^```/.test(line);
    if (!isFence && fenceOpen) {
      if (!cur) cur = newBlock();
      cur.pertanyaan = cur.pertanyaan ? cur.pertanyaan + '\n' + line : stripQuestionNumber(line);
      continue;
    }
    if (isFence) fenceOpen = !fenceOpen;

    const sudahLengkap = !!(cur &&
      cur.pilihan_a && cur.pilihan_b && cur.pilihan_c && cur.pilihan_d &&
      cur.jawaban_benar);

    // Jawaban: beragam gaya -> "Jawaban: A", "Jawaban = A", "Kunci: A",
    // "Kunci Jawaban: A", "Jawaban benar: A", "Jawaban yang benar: A", "Answer: A", "(A)"
    const ans = line.match(
      /^(?:(?:kunci\s+)?jawaban(?:\s+(?:yang\s+)?benar)?|kunci(?:\s+jawaban)?|answer)\s*[:=\-]?\s*(?:[\(\[\{]\s*)?([a-dA-D])\s*[\)\]\}]?\.?\s*(?:✅|✓|✔)?\s*$/i
    );

    // Topik: "Topik: Nama", "Sub Topik:", "Materi:", "Bab:" (wajib ada tanda)
    const topikMarker = line.match(/^(?:topik|sub\s*topik|materi|bab)\s*[:=\-]\s*(.+)$/i);

    // Jenis soal: "Jenis: Esai", "Tipe: Esai", "Type: Essay" (opsional, default PG)
    const tipeMarker = line.match(/^(?:jenis|tipe|type)\s*[:=\-]\s*(.+)$/i);

    // Opsi A-D: "A. teks", "A) teks", "A] teks", "A: teks", "(A) teks"
    // (tanpa "-" supaya baris math seperti "a - b = 1" tidak dianggap opsi)
    const opt = line.match(/^(?:\(([a-dA-D])\)|([a-dA-D])\s*[.)\]:])\s*(.*)$/);

    if (topikMarker) {
      if (!cur) cur = newBlock();
      cur.topik = topikMarker[1].trim();
    } else if (tipeMarker) {
      if (!cur) cur = newBlock();
      if (/esai|essay|uraian/i.test(tipeMarker[1])) cur.tipe = 'esai';
    } else if (ans) {
      if (!cur) cur = newBlock();
      cur.jawaban_benar = ans[1].toLowerCase();
    } else if (opt) {
      if (!cur) cur = newBlock();
      const key = (opt[1] || opt[2]).toLowerCase();
      const isi = (opt[3] || '').trim();
      if (isi) cur['pilihan_' + key] = isi;
    } else {
      if (sudahLengkap) {
        if (looksLikeQuestionStart(line)) {
          finalizeBlock();
          cur = newBlock();
          cur.pertanyaan = stripQuestionNumber(line);
        } else {
          // Baris ini bisa kelanjutan soal baru (tanpa penanda) atau penutup/nyampah.
          // Cari baris berikutnya: kalau ternyata penanda soal baru yang jelas,
          // anggap baris ini sekadar penutup dan buang.
          let nxt = null;
          for (let j = idx + 1; j < lines.length; j++) {
            if (lines[j].trim()) { nxt = lines[j].trim(); break; }
          }
          if (nxt && strongQuestionMarker(nxt)) {
            finalizeBlock();
          } else {
            finalizeBlock();
            cur = newBlock();
            cur.pertanyaan = stripQuestionNumber(line);
          }
        }
      } else if (cur) {
        if (cur.tipe === 'esai' && strongQuestionMarker(line)) {
          finalizeBlock();
          cur = newBlock();
          cur.pertanyaan = stripQuestionNumber(line);
        } else {
          const join = (isFence || fenceOpen) ? '\n' : ' ';
          cur.pertanyaan = cur.pertanyaan
            ? cur.pertanyaan + join + line
            : stripQuestionNumber(line);
        }
      } else {
        cur = newBlock();
        cur.pertanyaan = stripQuestionNumber(line);
      }
    }
  }
  finalizeBlock();

  const valid = blocks.filter(function (b) {
    if (b.tipe === 'esai') return !!b.pertanyaan;
    return b.pertanyaan && b.jawaban_benar &&
      b.pilihan_a && b.pilihan_b && b.pilihan_c && b.pilihan_d;
  });
  return { valid: valid, skipped: blocks.length - valid.length };
}

function downloadImportExample() {
  const sample =
    '1. Berapa hasil dari 2 + 2?\n' +
    'A. 3\n' +
    'B. 4\n' +
    'C. 5\n' +
    'D. 6\n' +
    'Jawaban: B\n' +
    'Topik: Aritmatika Dasar\n' +
    '\n' +
    '2. Ibu kota Indonesia adalah ...\n' +
    'A. Surabaya\n' +
    'B. Bandung\n' +
    'C. Jakarta\n' +
    'D. Medan\n' +
    'Jawaban: C\n' +
    '\n' +
    '3. Tuliskan output dari kode berikut:\n' +
    '```python\n' +
    'print("Hello")\n' +
    'print(2 + 3)\n' +
    '```\n' +
    'Jenis: Esai';
  const blob = new Blob([sample], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contoh-format-soal-simu.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportSoal() {
  const btn = document.getElementById('exportBtn');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Mengexport...';
  }
  const [qRes, tRes] = await Promise.all([
    supabaseClient
      .from('questions')
      .select('id, pertanyaan, tipe, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, subject_id, topic_id')
      .order('created_at'),
    supabaseClient.from('topics').select('id, nama')
  ]);

  if (btn) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Export';
  }

  if (qRes.error) {
    showSnackbar('Gagal export: ' + qRes.error.message, 'error');
    return;
  }

  const data = qRes.data || [];
  if (data.length === 0) {
    showSnackbar('Belum ada soal untuk diexport.', 'warning');
    return;
  }

  const topicMap = {};
  (tRes.data || []).forEach(function (t) { topicMap[t.id] = t.nama; });

  const opts = ['a', 'b', 'c', 'd'];
  const lines = [];
  data.forEach(function (q, i) {
    lines.push((i + 1) + '. ' + (q.pertanyaan || ''));
    if (q.tipe === 'esai') {
      lines.push('Jenis: Esai');
    } else {
      opts.forEach(function (k) {
        const label = k.toUpperCase() + '.';
        lines.push(label + ' ' + (q['pilihan_' + k] || ''));
      });
      lines.push('Jawaban: ' + String(q.jawaban_benar || '').toUpperCase());
    }
    if (q.topic_id && topicMap[q.topic_id]) lines.push('Topik: ' + topicMap[q.topic_id]);
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bank-soal-simu.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showSnackbar((data || []).length + ' soal berhasil diexport.', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportSoal);
  }
  const modal = document.getElementById('importModal');
  if (!importBtn || !modal) return;

  const subjectSelect = document.getElementById('importSubject');
  const topicSelect = document.getElementById('importTopic');
  const errEl = document.getElementById('importError');
  const resEl = document.getElementById('importResult');

  function showImportErr(msg) {
    resEl.classList.add('hidden');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  function closeImportModal() {
    modal.classList.remove('active');
    errEl.classList.add('hidden');
    resEl.classList.add('hidden');
  }

  supabaseClient.from('subjects').select('id, nama').order('nama')
    .then(function ({ data, error }) {
      if (error) return;
      (data || []).forEach(function (s) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nama;
        subjectSelect.appendChild(opt);
      });
    });

  async function refreshImportTopics() {
    if (!topicSelect) return;
    const sid = subjectSelect.value;
    topicSelect.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = sid ? '(Tentukan per soal / Tanpa Topik)' : '(Pilih Mapel dulu)';
    topicSelect.appendChild(defOpt);
    if (!sid) return;
    const topics = await loadTopicsForSubject(sid);
    topics.forEach(function (t) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.nama;
      topicSelect.appendChild(opt);
    });
  }
  subjectSelect.addEventListener('change', refreshImportTopics);

  async function resolveTopicIds(rows, text) {
    const sid = subjectSelect.value;
    const defaultTopicId = topicSelect ? topicSelect.value : '';
    const map = {};
    const result = [];
    for (const row of rows) {
      const topikName = (row.topik || '').trim();
      const clean = function (r) {
        return {
          subject_id: sid,
          pertanyaan: r.pertanyaan,
          tipe: r.tipe || 'pg',
          pilihan_a: r.pilihan_a,
          pilihan_b: r.pilihan_b,
          pilihan_c: r.pilihan_c,
          pilihan_d: r.pilihan_d,
          jawaban_benar: r.jawaban_benar
        };
      };
      if (!topikName) {
        result.push(Object.assign({}, clean(row), { topic_id: defaultTopicId || null }));
        continue;
      }
      if (!map[topikName]) {
        const { data: existing } = await supabaseClient
          .from('topics')
          .select('id')
          .eq('subject_id', sid)
          .eq('nama', topikName)
          .maybeSingle();
        if (existing) {
          map[topikName] = existing.id;
        } else {
          const { data: created, error: createErr } = await supabaseClient
            .from('topics')
            .insert({ subject_id: sid, nama: topikName })
            .select('id')
            .single();
          if (createErr) {
            showImportErr('Gagal membuat topik "' + topikName + '": ' + createErr.message);
            return null;
          }
          map[topikName] = created.id;
        }
      }
      result.push(Object.assign({}, clean(row), { topic_id: map[topikName] }));
    }
    return result;
  }

  importBtn.addEventListener('click', function () { modal.classList.add('active'); });
  document.getElementById('importCancelBtn').addEventListener('click', closeImportModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeImportModal(); });
  document.getElementById('importExampleBtn').addEventListener('click', downloadImportExample);

  document.getElementById('importSaveBtn').addEventListener('click', async function () {
    const subjectId = subjectSelect.value;
    const text = document.getElementById('importArea').value;
    errEl.classList.add('hidden');
    resEl.classList.add('hidden');

    if (!subjectId) { showImportErr('Pilih mata pelajaran dulu.'); return; }
    if (!text.trim()) { showImportErr('Tempel isi soal terlebih dahulu.'); return; }

    const res = parseImportSoal(text);
    if (res.valid.length === 0) {
      showImportErr('Tidak ada soal valid. Pastikan tiap soal punya pilihan A-D dan baris Jawaban.');
      return;
    }

    const rows = res.valid.map(function (q) {
      return {
        pertanyaan: q.pertanyaan,
        tipe: q.tipe || 'pg',
        pilihan_a: q.pilihan_a,
        pilihan_b: q.pilihan_b,
        pilihan_c: q.pilihan_c,
        pilihan_d: q.pilihan_d,
        jawaban_benar: q.jawaban_benar,
        topik: q.topik || ''
      };
    });

    const resolved = await resolveTopicIds(rows, text);
    if (!resolved) return;

    const btn = document.getElementById('importSaveBtn');
    const btnText = document.getElementById('importSaveText');
    const btnLoader = document.getElementById('importSaveLoader');
    btn.disabled = true;
    btnText.textContent = 'Mengimport...';
    btnLoader.classList.remove('hidden');

    const { error } = await supabaseClient.from('questions').insert(resolved);

    btn.disabled = false;
    btnText.textContent = 'Import';
    btnLoader.classList.add('hidden');

    if (error) { showImportErr('Gagal import: ' + error.message); return; }

    resEl.textContent = res.valid.length + ' soal berhasil diimport.' +
      (res.skipped > 0 ? ' (' + res.skipped + ' blok tidak lengkap dilewati)' : '');
    resEl.classList.remove('hidden');
    document.getElementById('importArea').value = '';
    showSnackbar('Import soal berhasil.', 'success');
    if (typeof loadSoal === 'function') await loadSoal();
    if (typeof loadTopicManagement === 'function') await loadTopicManagement();
    await refreshImportTopics();
  });
});