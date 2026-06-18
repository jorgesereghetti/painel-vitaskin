// js/router.js
// Roteamento entre abas + relógio ao vivo — INFRA-03 + INFRA-04.
// Depende de: js/config.js (window.TAB_META).
// Substitui o <script> inline antigo de index.html.

(function() {
  // ---------------------------------------------------------------
  // goTo(page) — troca a aba ativa.
  // Atualiza .active em .nav-item[data-tab] e em section[data-page],
  // e atualiza o header #tabNum / #tabTitle / #tabSub via TAB_META.
  // ---------------------------------------------------------------
  function goTo(page) {
    if (!window.TAB_META || !window.TAB_META[page]) {
      console.warn('[router] aba desconhecida:', page);
      return;
    }
    const items = document.querySelectorAll('.nav-item[data-tab]');
    const pages = document.querySelectorAll('section[data-page]');
    items.forEach(it => {
      it.classList.toggle('active', it.getAttribute('data-tab') === page);
    });
    pages.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-page') === page);
    });
    const meta = window.TAB_META[page];
    const num   = document.getElementById('tabNum');
    const title = document.getElementById('tabTitle');
    const sub   = document.getElementById('tabSub');
    if (num)   num.textContent   = meta.num;
    if (title) title.textContent = meta.title;
    if (sub)   sub.textContent   = meta.sub;

    // Registro de navegação no logger do sistema
    if (window.sysLogger) {
      window.sysLogger.info(`Navegação: Usuário mudou para a aba ${meta.title || page}`);
    }

    // Hook por aba — Phase 03+ adiciona orchestrators (renderDashboard, renderAgenda, ...).
    if (page === 'dashboard' && typeof window.renderDashboard === 'function') {
      window.renderDashboard();
    }
    if (page === 'agenda' && typeof window.renderAgendaPage === 'function') {
      window.renderAgendaPage();
    }
    if (page === 'clientes' && typeof window.renderClientesPage === 'function') {
      window.renderClientesPage();
    }
    if (page === 'agente' && typeof window.renderAgentePage === 'function') {
      window.renderAgentePage();
    }
    if (page === 'logs' && typeof window.renderLogsPage === 'function') {
      window.renderLogsPage();
    }
  }
  window.goTo = goTo;

  // ---------------------------------------------------------------
  // updateClock() — relógio ao vivo no header (#liveClock).
  // Formato pt-BR HH:MM, atualizado a cada segundo.
  // INFRA-04 success criterion: "Relógio no header atualiza a cada segundo em pt-BR".
  // ---------------------------------------------------------------
  function updateClock() {
    const el = document.getElementById('liveClock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('pt-BR', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  }
  window.updateClock = updateClock;

  // ---------------------------------------------------------------
  // Boot — wiring após DOM pronto.
  // ---------------------------------------------------------------
  function boot() {
    // 1. Listeners da sidebar.
    const items = document.querySelectorAll('.nav-item[data-tab]');
    items.forEach(it => {
      it.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = it.getAttribute('data-tab');
        goTo(tab);
      });
    });

    // 2. Estado inicial: aba já marcada como .active no HTML (dashboard).
    //    Sincroniza header com TAB_META mesmo que o HTML já tenha texto.
    const initial = document.querySelector('.nav-item[data-tab].active');
    if (initial) goTo(initial.getAttribute('data-tab'));

    // 3. Relógio: tick imediato + setInterval a cada 1s.
    updateClock();
    setInterval(updateClock, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
