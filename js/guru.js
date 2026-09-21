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

function togglePasswordInput(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input || !btn) return;
  btn.addEventListener('click', function () {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
    btn.setAttribute('aria-label', showing ? 'Lihat password' : 'Sembunyikan password');
    btn.innerHTML = showing ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
    lucide.createIcons();
  });
}

let currentProfile = null;
let guruTarget = null;
let allGuru = [];
let guruSubjectName = {};   // id -> nama mapel
let lastCred = null;        // email & password yang baru dibuat

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
  togglePasswordInput('guruPassword', 'guruPasswordToggle');
  togglePasswordInput('guruResetPassword', 'guruResetToggle');

  const guruPassword = document.getElementById('guruPassword');
  if (guruPassword) {
    guruPassword.addEventListener('input', function () {
      const hint = document.getElementById('guruPasswordHint');
      if (guruPassword.value.length >= 6) {
        hint.textContent = 'Password kuat.';
        hint.classList.add('text-success');
      } else {
        hint.textContent = 'Minimal 6 karakter.';
        hint.classList.remove('text-success');
      }
    });
  }

  const copyCred = document.getElementById('guruCopyCred');
  if (copyCred) copyCred.addEventListener('click', copyLastCred);
  const addAnother = document.getElementById('guruAddAnotherBtn');
  if (addAnother) addAnother.addEventListener('click', openAddGuruModal);

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

  // Edit guru
  togglePasswordInput('guruEditPassword', 'guruEditToggle');
  const editCancelBtn = document.getElementById('guruEditCancelBtn');
  if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditGuruModal);
  const guruEditModal = document.getElementById('guruEditModal');
  if (guruEditModal) {
    guruEditModal.addEventListener('click', function (e) {
      if (e.target === guruEditModal) closeEditGuruModal();
    });
  }
  const editConfirmBtn = document.getElementById('guruEditConfirmBtn');
  if (editConfirmBtn) editConfirmBtn.addEventListener('click', confirmEditGuru);
  const guruEditPassword = document.getElementById('guruEditPassword');
  if (guruEditPassword) {
    guruEditPassword.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEditGuru();
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

  document.getElementById('searchGuru').addEventListener('input', applyGuruFilter);

  await loadGuru();
});

async function loadGuru() {
  const loadingBox = document.getElementById('loadingBox');
  const [subjRes, guruRes] = await Promise.all([
    supabaseClient.from('subjects').select('id, nama').order('nama'),
    supabaseClient.from('users').select('id, email, nama, subject_id, role').in('role', ['admin', 'guru']).order('nama')
  ]);

  guruSubjectName = {};
  (subjRes.data || []).forEach(function (s) { guruSubjectName[s.id] = s.nama; });

  const subjectSelect = document.getElementById('guruSubjectId');
  subjectSelect.innerHTML = '<option value="">Tidak ditentukan</option>';
  const editSubjectSelect = document.getElementById('guruEditSubject');
  if (editSubjectSelect) editSubjectSelect.innerHTML = '<option value="">Tidak ditentukan</option>';
  (subjRes.data || []).forEach(function (s) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nama;
    subjectSelect.appendChild(opt);
    if (editSubjectSelect) editSubjectSelect.appendChild(opt.cloneNode(true));
  });

  allGuru = guruRes.data || [];
  loadingBox.classList.add('hidden');
  applyGuruFilter();
  lucide.createIcons();
}

function applyGuruFilter() {
  const q = (document.getElementById('searchGuru').value || '').trim().toLowerCase();
  const filtered = allGuru.filter(function (g) {
    if (!q) return true;
    return (g.nama || '').toLowerCase().indexOf(q) >= 0 ||
      (g.email || '').toLowerCase().indexOf(q) >= 0;
  });

  document.getElementById('guruCount').textContent = filtered.length + ' dari ' + allGuru.length + ' guru';

  const emptyState = document.getElementById('emptyState');
  const emptyText = document.getElementById('emptyGuruText');
  const tableCard = document.getElementById('tableCard');
  const cardList = document.getElementById('guruCardList');
  const tbody = document.getElementById('guruTableBody');
  tbody.innerHTML = '';
  cardList.innerHTML = '';

  if (filtered.length === 0) {
    tableCard.style.display = 'none';
    emptyState.classList.remove('hidden');
    emptyText.textContent = allGuru.length === 0 ? 'Belum ada data guru.' : 'Tidak ada guru yang cocok dengan pencarian.';
    lucide.createIcons();
    return;
  }

  emptyState.classList.add('hidden');
  tableCard.style.display = 'block';

  filtered.forEach(function (g) {
    const isSelf = g.id === currentProfile.id;
    const subjName = g.role === 'admin' ? 'Semua mapel' : (guruSubjectName[g.subject_id] || 'Belum diatur');
    const badge = isSelf ? ' <span class="badge badge-outline">Akun Anda</span>' : '';
    const roleBadge = g.role === 'admin'
      ? ' <span class="badge badge-outline">Admin Penuh</span>'
      : ' <span class="badge badge-outline">Guru</span>';
    const resetBtn = '<button class="btn btn-secondary btn-sm btn-reset-guru" data-id="' + g.id + '" data-nama="' + escapeHtml(g.nama || '') + '"><i data-lucide="key-round"></i> Reset</button>';
    const editBtn = '<button class="btn btn-secondary btn-sm btn-edit-guru" data-id="' + g.id + '"><i data-lucide="pencil"></i> Edit</button>';
    const delBtn = '<button class="btn btn-danger btn-sm btn-delete-guru" data-id="' + g.id + '" data-nama="' + escapeHtml(g.nama || '') + '"><i data-lucide="trash-2"></i> Hapus</button>';

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="font-medium">' + escapeHtml(g.nama || '-') + badge + roleBadge + '</td>' +
      '<td class="hint">' + escapeHtml(g.email || '-') + '</td>' +
      '<td>' + escapeHtml(subjName) + '</td>' +
      '<td>' + editBtn + ' ' + resetBtn + ' ' + delBtn + '</td>';
    tbody.appendChild(tr);

    const card = document.createElement('div');
    card.className = 'card card-mobile soal-card';
    card.innerHTML =
      '<p class="font-medium">' + escapeHtml(g.nama || '-') + badge + roleBadge + '</p>' +
      '<p class="hint">' + escapeHtml(g.email || '-') + '</p>' +
      '<p class="hint">Mapel: ' + escapeHtml(subjName) + '</p>' +
      '<div class="mt-12">' + editBtn + ' ' + resetBtn + ' ' + delBtn + '</div>';
    cardList.appendChild(card);
  });

  document.querySelectorAll('.btn-reset-guru').forEach(function (b) {
    b.addEventListener('click', function () { openResetGuruModal(b.dataset.id, b.dataset.nama); });
  });
  document.querySelectorAll('.btn-edit-guru').forEach(function (b) {
    b.addEventListener('click', function () { openEditGuruModal(b.dataset.id); });
  });
  document.querySelectorAll('.btn-delete-guru').forEach(function (b) {
    b.addEventListener('click', function () { openDeleteGuruModal(b.dataset.id, b.dataset.nama); });
  });

  lucide.createIcons();
}

// -- Tambah guru --
function openAddGuruModal() {
  document.getElementById('guruNama').value = '';
  document.getElementById('guruEmail').value = '';
  document.getElementById('guruPassword').value = '';
  document.getElementById('guruPassword').type = 'password';
  document.getElementById('guruPasswordToggle').innerHTML = '<i data-lucide="eye"></i>';
  const hint = document.getElementById('guruPasswordHint');
  hint.textContent = 'Minimal 6 karakter.';
  hint.classList.remove('text-success');
  document.getElementById('guruCreated').classList.add('hidden');
  const errEl = document.getElementById('guruAddError');
  errEl.classList.add('hidden');
  errEl.textContent = '';
  document.getElementById('guruSubjectId').value = '';
  document.getElementById('guruAddModal').classList.add('active');
  document.getElementById('guruNama').focus();
}

function closeAddGuruModal() {
  document.getElementById('guruAddModal').classList.remove('active');
}

function resetAddGuruUi() {
  document.getElementById('guruCreated').classList.add('hidden');
  document.getElementById('guruNama').value = '';
  document.getElementById('guruEmail').value = '';
  document.getElementById('guruPassword').value = '';
  document.getElementById('guruPassword').type = 'password';
  document.getElementById('guruPasswordToggle').innerHTML = '<i data-lucide="eye"></i>';
  const hint = document.getElementById('guruPasswordHint');
  hint.textContent = 'Minimal 6 karakter.';
  hint.classList.remove('text-success');
  const errEl = document.getElementById('guruAddError');
  errEl.classList.add('hidden');
  document.getElementById('guruSubjectId').value = '';
  document.getElementById('guruNama').focus();
}

async function confirmAddGuru() {
  const nama = (document.getElementById('guruNama').value || '').trim();
  const loginIn = (document.getElementById('guruEmail').value || '').trim().toLowerCase();
  const password = document.getElementById('guruPassword').value || '';
  const subject_id = document.getElementById('guruSubjectId').value || null;
  const errEl = document.getElementById('guruAddError');

  if (!nama || !loginIn || !password) {
    errEl.textContent = 'Nama, email/username, dan password wajib diisi.';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password minimal 6 karakter.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!subject_id) {
    errEl.textContent = 'Mata pelajaran yang diampu wajib dipilih.';
    errEl.classList.remove('hidden');
    return;
  }

  // Username (tanpa @) otomatis jadi <username>@simu.local (mengikuti RPC create_guru).
  const email = loginIn.indexOf('@') < 0 ? loginIn + '@simu.local' : loginIn;

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

  // Simpan kredensial & tampilkan panel agar bisa disalin
  lastCred = { nama: nama, email: email, password: password };
  document.getElementById('guruCredText').textContent =
    'Nama     : ' + nama + '\nEmail    : ' + email + '\nPassword : ' + password;
  document.getElementById('guruCreated').classList.remove('hidden');
  document.getElementById('guruAddError').classList.add('hidden');
  document.getElementById('guruAddError').textContent = '';
  showSnackbar('Akun guru ' + nama + ' berhasil dibuat.', 'success');
  await loadGuru();
}

function copyLastCred() {
  if (!lastCred) return;
  const text = 'Nama: ' + lastCred.nama + '\nEmail: ' + lastCred.email + '\nPassword: ' + lastCred.password;
  const ok = copyTextToClipboard(text);
  showSnackbar(ok ? 'Kredensial disalin ke clipboard.' : 'Gagal menyalin.', ok ? 'success' : 'error');
}

function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

// -- Reset password --
function openResetGuruModal(id, nama) {
  guruTarget = id;
  document.getElementById('guruResetName').textContent = nama || '';
  document.getElementById('guruResetPassword').value = '';
  document.getElementById('guruResetPassword').type = 'password';
  document.getElementById('guruResetToggle').innerHTML = '<i data-lucide="eye"></i>';
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

// -- Edit guru (nama, mapel, email/username, password) --
function openEditGuruModal(id) {
  const g = allGuru.find(function (x) { return x.id === id; });
  if (!g) return;
  guruTarget = id;
  document.getElementById('guruEditName').textContent = g.nama || '';
  document.getElementById('guruEditNama').value = g.nama || '';
  const roleEl = document.getElementById('guruEditRole');
  if (roleEl) roleEl.value = g.role || 'guru';
  document.getElementById('guruEditSubject').value = g.subject_id || '';
  document.getElementById('guruEditEmail').value = '';
  document.getElementById('guruEditEmail').placeholder = g.email || 'email atau username';
  document.getElementById('guruEditPassword').value = '';
  document.getElementById('guruEditPassword').type = 'password';
  document.getElementById('guruEditToggle').innerHTML = '<i data-lucide="eye"></i>';
  document.getElementById('guruEditModal').classList.add('active');
  document.getElementById('guruEditNama').focus();
}

function closeEditGuruModal() {
  document.getElementById('guruEditModal').classList.remove('active');
  guruTarget = null;
}

async function confirmEditGuru() {
  if (!guruTarget) return;
  const g = allGuru.find(function (x) { return x.id === guruTarget; });
  if (!g) return;

  const nama = (document.getElementById('guruEditNama').value || '').trim();
  const subjectVal = document.getElementById('guruEditSubject').value || '';
  const roleEl = document.getElementById('guruEditRole');
  const roleVal = (roleEl ? roleEl.value : (g.role || 'guru')) || 'guru';
  const email = (document.getElementById('guruEditEmail').value || '').trim().toLowerCase();
  const password = document.getElementById('guruEditPassword').value || '';

  if (!nama) {
    showSnackbar('Nama lengkap wajib diisi.', 'error');
    return;
  }
  if (roleVal === 'guru' && !subjectVal) {
    showSnackbar('Guru wajib punya mata pelajaran yang diampu.', 'error');
    return;
  }
  if (password && password.length < 6) {
    showSnackbar('Password minimal 6 karakter.', 'error');
    return;
  }

  const profilBerubah = (nama !== (g.nama || '')) ||
    (subjectVal !== (g.subject_id || '')) ||
    (roleVal !== (g.role || 'guru'));
  const loginBerubah = email !== '' || password !== '';

  if (!profilBerubah && !loginBerubah) {
    showSnackbar('Tidak ada perubahan.', 'error');
    return;
  }

  const confirmBtn = document.getElementById('guruEditConfirmBtn');
  const loadEl = document.getElementById('guruEditConfirmLoader');
  confirmBtn.disabled = true;
  loadEl.classList.remove('hidden');

  // 1) Nama & mapel
  if (profilBerubah) {
    const { error } = await supabaseClient.rpc('update_guru_profil', {
      p_user_id: guruTarget,
      p_nama: nama,
      p_subject_id: subjectVal || null,
      p_clear_subject: subjectVal === '',
      p_role: roleVal
    });
    if (error) {
      confirmBtn.disabled = false;
      loadEl.classList.add('hidden');
      showSnackbar('Gagal menyimpan profil: ' + error.message, 'error');
      return;
    }
  }

  // 2) Email/username & password
  if (loginBerubah) {
    const { error } = await supabaseClient.rpc('update_guru_login', {
      p_user_id: guruTarget,
      p_email: email || null,
      p_password: password || null
    });
    if (error) {
      confirmBtn.disabled = false;
      loadEl.classList.add('hidden');
      showSnackbar('Gagal menyimpan login: ' + error.message, 'error');
      await loadGuru();
      return;
    }
  }

  confirmBtn.disabled = false;
  loadEl.classList.add('hidden');
  closeEditGuruModal();
  showSnackbar('Data guru berhasil diperbarui.', 'success');
  await loadGuru();
}

// -- Hapus guru --
function openDeleteGuruModal(id, nama) {
  guruTarget = id;
  const isSelf = currentProfile && id === currentProfile.id;
  document.getElementById('guruDeleteText').innerHTML = isSelf
    ? 'PERINGATAN: ini <b>akun Anda sendiri</b> ("' + escapeHtml(nama || '') + '"). Setelah dihapus Anda langsung keluar dan tidak bisa login lagi dengan akun ini. Soal & ujian yang sudah dibuat tidak ikut terhapus.'
    : 'Hapus akun guru "' + escapeHtml(nama || '') + '"? Akun tidak bisa login lagi. Soal dan ujian yang sudah dibuat tidak ikut terhapus.';
  document.getElementById('guruDeleteModal').classList.add('active');
}

function closeDeleteGuruModal() {
  document.getElementById('guruDeleteModal').classList.remove('active');
  guruTarget = null;
}

async function confirmDeleteGuru() {
  if (!guruTarget) return;

  const target = guruTarget;
  const isSelf = currentProfile && target === currentProfile.id;
  const confirmBtn = document.getElementById('guruDeleteConfirmBtn');
  const loadEl = document.getElementById('guruDeleteConfirmLoader');
  confirmBtn.disabled = true;
  loadEl.classList.remove('hidden');

  const { error } = await supabaseClient.rpc('delete_guru', { p_user_id: target });

  confirmBtn.disabled = false;
  loadEl.classList.add('hidden');

  if (error) {
    showSnackbar('Gagal menghapus guru: ' + error.message, 'error');
    return;
  }

  closeDeleteGuruModal();
  showSnackbar('Akun guru berhasil dihapus.', 'success');

  // Kalau menghapus akun sendiri, sesi tidak valid lagi -> kembali ke login.
  if (isSelf) {
    try { await supabaseClient.auth.signOut(); } catch (e) {}
    setTimeout(function () { window.location.href = 'admin.html'; }, 800);
    return;
  }

  await loadGuru();
}