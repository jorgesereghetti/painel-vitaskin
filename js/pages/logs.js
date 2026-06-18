/* js/pages/logs.js — Aba Logs (Auditoria de Sistema)
 * Depende de: window.sysLogger
 * Expõe: window.renderLogsPage
 */
(function () {
  'use strict';

  let _activeLevel = 'ALL';
  let _searchQuery = '';
  let _isWired = false;

  // ── Renderização da Lista de Logs ─────────────────────────────────

  function _renderLogsList() {
    const container = document.getElementById('logsPageContainer');
    if (!container) return;

    if (typeof window.sysLogger === 'undefined') {
      container.innerHTML = '<div style="padding:16px;color:#f28b82;">Erro: Módulo sysLogger indisponível.</div>';
      return;
    }

    const logs = window.sysLogger.getLogs();
    const esc = window.escHtml || (s => String(s ?? ''));

    // Filtragem
    const filtered = logs.filter(l => {
      // Filtro de severidade
      if (_activeLevel !== 'ALL' && l.level !== _activeLevel) return false;
      
      // Filtro de pesquisa
      if (_searchQuery) {
        const q = _searchQuery.toLowerCase();
        const msgMatch = (l.message || '').toLowerCase().includes(q);
        const metaMatch = l.meta ? JSON.stringify(l.meta).toLowerCase().includes(q) : false;
        return msgMatch || metaMatch;
      }
      return true;
    });

    // Ordena do mais recente para o mais antigo (descendente)
    const sorted = [...filtered].reverse();

    // Badge de contagem
    const badge = document.getElementById('logCountBadge');
    if (badge) {
      badge.textContent = `${sorted.length} Eventos`;
    }

    if (!sorted.length) {
      container.innerHTML = '<div style="padding:32px;color:rgba(229,226,225,.30);text-align:center;font-family:var(--font-label);font-size:12px;">Nenhum log encontrado para os filtros atuais.</div>';
      return;
    }

    container.innerHTML = sorted.map(l => {
      const time = l.timestamp 
        ? new Date(l.timestamp).toLocaleTimeString('pt-BR', { hour12: false }) 
        : '—';
      const date = l.timestamp 
        ? new Date(l.timestamp).toLocaleDateString('pt-BR') 
        : '—';
      
      let badgeColor = 'rgba(166, 185, 168, 0.15)';
      let badgeTextColor = '#a6b9a8';
      
      if (l.level === 'WARN') {
        badgeColor = 'rgba(231, 177, 90, 0.15)';
        badgeTextColor = 'var(--st-agendado)';
      } else if (l.level === 'ERROR') {
        badgeColor = 'rgba(242, 139, 130, 0.15)';
        badgeTextColor = 'var(--st-cancelado)';
      } else if (l.level === 'INFO') {
        badgeColor = 'rgba(96, 236, 168, 0.15)';
        badgeTextColor = 'var(--st-confirmado)';
      }

      const metaHtml = l.meta ? `
        <pre style="margin:6px 0 0 0;padding:8px;background:rgba(20,20,19,.4);border:1px solid rgba(229,226,225,.08);border-radius:4px;color:rgba(229,226,225,.65);font-size:10px;white-space:pre-wrap;word-break:break-all;">${esc(JSON.stringify(l.meta, null, 2))}</pre>
      ` : '';

      return `
        <div style="padding:10px 14px;background:rgba(229,226,225,.02);border:1px solid rgba(229,226,225,.05);border-radius:6px;transition:all 0.2s;" onmouseover="this.style.background='rgba(229,226,225,.04)'" onmouseout="this.style.background='rgba(229,226,225,.02)'">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:10px;color:rgba(229,226,225,.35);font-family:var(--font-label);">${esc(date)} às ${esc(time)}</span>
            <span style="padding:2px 8px;border-radius:3px;font-size:9px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;background:${badgeColor};color:${badgeTextColor};">${esc(l.level)}</span>
            <span style="color:var(--color-on-surface);flex-1;word-break:break-word;font-weight:500;">${esc(l.message)}</span>
          </div>
          ${metaHtml}
        </div>
      `;
    }).join('');
  }

  // ── Fiação dos Eventos e Cliques ────────────────────────────────────

  function _wireEvents() {
    if (_isWired) return;
    _isWired = true;

    // Search bar
    const searchInput = document.getElementById('logSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        _searchQuery = searchInput.value;
        _renderLogsList();
      });
    }

    // Severity level buttons
    const severityFilters = document.getElementById('logSeverityFilters');
    if (severityFilters) {
      const buttons = severityFilters.querySelectorAll('.seg-option');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          _activeLevel = btn.dataset.level;
          _renderLogsList();
        });
      });
    }

    // Copy Logs Page
    const copyBtn = document.getElementById('btnCopyLogsPage');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const logs = window.sysLogger ? window.sysLogger.getLogs() : [];
        const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message} ${l.meta ? JSON.stringify(l.meta) : ''}`).join('\n');
        navigator.clipboard.writeText(text)
          .then(() => {
            const orig = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 15px;">check</span> Copiado!';
            if (window.sysLogger) window.sysLogger.info('Auditoria: Logs do sistema copiados para a área de transferência.');
            setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
          })
          .catch(err => {
            console.error('Falha ao copiar logs:', err);
          });
      });
    }

    // Clear Logs Page
    const clearBtn = document.getElementById('btnClearLogsPage');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Tem certeza de que deseja limpar todo o histórico de logs local do sistema?')) {
          if (window.sysLogger) {
            window.sysLogger.clearLogs();
            window.sysLogger.info('Auditoria: Histórico de logs limpo pelo usuário.');
          }
          _renderLogsList();
        }
      });
    }

    // Subscreve para re-renderizar em tempo real quando novos logs chegarem
    if (window.sysLogger) {
      window.sysLogger.subscribe((entry) => {
        // Se a aba logs for a página ativa atual, re-renderiza em tempo real
        const page = document.querySelector('section[data-page="logs"]');
        if (page && page.classList.contains('active')) {
          _renderLogsList();
        }
      });
    }
  }

  // ── Orchestrator Exposto ──────────────────────────────────────────

  function renderLogsPage() {
    _wireEvents();
    _renderLogsList();
    if (window.sysLogger) {
      window.sysLogger.info('Auditoria: Aba de Logs de Auditoria renderizada.');
    }
  }

  window.renderLogsPage = renderLogsPage;

})();
