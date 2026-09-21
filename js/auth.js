// ============================================================
// js/auth.js - Autentikasi SIMU
// Supabase Auth + role check
// ============================================================

// -- Helper: ambil profil user dari tabel public.users --
async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('getProfile error:', error.message);
    return null;
  }
  return data;
}

// -- Helper: tampilkan snackbar --
function showSnackbar(message, type = 'error') {
  let snackbar = document.getElementById('snackbar');
  if (!snackbar) {
    snackbar = document.createElement('div');
    snackbar.id = 'snackbar';
    snackbar.className = 'snackbar';
    document.body.appendChild(snackbar);
  }
  snackbar.textContent = message;
  snackbar.className = 'snackbar snackbar-' + type + ' show';
  clearTimeout(showSnackbar._timer);
  showSnackbar._timer = setTimeout(() => {
    snackbar.classList.remove('show');
  }, 3000);
}

// -- Helper: tampilkan pesan error di form login --
function showFormError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearFormError(el) {
  el.classList.add('hidden');
  el.textContent = '';
}

// ============================================================
// LOGIN SISWA (NIS + password)
// Siswa login memakai NIS sebagai username. Bila kolom diisi email
// (mengandung @), email tersebut langsung dipakai. Jika tidak (NIS),
// dibentuk ke email semu <nis>@simu.local.
// ============================================================
async function loginSiswa() {
  const raw = document.getElementById('nis').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');

  if (!raw || !password) {
    showFormError(errorEl, 'Harap isi NIS/username dan password.');
    return;
  }

  clearFormError(errorEl);
  let email = raw;
  if (raw.indexOf('@') === -1) {
    email = raw + '@simu.local';
  }

  // Set loading state
  submitBtn.disabled = true;
  btnText.textContent = 'Memproses...';
  btnLoader.classList.remove('hidden');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const profile = await getProfile(data.user.id);

    if (!profile) {
      await supabaseClient.auth.signOut();
      throw new Error('Akun tidak ditemukan. Hubungi admin sekolah.');
    }

    if (profile.role !== 'siswa') {
      await supabaseClient.auth.signOut();
      throw new Error('Akun ini bukan akun siswa.');
    }

    window.location.href = 'dashboard-siswa.html';
  } catch (err) {
    showFormError(errorEl, err.message || 'Login gagal. Coba lagi.');
    showSnackbar(err.message || 'Login gagal. Coba lagi.', 'error');
    submitBtn.disabled = false;
    btnText.textContent = 'Masuk';
    btnLoader.classList.add('hidden');
  }
}

// ============================================================
// LOGIN ADMIN (email atau username + password)
// ============================================================
async function loginAdmin() {
  const raw = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');

  if (!raw || !password) {
    showFormError(errorEl, 'Harap isi email/username dan password.');
    return;
  }

  clearFormError(errorEl);

  // Username (tanpa @) dipetakan ke email <username>@simu.local,
  // sama seperti siswa memakai NIS.
  let email = raw;
  if (raw.indexOf('@') === -1) {
    email = raw + '@simu.local';
  }

  submitBtn.disabled = true;
  btnText.textContent = 'Memproses...';
  btnLoader.classList.remove('hidden');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const profile = await getProfile(data.user.id);

    if (!profile) {
      await supabaseClient.auth.signOut();
      throw new Error('Akun tidak ditemukan. Hubungi administrator.');
    }

    if (profile.role !== 'admin' && profile.role !== 'guru') {
      await supabaseClient.auth.signOut();
      throw new Error('Akun ini bukan akun admin/guru.');
    }

    window.location.href = 'dashboard-admin.html';
  } catch (err) {
    showFormError(errorEl, err.message || 'Login gagal. Coba lagi.');
    showSnackbar(err.message || 'Login gagal. Coba lagi.', 'error');
    submitBtn.disabled = false;
    btnText.textContent = 'Masuk sebagai Admin';
    btnLoader.classList.add('hidden');
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function logout() {
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('logout error:', err.message);
  }
  window.location.href = 'index.html';
}

// ============================================================
// GUARD - proteksi halaman berdasarkan role
// guard('siswa') / guard('admin') / guard(['admin','guru']) / guard()
// ============================================================
function roleDiizinkan(roleParam, roleUser) {
  if (!roleParam) return true;
  if (Array.isArray(roleParam)) return roleParam.indexOf(roleUser) >= 0;
  return roleUser === roleParam;
}

// Terapkan pembatasan menu untuk guru & blokir guru tanpa mapel.
// Mengembalikan true bila boleh lanjut, false bila diblokir.
function terapkanAksesMenu(profile) {
  if (!profile || profile.role !== 'guru') return true;

  // Sembunyikan menu khusus admin penuh (Data Guru & Backup).
  document.querySelectorAll('a.nav-item').forEach(function (a) {
    const href = a.getAttribute('href') || '';
    if (href.indexOf('kelola-guru.html') >= 0 || href.indexOf('backup.html') >= 0) {
      a.style.display = 'none';
    }
  });

  // Guru wajib punya mapel. Kecuali di halaman ubah password.
  if (!profile.subject_id && window.location.pathname.indexOf('ubah-password.html') < 0) {
    tampilkanBlokirMapel();
    return false;
  }
  return true;
}

function tampilkanBlokirMapel() {
  if (document.getElementById('mapelBlockOverlay')) return;
  const el = document.createElement('div');
  el.id = 'mapelBlockOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  el.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:24px;max-width:420px;text-align:center;">' +
    '<h3 style="margin:0 0 8px;font-size:18px;">Mapel belum diatur</h3>' +
    '<p style="margin:0 0 16px;color:#404040;font-size:14px;">Akun Anda belum memiliki mata pelajaran. ' +
    'Hubungi admin sekolah untuk mengatur mapel yang Anda ampu.</p>' +
    '<button id="mapelBlockLogout" style="padding:8px 16px;border:none;border-radius:8px;background:#0A0A0A;color:#fff;cursor:pointer;font-size:14px;">Keluar</button>' +
    '</div>';
  document.body.appendChild(el);
  const btn = document.getElementById('mapelBlockLogout');
  if (btn) btn.addEventListener('click', logout);
}

async function guard(role) {
  // 1. Coba baca session dari storage.
  let { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  // 2. Kalau belum ada, coba ambil ulang dari server (menggunakan token
  //    tersimpan / refresh) sebelum memutuskan redirect ke index.html.
  if (sessionError || !session) {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (!userError && userData && userData.user) {
      const refreshed = await supabaseClient.auth.getSession();
      session = refreshed.data && refreshed.data.session;
    }
  }

  if (!session) {
    window.location.href = 'index.html';
    return null;
  }

  const userId = session.user.id;
  const profile = await getProfile(userId);

  // Profil TIDAK ADA (barisnya tidak ada di tabel users) => layak sign out.
  // Profil GAGAL dimuat karena error/network => jangan sign out, biarkan halaman
  // mencoba lagi, karena logout bisa bikin loop yang menjebak user.
  if (profile === null) {
    const check = await supabaseClient.from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (check.error || !check.data) {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
      return null;
    }
    window.location.href = 'index.html';
    return null;
  }

  if (!roleDiizinkan(role, profile.role)) {
    if (profile.role === 'admin' || profile.role === 'guru') {
      window.location.href = 'dashboard-admin.html';
    } else {
      window.location.href = 'dashboard-siswa.html';
    }
    return null;
  }

  if (!terapkanAksesMenu(profile)) return null;

  return profile;
}

// ============================================================
// Inisialisasi form login otomatis
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const isAdminPage = window.location.pathname.endsWith('admin.html');

  if (isAdminPage) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      loginAdmin();
    });
  } else {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      loginSiswa();
    });
  }

  // Toggle lihat / sembunyikan password
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', function () {
      const passwordInput = document.getElementById('password');
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      togglePassword.setAttribute('aria-pressed', showing ? 'false' : 'true');
      togglePassword.setAttribute('aria-label', showing ? 'Lihat password' : 'Sembunyikan password');
      togglePassword.setAttribute('title', showing ? 'Lihat password' : 'Sembunyikan password');
    });
  }
});