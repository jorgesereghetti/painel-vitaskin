/* js/app.js — Bootstrap global da aplicação
 * Wira controlos do header (refresh, notificações).
 * Carregado APÓS todos os js/pages/*.js — depende de window.render*
 * Expõe: window.refreshCurrentTab
 */
(function () {
  'use strict';

  const TAB_RENDERS = {
    dashboard: function () { return window.renderDashboard; },
    agenda:    function () { return window.renderAgendaPage; },
    clientes:  function () { return window.renderClientesPage; },
    agente:    function () { return window.renderAgentePage; },
    logs:      function () { return window.renderLogsPage; },
  };

  function refreshCurrentTab() {
    // Limpa o cache de dados local para forçar um carregamento fresco do Supabase
    if (typeof window.clearDataCache === 'function') {
      window.clearDataCache();
    }
    const active = document.querySelector('.nav-item.active[data-tab]');
    const tab = active ? active.dataset.tab : 'dashboard';
    const getter = TAB_RENDERS[tab];
    const fn = getter ? getter() : null;
    if (typeof fn === 'function') {
      fn();
    } else {
      console.warn('[app] no render function for tab:', tab);
    }
  }

  // ── Refresh button ───────────────────────────────────────────────
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshCurrentTab);
  }

  // ── Theme Switcher ──
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');

  function initTheme() {
    const savedTheme = localStorage.getItem('vitaskin_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      if (themeToggleIcon) themeToggleIcon.textContent = 'dark_mode';
    } else {
      document.body.classList.remove('light-theme');
      if (themeToggleIcon) themeToggleIcon.textContent = 'light_mode';
    }
  }

  initTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      const isLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('vitaskin_theme', isLight ? 'light' : 'dark');
      
      if (themeToggleIcon) {
        themeToggleIcon.textContent = isLight ? 'dark_mode' : 'light_mode';
      }

      // Atualiza cores de gradiente e borda nos gráficos
      if (typeof window.updateChartsTheme === 'function') {
        window.updateChartsTheme();
      }

      // Re-renderiza a aba atual com as cores corretas
      setTimeout(refreshCurrentTab, 40);
    });
  }

  // ── Notif button — tooltip "Em breve" (sem efeito colateral) ────
  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) {
    notifBtn.title = 'Em breve';
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  window.refreshCurrentTab = refreshCurrentTab;
})();
