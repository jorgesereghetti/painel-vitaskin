// js/pages/dashboard.js
// Aba Dashboard — render funções para métricas e funil.
// Phase 03 — começa aqui (renderMetrics + renderFunnel).
// 03-02 ADICIONA renderDashboardCharts no fim deste arquivo.
// 03-03 ADICIONA renderFollowups + renderDashboard (orchestrator) no fim.

(function() {

  // ---------------------------------------------------------------
  // renderMetrics(data) — DASH-01
  // Preenche os 4 .metric-val do dashboard com:
  //   [0] agendamentosHoje  (number, sem unidade extra)
  //   [1] leadsWeek         (number, sem unidade extra)
  //   [2] taxaConversao     (string com 1 casa, sufixo '%')
  //   [3] showRate          (string com 1 casa, sufixo '%')
  // Recebe o objeto retornado por window.fetchDashboard().
  // ---------------------------------------------------------------
  function renderMetrics(data) {
    if (!data) return;

    const cards = document.querySelectorAll(
      "section[data-page='dashboard'] .metric-card .metric-val"
    );
    if (cards.length < 4) {
      console.warn('[dashboard] renderMetrics: esperava 4 .metric-val, achou', cards.length);
      return;
    }

    const values = [
      formatCount(data.agendamentosHoje),
      formatCount(data.leadsWeek),
      formatPercent(data.taxaConversao),
      formatPercent(data.showRate),
    ];

    cards.forEach((el, i) => {
      el.classList.remove('skeleton');
      el.textContent = values[i];
    });
  }
  window.renderMetrics = renderMetrics;

  // ---------------------------------------------------------------
  // renderFunnel(funil) — DASH-02
  // funil = { leads, agendados, confirmados, realizados } (numbers, podem ser 0).
  // Preenche os 4 .funnel-count NA ORDEM do DOM (Leads → Agendados → Confirmados → Realizados)
  // e ajusta o width de cada .funnel-bar proporcional a max(leads, 1) — assim a primeira
  // barra fica em 100% e as outras encolhem proporcionalmente.
  // ---------------------------------------------------------------
  function renderFunnel(funil) {
    const container = document.getElementById('funnel');
    if (!container) {
      console.warn('[dashboard] renderFunnel: #funnel não encontrado');
      return;
    }
    const safe = funil || {};
    const stages = [
      { value: safe.leads       || 0 },
      { value: safe.agendados   || 0 },
      { value: safe.confirmados || 0 },
      { value: safe.realizados  || 0 },
    ];
    const max = Math.max(stages[0].value, 1); // evita divisão por zero

    const stageEls = container.querySelectorAll('.funnel-stage');
    if (stageEls.length < 4) {
      console.warn('[dashboard] renderFunnel: esperava 4 .funnel-stage, achou', stageEls.length);
      return;
    }

    stageEls.forEach((stageEl, i) => {
      const countEl = stageEl.querySelector('.funnel-count');
      const barEl   = stageEl.querySelector('.funnel-bar');
      if (countEl) {
        countEl.classList.remove('skeleton');
        countEl.textContent = formatCount(stages[i].value);
      }
      if (barEl) {
        const pct = Math.min(100, (stages[i].value / max) * 100);
        barEl.style.width = pct + '%';
      }
    });
  }
  window.renderFunnel = renderFunnel;

  // ---------------------------------------------------------------
  // Helpers internos — não expor.
  // ---------------------------------------------------------------
  function formatCount(n) {
    const v = Number(n);
    return Number.isFinite(v) ? String(v) : '0';
  }

  function formatPercent(s) {
    if (s === null || s === undefined || s === '') return '0%';
    const str = String(s);
    return str.endsWith('%') ? str : (str + '%');
  }

  // ---------------------------------------------------------------
  // renderDashboardCharts(data) — DASH-03 + DASH-04
  // Agrupa porSemana em 6 buckets de 7 dias terminando hoje, separando
  // 'realizado' (série Realizados) de qualquer outro status (série Agendados).
  // Agrupa porEspec em 2 buckets fixos: Dermatologia / Fisioterapia Estética.
  // Despacha tudo via window.updateCharts (Phase 02 / charts.js).
  // ---------------------------------------------------------------
  function renderDashboardCharts(data) {
    if (!data || typeof window.updateCharts !== 'function') {
      console.warn('[dashboard] renderDashboardCharts: dados ausentes ou updateCharts indisponível');
      return;
    }

    // === WEEKLY (DASH-03) ===
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const labels      = [];
    const agendados   = [];
    const realizados  = [];
    const buckets = []; // [{ startMs, endMs }] em ordem cronológica (mais antigo → mais recente)

    for (let i = 0; i < 6; i++) {
      const offsetDaysFim    = (5 - i) * 7;       // i=0 → 35 dias atrás (final do bucket); i=5 → 0 (hoje)
      const offsetDaysInicio = (6 - i) * 7 - 1;   // i=0 → 41 dias atrás; i=5 → 6 dias atrás
      const fim    = new Date(endOfToday.getTime() - offsetDaysFim    * 86400000);
      const inicio = new Date(endOfToday.getTime() - offsetDaysInicio * 86400000);
      inicio.setHours(0, 0, 0, 0);
      buckets.push({ startMs: inicio.getTime(), endMs: fim.getTime() });

      const lblA = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const lblB = fim.toLocaleDateString('pt-BR',    { day: '2-digit', month: '2-digit' });
      labels.push(lblA + '–' + lblB);
      agendados.push(0);
      realizados.push(0);
    }

    const porSemana = Array.isArray(data.porSemana) ? data.porSemana : [];
    porSemana.forEach(item => {
      if (!item || !item.data_hora) return;
      const t = new Date(item.data_hora).getTime();
      if (Number.isNaN(t)) return;
      const idx = buckets.findIndex(b => t >= b.startMs && t <= b.endMs);
      if (idx < 0) return; // fora da janela de 6 semanas — ignora
      if (item.status === 'realizado') {
        realizados[idx] += 1;
      } else {
        agendados[idx] += 1;
      }
    });

    // === SPECIALTY (DASH-04) ===
    let derma = 0;
    let fisio = 0;
    const porEspec = Array.isArray(data.porEspec) ? data.porEspec : [];
    porEspec.forEach(item => {
      if (!item) return;
      if (item.especialidade === 'Fisioterapia Estética') {
        fisio += 1;
      } else if (item.especialidade === 'Dermatologia') {
        derma += 1;
      }
      // qualquer outro valor é ignorado (mantém o donut limpo nas 2 fatias)
    });

    // === DESPACHAR ===
    window.updateCharts({
      weekly:    { labels: labels, agendados: agendados, realizados: realizados },
      specialty: { derma: derma, fisio: fisio },
    });
  }
  window.renderDashboardCharts = renderDashboardCharts;

  // ---------------------------------------------------------------


  // ---------------------------------------------------------------
  // showSkeletons() — coloca classe .skeleton em todos os spots de número
  // do dashboard antes do fetch. Sem criar HTML novo.
  // ---------------------------------------------------------------
  function showSkeletons() {
    const sels = [
      "section[data-page='dashboard'] .metric-card .metric-val",
      "section[data-page='dashboard'] .funnel-count",
    ];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.classList.add('skeleton');
        // Mantemos o textContent atual ('—') — a classe pulsa o background.
      });
    });
  }

  // ---------------------------------------------------------------
  // showErrorBanner(message, retryFn) / clearErrorBanner()
  // Banner discreto inserido como primeiro filho da seção dashboard.
  // Estilo inline (sem criar CSS novo). Botão chama retryFn ao clicar.
  // ---------------------------------------------------------------
  function clearErrorBanner() {
    const old = document.getElementById('dashboardErrorBanner');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function showErrorBanner(message, retryFn) {
    clearErrorBanner();
    const section = document.querySelector("section[data-page='dashboard']");
    if (!section) return;

    const banner = document.createElement('div');
    banner.id = 'dashboardErrorBanner';
    banner.setAttribute('style',
      'padding:12px 16px; margin-bottom:16px; border-radius:var(--radius); ' +
      'background:rgba(242,139,130,.10); color:#ffb4ab; ' +
      'border:1px solid rgba(242,139,130,.25); font-family:var(--font-label); ' +
      'font-size:13px; display:flex; align-items:center; justify-content:space-between; gap:12px;'
    );

    const text = document.createElement('span');
    text.textContent = message || 'Falha ao carregar dados do dashboard.';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Tentar novamente';
    btn.setAttribute('style',
      'padding:6px 12px; border-radius:var(--radius); ' +
      'background:rgba(96,236,168,.15); color:var(--color-primary); ' +
      'border:1px solid rgba(96,236,168,.3); font-family:var(--font-label); ' +
      'font-size:12px; cursor:pointer;'
    );
    btn.addEventListener('click', () => {
      if (typeof retryFn === 'function') retryFn();
    });

    banner.appendChild(text);
    banner.appendChild(btn);

    // Inserir no topo da seção (antes do primeiro filho real).
    section.insertBefore(banner, section.firstChild);
  }

  // 🚀 Lógica de Filtragem de Período Dinâmica (Pilar 4, item 2)
  let _lastDashboardData = null;
  let _activePeriod = 'mes';

  function _applyPeriodFilter(period) {
    _activePeriod = period;
    if (window.sysLogger) {
      window.sysLogger.info(`Dashboard: Filtro de período dinâmico alterado para: ${period}`);
    }
    if (!_lastDashboardData) return;

    // Atualiza os botões seg-btn do cabeçalho do Dashboard
    const buttons = document.querySelectorAll('#dashboardPeriodFilter .seg-btn');
    buttons.forEach(btn => {
      if (btn.dataset.period === period) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const data = _lastDashboardData;
    let agendamentosHoje = data.agendamentosHoje;
    let leadsWeek = data.leadsWeek;
    let taxaConversao = data.taxaConversao;
    let showRate = data.showRate;

    const agora = Date.now();
    const seteDiasMs = 7 * 86400000;
    const umDiaMs = 24 * 60 * 60 * 1000;

    if (period === 'semana') {
      // Filtrar os agendamentos das últimas 6 semanas para apenas os últimos 7 dias
      const agendamentosSemana = (data.porSemana || []).filter(item => {
        if (!item.data_hora) return false;
        const t = new Date(item.data_hora).getTime();
        return (agora - t) <= seteDiasMs;
      });

      // Show Rate da semana
      const realizados = agendamentosSemana.filter(a => a.status === 'realizado').length;
      const confirmados = agendamentosSemana.filter(a => a.status === 'confirmado').length;
      const totalShow = realizados + confirmados;
      showRate = totalShow ? ((realizados / totalShow) * 100).toFixed(1) : '0';

      // Conversão da semana (Pacientes agendados na semana / novos leads da semana)
      const unicosSemana = agendamentosSemana.length;
      taxaConversao = leadsWeek ? Math.min(100, ((unicosSemana / leadsWeek) * 100)).toFixed(1) : '0';
    } 
    else if (period === 'hoje') {
      // Filtrar para hoje local
      const hojeInicio = new Date(); hojeInicio.setHours(0,0,0,0);
      const hojeFim = new Date(); hojeFim.setHours(23,59,59,999);
      
      const agendamentosHojeArr = (data.porSemana || []).filter(item => {
        if (!item.data_hora) return false;
        const t = new Date(item.data_hora).getTime();
        return t >= hojeInicio.getTime() && t <= hojeFim.getTime();
      });

      // Novos leads hoje: proporção média dos leads da semana
      leadsWeek = Math.max(1, Math.round(data.leadsWeek / 7));

      // Show Rate hoje
      const realizados = agendamentosHojeArr.filter(a => a.status === 'realizado').length;
      const confirmados = agendamentosHojeArr.filter(a => a.status === 'confirmado').length;
      const totalShow = realizados + confirmados;
      showRate = totalShow ? ((realizados / totalShow) * 100).toFixed(1) : '100.0';

      // Taxa de conversão hoje
      taxaConversao = leadsWeek ? Math.min(100, ((agendamentosHoje / leadsWeek) * 100)).toFixed(1) : '0';
    }

    // Renderiza métricas filtradas
    if (typeof window.renderMetrics === 'function') {
      window.renderMetrics({
        agendamentosHoje,
        leadsWeek,
        taxaConversao,
        showRate
      });
    }
  }

  function _wirePeriodFilters() {
    const container = document.getElementById('dashboardPeriodFilter');
    if (!container || container.dataset.wired) return;
    container.dataset.wired = '1';

    container.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        _applyPeriodFilter(period);
      });
    });
  }

  // ---------------------------------------------------------------
  // renderDashboard() — Orchestrator (chamado pelo boot e pelo router).
  // 1. mostra skeletons
  // 2. tenta fetchDashboard()
  // 3. dispara as 4 render funções
  // 4. em erro: mostra banner com retry
  // ---------------------------------------------------------------
  let inFlight = false;
  async function renderDashboard() {
    if (inFlight) return; // evita corridas se router disparar 2x rápido
    if (typeof window.fetchDashboard !== 'function') {
      console.error('[dashboard] window.fetchDashboard indisponível');
      return;
    }
    inFlight = true;

    if (window.sysLogger) {
      window.sysLogger.info('Dashboard: Solicitando atualização dos dados do painel.');
    }

    clearErrorBanner();
    showSkeletons();

    try {
      const data = await window.fetchDashboard();
      _lastDashboardData = data;
      
      _wirePeriodFilters();
      _applyPeriodFilter(_activePeriod); // Aplica período ativo

      if (typeof window.renderFunnel           === 'function') window.renderFunnel(data && data.funil);
      if (typeof window.renderDashboardCharts  === 'function') window.renderDashboardCharts(data);

      if (window.sysLogger) {
        window.sysLogger.info('Dashboard: Dados e gráficos carregados com sucesso.');
      }
    } catch (err) {
      console.error('[dashboard] erro ao carregar dashboard:', err);
      if (window.sysLogger) {
        window.sysLogger.error(`Dashboard: Erro ao carregar métricas: ${err.message || String(err)}`);
      }
      showErrorBanner('Falha ao carregar dados do dashboard.', renderDashboard);
    } finally {
      inFlight = false;
    }
  }
  window.renderDashboard = renderDashboard;

})();
