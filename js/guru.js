// ============================================================
// KELOLA GURU (akun admin) - kelola-guru.html
// ============================================================

function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let currentProfile = null;
let guruTarget = null;

document.addEventListener('DOMContentLoaded', async function () {
  const profile = await guard('admin');
  if (!profile) return;
  currentProfile = profile;
  document.getElementById('userName').textContent = profile.nama || 'Admin';

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  hamburgerBtn.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
  document.getElementById('logoutBtn').addEventListener('click', function (e) {
    e.preventDefault();
    logout();
  });

  const addBtn = document.getElementById('addGuruBtn');
  if (addBtn) addBtn.addEventListener('click', openAddGuruModal);
  const addCancelBtn = document.getElementById('guruAddCancelBtn');
  if (addCancelBtn) addCancelBtn.addEventListener('click', closeAddGuruModal);
  const guruAddModal = document.getElementById('guruAddModal');
  if (guruAddModal) {
    guruAddModal.addEventListener('click', function (e) {
      if (e.target === guruAddModal) closeAddGuruModal();
    });
  }
  const addConfirmBtn = document.getElementById('guruAddConfirmBtn');
  if (addConfirmBtn) addConfirmBtn.addEventListener('click', confirmAddGuru);

  const resetCancelBtn = document.getElementById('guruResetCancelBtn');
  if (resetCancelBtn) resetCancelBtn.addEventListener('click', closeResetGuruModal);
  const guruResetModal = document.getElementById('guruResetModal');
  if (guruResetModal) {
    guruResetModal.addEventListener('click', function (e) {
      if (e.target === guruResetModal) closeResetGuruModal();
    });
  }
  const resetConfirmBtn = document.getElementById('guruResetConfirmBtn');
  if (resetConfirmBtn) resetConfirmBtn.addEventListener('click', confirmResetGuru);
  const guruResetPassword = document.getElementById('guruResetPassword');
  if (guruResetPassword) {
    guruResetPassword.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmResetGuru();
      }
    });
  }

  const deleteCancelBtn = document.getElementById('guruDeleteCancelBtn');
  if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteGuruModal);
  const guruDeleteModal = document.getElementById('guruDeleteModal');
  if (guruDeleteModal) {
    guruDeleteModal.addEventListener('click', function (e) {
      if (e.target === guruDeleteModal) closeDeleteGuruModal();
    });
  }
  const deleteConfirmBtn = document.getElementById('guruDeleteConfirmBtn');
  if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', confirmDeleteGuru);

  await loadGuru();
});

async function loadGuru() {
  const loadingBox = document.getElementById('loadingBox');
  const emptyState = document.getElementById('emptyState');
  const tableCard = document.getElementById('tableCard');
  const cardList = document.getElementById('guruCardList');

  const [subjRes, guruRes] = await Promise.all([
    supabaseClient.from('subjects').select('id, nama').order('nama'),
    supabaseClient.from('users').select('id, email, nama, subject_id').eq('role', 'admin').order('nama')
  ]);

  const subjectMap = {};
  (subjRes.data || []).forEach(function (s) { subjectMap[s.id] = s.nama; });

  const subjectSelect = document.getElementById('guruSubjectId');
  subjectSelect.innerHTML = '<option value="">Tidak ditentukan</option>';
  (subjRes.data || []).forEach(function (s) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nama;
    subjectSelect.appendChild(opt);
  });

  const guruData = guruRes.data || [];
  loadingBox.classList.add('hidden');

  if (guruData.length === 0) {
    emptyState.classList.remove('hidden');
    lucide.createIcons();
    return;
  }

  tableCard.style.display = 'block';
  const tbody = document.getElementById('guruTableBody');
  tbody.innerHTML = '';
  cardList.innerHTML = '';

  guruData.forEach(function (g) {
    const isSelf = g.id === currentProfile.id;
    const subjName = subjectMap[g.subject_id] || 'Tidak ditentukan';
    const badge = isSelf ? ' <span class="badge badge-outline">Akun Anda</span>' : '';
    const resetBtn = '<button class="btn btn-secondary btn-sm btn-reset-guru" data-id="' + g.id + '" data-nama="' + escapeHtml(g.nama || '') + '"><i data-lucide="key-round"></i> Reset Password</button>';
    const delBtn = '<button class="btn btn-danger btn-sm btn-delete-guru" data-id="' + g.id + '" data-nama="' + escapeHtml(g.nama || '') + '"><i data-lucide="trash-2"></i> Hapus</button>';

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="font-medium">' + escapeHtml(g.nama || '-') + badge + '</td>' +
      '<td class="hint">' + escapeHtml(g.email || '-') + '</td>' +
      '<td>' + escapeHtml(subjName) + '</td>' +
      '<td>' + resetBtn + (isSelf ? '' : ' ' + delBtn) + '</td>';
    tbody.appendChild(tr);

    const card = document.createElement('div');
    card.className = 'card card-mobile soal-card';
    card.innerHTML =
      '<p class="font-medium">' + escapeHtml(g.nama || '-') + badge + '</p>' +
      '<p class="hint">' + escapeHtml(g.email || '-') + '</p>' +
      '<p class="hint">Mapel: ' + escapeHtml(subjName) + '</p>' +
      '<div class="mt-12">' + resetBtn + (isSelf ? '' : ' ' + delBtn) + '</div>';
    cardList.appendChild(card);
  });

  tbody.querySelectorAll('.btn-reset-guru').forEach(function (b) {
    b.addEventListener('click', function () { openResetGuruModal(b.dataset.id, b.dataset.nama); });
  });
  tbody.querySelectorAll('.btn-delete-guru').forEach(function (b) {
    b.addEventListener('click', function () { openDeleteGuruModal(b.dataset.id, b.dataset.nama); });
  });
  cardList.querySelectorAll('.btn-reset-guru').forEach(function (b) {
    b.addEventListener('click', function () { openResetGuruModal(b.dataset.id, b.dataset.nama); });
  });
  cardList.querySelectorAll('.btn-delete-guru').forEach(function (b) {
    b.addEventListener('click', function () { openDeleteGuruModal(b.dataset.id, b.dataset.nama); });
  });

  lucide.createIcons();
}

// -- Tambah guru --
function openAddGuruModal() {
  document.getElementById('guruNama').value = '';
  document.getElementById('guruEmail').value = '';
  document.getElementById('guruPassword').value = '';
  const errEl = document.getElementById('guruAddError');
  errEl.classList.add('hidden');
  errEl.textContent = '';
  document.getElementById('guruAddModal').classList.add('active');
  document.getElementById('guruNama').focus();
}

function closeAddGuruModal() {
  document.getElementById('guruAddModal').classList.remove('active');
}

async function confirmAddGuru() {
  const nama = (document.getElementById('guruNama').value || '').trim();
  const email = (document.getElementById('guruEmail').value || '').trim().toLowerCase();
  const password = document.getElementById('guruPassword').value || '';
  const subject_id = document.getElementById('guruSubjectId').value || null;
  const errEl = document.getElementById('guruAddError');

  if (!nama || !email || !password) {
    errEl.textContent = 'Nama, email, dan password wajib diisi.';
    errEl.classList.remove('hidden');
    return;
  }
  if (email.indexOf('@') < 0) {
    errEl.textContent = 'Format email tidak valid.';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password minimal 6 karakter.';
    errEl.classList.remove('hidden');
    return;
  }

  const confirmBtn = document.getElementById('guruAddConfirmBtn');
  const loadEl = document.getElementById('guruAddConfirmLoader');
  confirmBtn.disabled = true;
  loadEl.classList.remove('hidden');

  const { error } = await supabaseClient.rpc('create_guru', {
    p_data: { email: email, password: password, nama: nama, subject_id: subject_id }
  });

  confirmBtn.disabled = false;
  loadEl.classList.add('hidden');

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden');
    return;
  }

  closeAddGuruModal();
  showSnackbar('Akun guru ' + nama + ' berhasil dibuat.', 'success');
  await loadGuru();
}

// -- Reset password --
function openResetGuruModal(id, nama) {
  guruTarget = id;
  document.getElementById('guruResetName').textContent = nama || '';
  document.getElementById('guruResetPassword').value = '';
  document.getElementById('guruResetModal').classList.add('active');
  document.getElementById('guruResetPassword').focus();
}

function closeResetGuruModal() {
  document.getElementById('guruResetModal').classList.remove('active');
  guruTarget = null;
}

async function confirmResetGuru() {
  if (!guruTarget) return;
  const password = document.getElementById('guruResetPassword').value || '';
  if (password.length < 6) {
    showSnackbar('Password minimal 6 karakter.', 'error');
    return;
  }

  const confirmBtn = document.getElementById('guruResetConfirmBtn');
  const loadEl = document.getElementById('guruResetConfirmLoader');
  confirmBtn.disabled = true;
  loadEl.classList.remove('hidden');

  const { error } = await supabaseClient.rpc('reset_guru_password', {
    p_user_id: guruTarget,
    p_password: password
  });

  confirmBtn.disabled = false;
  loadEl.classList.add('hidden');

  if (error) {
    showSnackbar('Gagal reset password: ' + error.message, 'error');
    return;
  }

  closeResetGuruModal();
  showSnackbar('Password berhasil direset.', 'success');
}

// -- Hapus guru --
function openDeleteGuruModal(id, nama) {
  guruTarget = id;
  document.getElementById('guruDeleteText').textContent =
    'Hapus akun guru "' + (nama || '') + '"? Akun tidak bisa login lagi. Soal dan ujian yang sudah dibuat tidak ikut terhapus.';
  document.getElementById('guruDeleteModal').classList.add('active');
}

function closeDeleteGuruModal() {
  document.getElementById('guruDeleteModal').classList.remove('active');
  guruTarget = null;
}

async function confirmDeleteGuru() {
  if (!guruTarget) return;

  const confirmBtn = document.getElementById('guruDeleteConfirmBtn');
  const loadEl = document.getElementById('guruDeleteConfirmLoader');
  confirmBtn.disabled = true;
  loadEl.classList.remove('hidden');

  const { error } = await supabaseClient.rpc('delete_guru', { p_user_id: guruTarget });

  confirmBtn.disabled = false;
  loadEl.classList.add('hidden');

  if (error) {
    showSnackbar('Gagal menghapus guru: ' + error.message, 'error');
    return;
  }

  closeDeleteGuruModal();
  showSnackbar('Akun guru berhasil dihapus.', 'success');
  await loadGuru();
}