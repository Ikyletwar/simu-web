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

    if (profile.role !== 'admin') {
      await supabaseClient.auth.signOut();
      throw new Error('Akun ini bukan akun admin.');
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
// guard('siswa') atau guard('admin') atau guard() (login saja)
// ============================================================
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

  if (role && profile.role !== role) {
    if (profile.role === 'admin') {
      window.location.href = 'dashboard-admin.html';
    } else {
      window.location.href = 'dashboard-siswa.html';
    }
    return null;
  }

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