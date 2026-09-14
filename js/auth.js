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
// Siswa login memakai email semu: <nis>@simu.local
// ============================================================
async function loginSiswa() {
  const nis = document.getElementById('nis').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');

  if (!nis || !password) {
    showFormError(errorEl, 'Harap isi NIS dan password.');
    return;
  }

  clearFormError(errorEl);
  const email = nis + '@simu.local';

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
// LOGIN ADMIN (email + password)
// ============================================================
async function loginAdmin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');

  if (!email || !password) {
    showFormError(errorEl, 'Harap isi email dan password.');
    return;
  }

  clearFormError(errorEl);

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
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    window.location.href = 'index.html';
    return null;
  }

  const userId = session.user.id;
  const profile = await getProfile(userId);

  if (!profile) {
    await supabaseClient.auth.signOut();
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