// ============================================================
// js/backup.js - Export & Import (pulihkan) data SIMU
// Memakai:
//   - variabel global `supabaseClient` dari js/supabase.js
//   - fungsi `guard('admin')` dan `showSnackbar()` dari js/auth.js
// ============================================================

(function () {
  'use strict';

  // ------------------------------------------------------------
  // Daftar tabel yang di-backup.
  // SESUAIKAN bila ada tabel baru di sql/*.sql
  // ------------------------------------------------------------
  var TABLES = [
    'majors',
    'classes',
    'subjects',
    'users',
    'topics',
    'questions',
    'exams',
    'exam_questions',
    'submissions'
  ];

  // ------------------------------------------------------------
  // Helper tampilan
  // ------------------------------------------------------------
  function setMsg(text, isError) {
    var el = document.getElementById('backupMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'error-message mb-16' : 'text-success mb-16';
  }

  function logLine(text) {
    var el = document.getElementById('backupLog');
    if (!el) return;
    el.textContent += text + '\n';
    el.scrollTop = el.scrollHeight;
  }

  function resetLog() {
    var el = document.getElementById('backupLog');
    if (el) el.textContent = '';
  }

  function snack(message, type) {
    if (typeof showSnackbar === 'function') {
      showSnackbar(message, type || 'error');
    }
  }

  // ------------------------------------------------------------
  // Export: ambil seluruh isi tabel -> JSON -> unduh
  // ------------------------------------------------------------
  async function doExport() {
    var btn = document.getElementById('exportBtn');
    if (btn) btn.disabled = true;
    resetLog();
    setMsg('Mengambil data dari server...', false);

    var data = {};
    var totalRows = 0;
    var errors = [];

    try {
      var results = await Promise.all(TABLES.map(function (t) {
        return supabaseClient.from(t).select('*').then(function (res) {
          return { table: t, res: res };
        }, function (err) {
          return { table: t, res: { error: err } };
        });
      }));

      results.forEach(function (item) {
        var t = item.table;
        var res = item.res || {};
        if (res.error) {
          errors.push(t + ': ' + (res.error.message || 'gagal'));
          logLine('[' + t + '] GAGAL - ' + (res.error.message || 'error'));
          return;
        }
        var rows = res.data || [];
        data[t] = rows;
        totalRows += rows.length;
        logLine('[' + t + '] ' + rows.length + ' baris');
      });

      var payload = {
        app: 'SIMU',
        versi: 1,
        tgl: new Date().toISOString(),
        data: data
      };

      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');

      var d = new Date();
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());

      a.href = url;
      a.download = 'simu-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (errors.length > 0) {
        setMsg('Backup selesai dengan ' + errors.length + ' peringatan. Total ' + totalRows + ' baris.', true);
        snack('Sebagian tabel gagal diambil.', 'warning');
      } else {
        setMsg('Backup berhasil. Total ' + totalRows + ' baris dari ' + TABLES.length + ' tabel.', false);
        snack('Backup berhasil diunduh.', 'success');
      }
    } catch (err) {
      console.error('export error:', err);
      setMsg('Gagal export: ' + (err.message || err), true);
      snack('Gagal export.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ------------------------------------------------------------
  // Import: parse JSON -> upsert per baris (non-destruktif)
  // ------------------------------------------------------------
  async function doImport() {
    resetLog();
    var area = document.getElementById('backupArea');
    var raw = area ? area.value.trim() : '';
    if (!raw) {
      setMsg('Isi JSON backup terlebih dahulu.', true);
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      setMsg('JSON tidak valid: ' + err.message, true);
      return;
    }

    // Hanya terima file backup SIMU resmi.
    if (!parsed || parsed.app !== 'SIMU' || !parsed.data) {
      setMsg('Bukan file backup SIMU (butuh "app":"SIMU" dan objek "data").', true);
      return;
    }

    var data = parsed.data;
    if (!data || typeof data !== 'object') {
      setMsg('Struktur backup tidak dikenali (butuh objek "data").', true);
      return;
    }

    var importBtn = document.getElementById('backupImportBtn');
    if (importBtn) importBtn.disabled = true;
    setMsg('Mulai import...', false);

    var totalOk = 0;
    var totalFail = 0;
    var okTables = 0;

    try {
      for (var i = 0; i < TABLES.length; i++) {
        var t = TABLES[i];
        var rows = data[t];

        if (!rows) {
          logLine('[' + t + '] dilewati (tidak ada di backup)');
          continue;
        }
        if (!Array.isArray(rows)) {
          logLine('[' + t + '] dilewati (bukan array)');
          continue;
        }

        var okCount = 0;
        var failCount = 0;

        for (var j = 0; j < rows.length; j++) {
          var row = rows[j];
          if (!row || typeof row !== 'object' || !row.id) {
            failCount++;
            logLine('[' + t + '] baris ' + (j + 1) + ' GAGAL: butuh kolom "id"');
            continue;
          }
          try {
            var upRes = await supabaseClient
              .from(t)
              .upsert(row, { onConflict: 'id' });
            if (upRes.error) {
              failCount++;
              logLine('[' + t + '] baris ' + (j + 1) + ' GAGAL: ' + upRes.error.message);
            } else {
              okCount++;
            }
          } catch (err) {
            failCount++;
            logLine('[' + t + '] baris ' + (j + 1) + ' GAGAL: ' + (err.message || err));
          }
        }

        totalOk += okCount;
        totalFail += failCount;
        if (failCount === 0) okTables++;
        logLine('[' + t + '] OK ' + okCount + ' baris, gagal ' + failCount);
      }

      var summary = 'OK ' + okTables + ' tabel, total ' + totalOk +
        ' baris, gagal ' + totalFail;
      setMsg(summary, totalFail > 0);
      snack(
        totalFail > 0 ? 'Import selesai dengan kegagalan.' : 'Import berhasil.',
        totalFail > 0 ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('import error:', err);
      setMsg('Gagal import: ' + (err.message || err), true);
      snack('Gagal import.', 'error');
    } finally {
      if (importBtn) importBtn.disabled = false;
    }
  }

  // ------------------------------------------------------------
  // Muat file .json ke textarea
  // ------------------------------------------------------------
  function bindFileInput() {
    var btn = document.getElementById('backupFileBtn');
    var input = document.getElementById('backupFile');
    if (!btn || !input) return;

    btn.addEventListener('click', function () {
      input.click();
    });

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var area = document.getElementById('backupArea');
        if (area) area.value = ev.target.result;
        setMsg('File dimuat: ' + f.name, false);
      };
      reader.onerror = function () {
        setMsg('Gagal membaca file.', true);
      };
      reader.readAsText(f);
      input.value = '';
    });
  }

  // ------------------------------------------------------------
  // Init halaman
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async function () {
    var profile = await guard('admin');
    if (!profile) return;

    var nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = profile.nama || 'Admin';

    // Sidebar hamburger
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (hamburgerBtn && sidebar && overlay) {
      hamburgerBtn.addEventListener('click', function () {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    // Logout
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
      });
    }

    // Export
    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', doExport);

    // Import
    var importBtn = document.getElementById('backupImportBtn');
    if (importBtn) importBtn.addEventListener('click', doImport);

    bindFileInput();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  });
})();