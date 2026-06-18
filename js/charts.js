// js/charts.js
// 3 instâncias Chart.js + função updateCharts — INFRA-07.
// Inicializadas vazias no boot. Phases 3 e 5 chamam updateCharts() para popular.
// Depende de: <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"> antes deste.
// Depende de: js/config.js (window.INTENT_COLORS).

(function() {

  if (typeof Chart === 'undefined') {
    console.error('[charts] Chart.js não carregou. Verifique a CDN antes de js/charts.js.');
    return;
  }

  // Defaults globais — fontes e cor de texto coerentes com tema dark do painel.
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#bbcabe'; // --color-on-surface-muted

  // Cores dos status para o weekly chart (linha 2 séries).
  const COL_AGENDADOS  = '#7ad6ff';
  let COL_REALIZADOS = '#3cdfff'; // Iniciado com azul piscina
  
  // Donut de especialidade — 2 fatias.
  let COL_DERMA  = '#3cdfff';
  const COL_FISIO  = '#b79bf0';

  // Donut de intenções — 6 fatias na ORDEM correta dos labels.
  const INTENT_LABELS = ['Agendamento','Dúvida','Cadastro','Cancelamento','Urgência','Fora do escopo'];
  const INTENT_KEYS   = ['agendamento','duvida','cadastro','cancelamento','urgencia','fora_do_escopo'];
  const INTENT_PALETTE = INTENT_KEYS.map(k =>
    (window.INTENT_COLORS && window.INTENT_COLORS[k]) || '#869489'
  );

  // ---------------------------------------------------------------
  // Boot — quando DOM pronto, cria as 3 instâncias vazias.
  // ---------------------------------------------------------------
  function boot() {
    const weeklyEl    = document.getElementById('weeklyCanvas');
    const specialtyEl = document.getElementById('specialtyCanvas');
    const intentEl    = document.getElementById('intentCanvas');

    if (weeklyEl) {
      const ctx = weeklyEl.getContext('2d');
      
      // Criação de gradientes verticais sofisticados para o preenchimento das curvas (Pilar 1, item 1)
      const gradAgendados = ctx.createLinearGradient(0, 0, 0, 200);
      gradAgendados.addColorStop(0, 'rgba(122, 214, 255, 0.22)');
      gradAgendados.addColorStop(1, 'rgba(122, 214, 255, 0.00)');

      const gradRealizados = ctx.createLinearGradient(0, 0, 0, 200);
      gradRealizados.addColorStop(0, 'rgba(96, 236, 168, 0.22)');
      gradRealizados.addColorStop(1, 'rgba(96, 236, 168, 0.00)');

      window.weeklyChart = new Chart(weeklyEl, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { 
              label: 'Agendados',  
              data: [], 
              borderColor: COL_AGENDADOS,  
              backgroundColor: gradAgendados, 
              tension: 0.38, 
              borderWidth: 2.5, 
              pointRadius: 2.5,
              pointHoverRadius: 5,
              fill: true
            },
            { 
              label: 'Realizados', 
              data: [], 
              borderColor: COL_REALIZADOS, 
              backgroundColor: gradRealizados, 
              tension: 0.38, 
              borderWidth: 2.5, 
              pointRadius: 2.5,
              pointHoverRadius: 5,
              fill: true
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, color: 'rgba(229,226,225,.70)' } } },
          scales: {
            x: { grid: { color: 'rgba(134,148,137,0.08)' }, ticks: { color: 'rgba(229,226,225,.50)' } },
            y: { grid: { color: 'rgba(134,148,137,0.08)' }, beginAtZero: true, ticks: { precision: 0, color: 'rgba(229,226,225,.50)' } },
          },
        },
      });
    } else {
      console.warn('[charts] #weeklyCanvas não encontrado.');
    }

    if (specialtyEl) {
      window.specialtyChart = new Chart(specialtyEl, {
        type: 'doughnut',
        data: {
          labels: ['Dermatologia', 'Fisioterapia Estética'],
          datasets: [{
            data: [0, 0],
            backgroundColor: [COL_DERMA, COL_FISIO],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8 } } },
        },
      });
    } else {
      console.warn('[charts] #specialtyCanvas não encontrado.');
    }

    if (intentEl) {
      window.intentChart = new Chart(intentEl, {
        type: 'doughnut',
        data: {
          labels: INTENT_LABELS,
          datasets: [{
            data: INTENT_KEYS.map(() => 0),
            backgroundColor: INTENT_PALETTE,
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'right', labels: { boxWidth: 8, boxHeight: 8 } } },
        },
      });
    } else {
      console.warn('[charts] #intentCanvas não encontrado.');
    }

    // Sincroniza imediatamente as cores e gradientes com o tema ativo
    setTimeout(updateChartsTheme, 30);
  }

  // ---------------------------------------------------------------
  // updateCharts({ weekly?: {labels, agendados, realizados},
  //                specialty?: {derma, fisio},
  //                intent?: {agendamento, duvida, cadastro, cancelamento, urgencia, fora_do_escopo} })
  // Cada chave é opcional — passar só o gráfico que quer atualizar.
  // ---------------------------------------------------------------
  function updateCharts(payload) {
    if (!payload) return;

    if (payload.weekly && window.weeklyChart) {
      const w = payload.weekly;
      window.weeklyChart.data.labels = w.labels || [];
      window.weeklyChart.data.datasets[0].data = w.agendados  || [];
      window.weeklyChart.data.datasets[1].data = w.realizados || [];
      window.weeklyChart.update();
    }

    if (payload.specialty && window.specialtyChart) {
      const s = payload.specialty;
      window.specialtyChart.data.datasets[0].data = [s.derma || 0, s.fisio || 0];
      window.specialtyChart.update();
    }

    if (payload.intent && window.intentChart) {
      const i = payload.intent;
      window.intentChart.data.datasets[0].data = INTENT_KEYS.map(k => i[k] || 0);
      window.intentChart.update();
    }
  }
  window.updateCharts = updateCharts;

  function updateChartsTheme() {
    const style = getComputedStyle(document.body);
    const colOnSurfaceMuted = style.getPropertyValue('--color-on-surface-muted').trim() || '#bbcabe';
    const colPrimary = style.getPropertyValue('--color-primary').trim() || '#3cdfff';
    const colConfirmado = style.getPropertyValue('--st-confirmado').trim() || '#3cdfff';
    const colFisio = style.getPropertyValue('--intent-duvida').trim() || '#b79bf0';
    const colGrid = style.getPropertyValue('--color-outline-variant').trim() || 'rgba(134,148,137,0.08)';

    Chart.defaults.color = colOnSurfaceMuted;

    if (window.weeklyChart) {
      window.weeklyChart.data.datasets[1].borderColor = colConfirmado;
      
      const ctx = window.weeklyChart.ctx;
      const gradRealizados = ctx.createLinearGradient(0, 0, 0, 200);
      gradRealizados.addColorStop(0, colConfirmado + '38'); // ~22% opacidade
      gradRealizados.addColorStop(1, colConfirmado + '00');
      window.weeklyChart.data.datasets[1].backgroundColor = gradRealizados;

      window.weeklyChart.options.scales.x.grid.color = colGrid;
      window.weeklyChart.options.scales.x.ticks.color = colOnSurfaceMuted;
      window.weeklyChart.options.scales.y.grid.color = colGrid;
      window.weeklyChart.options.scales.y.ticks.color = colOnSurfaceMuted;
      window.weeklyChart.options.plugins.legend.labels.color = colOnSurfaceMuted;

      window.weeklyChart.update('none');
    }

    if (window.specialtyChart) {
      window.specialtyChart.data.datasets[0].backgroundColor = [colPrimary, colFisio];
      window.specialtyChart.options.plugins.legend.labels.color = colOnSurfaceMuted;
      window.specialtyChart.update('none');
    }

    if (window.intentChart) {
      const colors = INTENT_KEYS.map(k => {
        const key = '--intent-' + k.replace(/_/g, '-');
        return style.getPropertyValue(key).trim() || '#869489';
      });
      window.intentChart.data.datasets[0].backgroundColor = colors;
      window.intentChart.options.plugins.legend.labels.color = colOnSurfaceMuted;
      window.intentChart.update('none');
    }
  }
  window.updateChartsTheme = updateChartsTheme;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
