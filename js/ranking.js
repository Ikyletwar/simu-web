// ============================================================
// js/ranking.js - Ranking siswa & admin
// ============================================================

let mode = 'siswa';
let currentTab = 'global';
let profile = null;
let lastRows = [];

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

function formatNilai(value) {
  if (value == null) return '-';
  const n = parseFloat(value);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

function buildSidebarNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  if (mode === 'admin') {
    const items = [
      { href: 'dashboard-admin.html', icon: 'home', label: 'Dashboard' },
      { href: 'kelola-soal.html', icon: 'file-text', label: 'Kelola Soal' },
      { href: 'kelola-ujian.html', icon: 'clock', label: 'Kelola Ujian' },
      { href: 'laporan.html', icon: 'clipboard-list', label: 'Laporan Nilai' },
      { href: 'ranking.html?mode=admin', icon: 'bar-chart', label: 'Ranking', active: true },
      { href: 'kelola-siswa.html', icon: 'users', label: 'Data Siswa' },
      { href: 'kelola-guru.html', icon: 'graduation-cap', label: 'Data Guru' }
    ];
    items.forEach(function (item) {
      const a = document.createElement('a');
      a.href = item.href;
      a.className = 'nav-item' + (item.active ? ' active' : '');
      a.innerHTML = '<i data-lucide="' + item.icon + '"></i><span>' + item.label + '</span>';
      nav.appendChild(a);
    });
  } else {
    const items = [
      { href: 'dashboard-siswa.html', icon: 'home', label: 'Dashboard' },
      { href: 'ranking.html', icon: 'bar-chart', label: 'Ranking', active: true }
    ];
    items.forEach(function (item) {
      const a = document.createElement('a');
      a.href = item.href;
      a.className = 'nav-item' + (item.active ? ' active' : '');
      a.innerHTML = '<i data-lucide="' + item.icon + '"></i><span>' + item.label + '</span>';
      nav.appendChild(a);
    });
  }
}

async function initSidebar() {
  buildSidebarNav();

  const footer = document.querySelector('.sidebar-footer');
  if (footer && mode === 'admin') {
    const pwLink = document.createElement('a');
    pwLink.href = 'ubah-password.html';
    pwLink.className = 'nav-item';
    pwLink.innerHTML = '<i data-lucide="key-round"></i><span>Ubah Password</span>';
    footer.insertBefore(pwLink, footer.lastElementChild);
  }

  document.getElementById('userName').textContent = profile.nama || (mode === 'admin' ? 'Admin' : 'Siswa');

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
  lucide.createIcons();
}

// ============================================================
// AMBIL DATA RANKING
// ============================================================
async function fetchRanking(filterType, filterValue) {
  const { data, error } = await supabaseClient.rpc('get_ranking', {
    filter_type: filterType,
    filter_value: filterValue || null
  });
  if (error) {
    console.error('get_ranking error:', error.message);
    throw error;
  }
  return data || [];
}

// ============================================================
// RENDER SISWA
// ============================================================
function renderSiswa(rows) {
  const podium = document.getElementById('podium');
  const listTable = document.getElementById('listTable');
  const tbody = document.getElementById('rankTableBody');
  const cardList = document.getElementById('rankCardList');
  const myPosition = document.getElementById('myPosition');
  const emptyState = document.getElementById('emptyState');

  podium.classList.add('hidden');
  listTable.style.display = 'none';
  cardList.innerHTML = '';
  tbody.innerHTML = '';
  myPosition.classList.add('hidden');
  emptyState.classList.add('hidden');

  if (rows.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const isMe = function (r) { return r.user_id === profile.id; };

  // Podium
  podium.classList.remove('hidden');
  podium.innerHTML = '';
  top3.forEach(function (r) {
    const card = document.createElement('div');
    let cls = 'podium-card me';
    let rankLabel = 'P' + r.r_number;
    if (r.r_number == 1) card.classList.add('first');
    card.className = 'podium-card ' + (r.r_number == 1 ? 'first' : '') + (isMe(r) ? ' me' : '');
    card.innerHTML =
      '<div class="podium-rank-icon">' + rankLabel + '</div>' +
      '<div class="podium-name">' + escapeHtml(r.nama || 'Tanpa Nama') + '</div>' +
      '<div class="hint">' + escapeHtml(r.kelas || '-') + '</div>' +
      '<div class="podium-score">' + formatNilai(r.rata_rata) + '</div>' +
      (isMe(r) ? '<span class="badge badge-neutral">Kamu</span>' : '');
    podium.appendChild(card);
  });

  // List 4 ke bawah (table pc)
  if (rest.length > 0) {
    listTable.style.display = 'block';
    rest.forEach(function (r) {
      const tr = document.createElement('tr');
      tr.className = isMe(r) ? 'me' : '';
      tr.innerHTML =
        '<td class="font-semibold">' + r.r_number + '</td>' +
        '<td>' + escapeHtml(r.nama || '-') + '</td>' +
        '<td>' + escapeHtml(r.nis || '-') + '</td>' +
        '<td>' + escapeHtml(r.kelas || '-') + '</td>' +
        '<td>' + escapeHtml(r.jurusan || '-') + '</td>' +
        '<td class="font-semibold">' + formatNilai(r.rata_rata) + '</td>';
      tbody.appendChild(tr);
    });

    // Card mobile
    rest.forEach(function (r) {
      const card = document.createElement('div');
      card.className = 'rank-card-mobile' + (isMe(r) ? ' me' : '');
      card.innerHTML =
        '<div class="rank-top">' +
        '  <span class="rank-medal">#' + r.r_number + ' ' + escapeHtml(r.nama || '-') + '</span>' +
        '  <span class="rank-score">' + formatNilai(r.rata_rata) + '</span>' +
        '</div>' +
        '<span class="hint">' + escapeHtml(r.kelas || '-') + ' - ' + escapeHtml(r.jurusan || '-') + '</span>';
      cardList.appendChild(card);
    });
  }

  // Posisi kamu
  const me = rows.find(isMe);
  if (me) {
    myPosition.classList.remove('hidden');
    document.getElementById('myPosRank').textContent = 'Peringkat ' + me.r_number;
    document.getElementById('myPosName').textContent =
      escapeHtml(me.nama || '-') + ' - ' + escapeHtml(me.kelas || '-');
    document.getElementById('myPosValue').textContent = 'Rata-rata ' + formatNilai(me.rata_rata);
  }
}

// ============================================================
// RENDER ADMIN
// ============================================================
function renderAdmin(rows) {
  const listTable = document.getElementById('listTable');
  const tbody = document.getElementById('rankTableBody');
  const cardList = document.getElementById('rankCardList');
  const emptyState = document.getElementById('emptyState');

  listTable.style.display = 'none';
  tbody.innerHTML = '';
  cardList.innerHTML = '';
  emptyState.classList.add('hidden');
  lastRows = rows;

  if (rows.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  listTable.style.display = 'block';
  rows.forEach(function (r) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="font-semibold">' + r.r_number + '</td>' +
      '<td>' + escapeHtml(r.nama || '-') + '</td>' +
      '<td>' + escapeHtml(r.nis || '-') + '</td>' +
      '<td>' + escapeHtml(r.kelas || '-') + '</td>' +
      '<td>' + escapeHtml(r.jurusan || '-') + '</td>' +
      '<td class="font-semibold">' + formatNilai(r.rata_rata) + '</td>';
    tbody.appendChild(tr);

    const card = document.createElement('div');
    card.className = 'rank-card-mobile';
    card.innerHTML =
      '<div class="rank-top">' +
      '  <span class="rank-medal">#' + r.r_number + ' ' + escapeHtml(r.nama || '-') + '</span>' +
      '  <span class="rank-score">' + formatNilai(r.rata_rata) + '</span>' +
      '</div>' +
      '<span class="hint">' + escapeHtml(r.kelas || '-') + ' - ' + escapeHtml(r.jurusan || '-') + '</span>';
    cardList.appendChild(card);
  });
}

// ============================================================
// LOAD
// ============================================================
async function loadRanking() {
  const loadingBox = document.getElementById('loadingBox');
  const podium = document.getElementById('podium');
  const listTable = document.getElementById('listTable');
  const emptyState = document.getElementById('emptyState');

  loadingBox.classList.remove('hidden');
  podium.classList.add('hidden');
  listTable.style.display = 'none';
  emptyState.classList.add('hidden');

  try {
    let filterType = 'global';
    let filterValue = null;

    if (mode === 'siswa') {
      filterType = currentTab;
    } else {
      const kelas = document.getElementById('admKelas').value;
      const jurusan = document.getElementById('admJurusan').value;
      if (kelas) {
        filterType = 'class';
        filterValue = kelas;
      } else if (jurusan) {
        filterType = 'major';
        filterValue = jurusan;
      }
    }

    const rows = await fetchRanking(filterType, filterValue);
    loadingBox.classList.add('hidden');

    if (mode === 'siswa') {
      renderSiswa(rows);
    } else {
      renderAdmin(rows);
    }
    lucide.createIcons();
  } catch (err) {
    loadingBox.classList.add('hidden');
    emptyState.classList.remove('hidden');
    showSnackbar('Gagal memuat ranking.', 'error');
  }
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportCSV() {
  if (!lastRows || lastRows.length === 0) {
    showSnackbar('Tidak ada data untuk diexport.', 'warning');
    return;
  }
  const header = 'Peringkat,Nama,NIS,Kelas,Jurusan,Rata-rata';
  const lines = lastRows.map(function (r) {
    return [
      r.r_number,
      '"' + String(r.nama || '').replace(/"/g, '""') + '"',
      '"' + String(r.nis || '').replace(/"/g, '""') + '"',
      '"' + String(r.kelas || '').replace(/"/g, '""') + '"',
      '"' + String(r.jurusan || '').replace(/"/g, '""') + '"',
      formatNilai(r.rata_rata)
    ].join(',');
  });
  const csv = [header].concat(lines).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ranking-simu.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showSnackbar('CSV berhasil diunduh.', 'success');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'admin') {
    mode = 'admin';
  }

  profile = await guard(mode === 'admin' ? 'admin' : 'siswa');
  if (!profile) return;

  await initSidebar();

  if (mode === 'admin') {
    document.getElementById('adminFilter').style.display = 'block';
    document.getElementById('studentTabs').style.display = 'none';
    document.getElementById('myPosition').style.display = 'none';

    // Isi dropdown filter kelas & jurusan
    const [classRes, majorRes] = await Promise.all([
      supabaseClient.from('classes').select('id, nama').order('nama'),
      supabaseClient.from('majors').select('id, nama').order('nama')
    ]);
    (classRes.data || []).forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nama;
      document.getElementById('admKelas').appendChild(opt);
    });
    (majorRes.data || []).forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nama;
      document.getElementById('admJurusan').appendChild(opt);
    });

    document.getElementById('admFilterBtn').addEventListener('click', loadRanking);
    document.getElementById('admExportBtn').addEventListener('click', exportCSV);
  } else {
    document.querySelectorAll('#studentTabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('#studentTabs .tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentTab = tab.getAttribute('data-tab');
        loadRanking();
      });
    });
  }

  await loadRanking();
  lucide.createIcons();
});