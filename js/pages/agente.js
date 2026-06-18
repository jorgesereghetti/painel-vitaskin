/* js/pages/agente.js — Aba Agente
 * Depende de: window.fetchAgente, window.Chart (CDN)
 * Expõe: window.renderAgentePage
 */
(function () {
  'use strict';

  let _intentChart = null;
  let _inFlight = false;

  // ── Cores das intenções (lidas dos tokens CSS) ──────────────────

  function _intentColor(intencao) {
    const key = '--intent-' + (intencao || '').toLowerCase().replace(/_/g, '-');
    const val = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
    return val || '#8a8a8a';
  }

  // ── Métricas ────────────────────────────────────────────────────

  function _renderMetrics(data) {
    // 3 metric-cards na seção agente — selecionar pela posição dentro da seção
    const section = document.querySelector('[data-page="agente"]');
    if (!section) return;
    const vals = section.querySelectorAll('.metric-card .metric-val');
    if (vals[0]) vals[0].textContent = data.msgsHoje;
    if (vals[1]) vals[1].textContent = data.cadastrosBot;
    if (vals[2]) vals[2].textContent = data.agendBot;
  }

  // ── Donut de intenções ──────────────────────────────────────────

  function _renderIntentChart(intencoes) {
    const canvas = document.getElementById('intentCanvas');
    if (!canvas || typeof window.Chart === 'undefined') return;

    // Agrupar por intencao
    const counts = {};
    intencoes.forEach(c => {
      const k = (c.intencao || 'desconhecida').toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const values = labels.map(k => counts[k]);
    const colors = labels.map(k => _intentColor(k));

    if (window.intentChart) {
      window.intentChart.destroy();
      window.intentChart = null;
    }
    if (_intentChart) {
      _intentChart.destroy();
      _intentChart = null;
    }

    _intentChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels.map(l => l.replace(/-/g, ' ')),
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#1e1e1d',
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(229,226,225,.60)',
              font: { family: "'Space Grotesk', sans-serif", size: 11 },
              boxWidth: 10,
              padding: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.parsed / values.reduce((a, b) => a + b, 0) * 100)}%)`,
            },
          },
        },
        cutout: '65%',
      },
    });
  }

  // ── Log de conversas ────────────────────────────────────────────

  function _renderConvLog(logConv) {
    const container = document.getElementById('convLog');
    if (!container) return;
    if (!logConv.length) {
      container.innerHTML = '<div style="padding:16px;color:rgba(229,226,225,.35);font-family:var(--font-label);font-size:12px;">Sem conversas recentes</div>';
      return;
    }
    
    const esc = window.escHtml || (s => String(s ?? ''));
    
    container.innerHTML = logConv.map(c => {
      const isIn = c.direcao === 'entrada';
      const hora = c.timestamp
        ? new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';
      const nome = c.pacientes?.nome || 'Desconhecido';
      const intentTag = c.intencao
        ? `<span style="color:var(--intent-${esc(c.intencao.replace(/_/g,'-'))}, var(--color-primary));font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-left:6px;">[${esc(c.intencao.replace(/_/g,' '))}]</span>`
        : '';
      const rawMsg = c.mensagem || '—';
      const msg = rawMsg.length > 80
        ? rawMsg.slice(0, 80) + '…'
        : rawMsg;

      return `<div class="${isIn ? 'dir-in' : 'dir-out'}" style="padding:7px 12px;margin-bottom:4px;border-radius:4px;font-size:12px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-family:var(--font-label);font-size:10px;font-weight:600;color:rgba(229,226,225,.55);">${isIn ? '←' : '→'} ${esc(nome)}</span>
          ${intentTag}
          <span style="margin-left:auto;font-family:var(--font-label);font-size:10px;color:rgba(229,226,225,.30);">${hora}</span>
        </div>
        <div style="color:rgba(229,226,225,.75);line-height:1.4;">${esc(msg)}</div>
      </div>`;
    }).join('');
  }

  // ── Skeletons ───────────────────────────────────────────────────

  function _showSkeletons() {
    const section = document.querySelector('[data-page="agente"]');
    if (!section) return;
    section.querySelectorAll('.metric-card .metric-val').forEach(el => {
      el.classList.add('skeleton');
      el.textContent = '';
    });
    const convLog = document.getElementById('convLog');
    if (convLog) {
      convLog.innerHTML = Array(5).fill(
        '<div class="skeleton" style="height:40px;margin-bottom:6px;border-radius:4px;"></div>'
      ).join('');
    }
  }

  function _removeSkeletons() {
    const section = document.querySelector('[data-page="agente"]');
    if (!section) return;
    section.querySelectorAll('.metric-card .metric-val').forEach(el => el.classList.remove('skeleton'));
  }

  function _renderBotHealth(logConv) {
    const badge = document.getElementById('botStatusBadge');
    const dot = document.getElementById('botStatusDot');
    const text = document.getElementById('botStatusText');

    if (!badge || !dot || !text) return;

    if (!logConv || !logConv.length) {
      // Sem uso / Sem registro
      badge.style.borderColor = 'var(--color-outline-variant)';
      badge.style.background = 'var(--color-surface-low)';
      badge.style.color = 'rgba(var(--color-on-surface-rgb), 0.55)';
      dot.style.backgroundColor = 'rgba(var(--color-on-surface-rgb), 0.55)';
      text.textContent = 'SEM REGISTRO';
      return;
    }

    // A conversa mais recente é a primeira no array devido ao order desc no Supabase
    const cRecente = logConv[0];
    if (!cRecente || !cRecente.timestamp) return;

    const agora = Date.now();
    const tRecente = new Date(cRecente.timestamp).getTime();
    const diffMin = (agora - tRecente) / (1000 * 60);

    if (diffMin < 30) {
      // Ativo e operacional (última interação há menos de 30 minutos)
      badge.style.borderColor = 'var(--color-highlight-border)';
      badge.style.background = 'var(--color-highlight-icon-bg)';
      badge.style.color = 'var(--color-primary)';
      dot.style.backgroundColor = 'var(--color-primary)';
      text.textContent = 'ATIVO';
    } 
    else if (diffMin >= 30 && diffMin < 1440) {
      // Ocioso/Sem tráfego recente (entre 30 minutos e 24 horas - standby)
      badge.style.borderColor = 'rgba(212, 169, 104, 0.25)';
      badge.style.background = 'rgba(212, 169, 104, 0.06)';
      badge.style.color = 'var(--st-agendado)';
      dot.style.backgroundColor = 'var(--st-agendado)';
      text.textContent = 'OCIOSO';
    } 
    else {
      // Inativo / Sem interação há mais de 24 horas
      badge.style.borderColor = 'rgba(242, 139, 130, 0.25)';
      badge.style.background = 'rgba(242, 139, 130, 0.06)';
      badge.style.color = 'var(--st-cancelado)';
      dot.style.backgroundColor = 'var(--st-cancelado)';
      text.textContent = 'INATIVO';
    }
    
    if (window.sysLogger) {
      window.sysLogger.info(`Agente: AI Heartbeat calculado. Status do bot: ${text.textContent}`);
    }
  }

  // ── Orchestrator ─────────────────────────────────────────────────

  async function renderAgentePage() {
    if (_inFlight) return;
    _inFlight = true;
    _showSkeletons();
    try {
      const data = await window.fetchAgente();
      _removeSkeletons();
      _renderMetrics(data);
      _renderIntentChart(data.intencoes);
      _renderConvLog(data.logConv);
      _renderBotHealth(data.logConv); // 🚀 Injeta o AI Heartbeat!
      if (window.sysLogger) {
        window.sysLogger.info('Agente: Métricas e histórico de conversas do agente virtual carregados');
      }
    } catch (err) {
      console.error('[agente] render error:', err);
      if (window.sysLogger) {
        window.sysLogger.error(`Agente: Falha ao carregar dados do bot: ${err.message || String(err)}`);
      }
      _removeSkeletons();
      const convLog = document.getElementById('convLog');
      if (convLog) {
        convLog.innerHTML = '<div class="error-banner" style="margin:12px;">' +
          '<span class="material-symbols-outlined">error_outline</span> Erro ao carregar dados do agente.</div>';
      }
    } finally {
      _inFlight = false;
    }
  }

  window.renderAgentePage = renderAgentePage;
})();
