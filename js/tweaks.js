/* js/tweaks.js — Painel de tweaks (ferramenta de dev)
 * Trigger: clique no .brand-mark ("VS" no topo do sidebar)
 * Controlos: grid toggle, empty state (Pacientes), densidade da tabela
 * Expõe: window.toggleTweaks
 */
(function () {
  'use strict';

  const panel      = document.getElementById('tweaks');
  const brandMark  = document.querySelector('.brand-mark');
  const gridCheck  = document.getElementById('tweak-grid');
  const emptyCheck = document.getElementById('tweak-empty');
  const comfortBtn = document.getElementById('tweak-comfort');
  const compactBtn = document.getElementById('tweak-compact');
  const gridOverlay = document.getElementById('gridOverlay');

  if (!panel) return;

  // ── Toggle panel (trigger: .brand-mark) ─────────────────────────
  function toggleTweaks() {
    panel.classList.toggle('hidden-t');
  }

  if (brandMark) {
    brandMark.style.cursor = 'pointer';
    brandMark.setAttribute('title', 'Tweaks');
    brandMark.addEventListener('click', toggleTweaks);
  }

  // ── Grid overlay ─────────────────────────────────────────────────
  if (gridCheck && gridOverlay) {
    // Inicial: grid visível (checkbox checked no HTML)
    gridCheck.addEventListener('change', function () {
      gridOverlay.style.opacity = gridCheck.checked ? '' : '0';
    });
  }

  // ── Empty state — força empty state na aba Clientes ─────────────
  if (emptyCheck) {
    emptyCheck.addEventListener('change', function () {
      const tbody  = document.getElementById('patientsBody');
      const emptyEl = document.getElementById('patientsEmpty');
      if (emptyCheck.checked) {
        if (tbody)   tbody.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
      } else {
        if (emptyEl) emptyEl.classList.add('hidden');
        // Re-renderiza a aba se estiver activa
        if (typeof window.renderClientesPage === 'function') {
          const active = document.querySelector('.nav-item.active[data-tab]');
          if (active && active.dataset.tab === 'clientes') {
            window.renderClientesPage();
          }
        }
      }
    });
  }

  // ── Densidade da tabela ──────────────────────────────────────────
  function _setDensity(compact) {
    if (compact) {
      document.body.classList.add('compact');
      if (comfortBtn) comfortBtn.classList.remove('active');
      if (compactBtn) compactBtn.classList.add('active');
    } else {
      document.body.classList.remove('compact');
      if (comfortBtn) comfortBtn.classList.add('active');
      if (compactBtn) compactBtn.classList.remove('active');
    }
  }

  if (comfortBtn) comfortBtn.addEventListener('click', function () { _setDensity(false); });
  if (compactBtn) compactBtn.addEventListener('click', function () { _setDensity(true); });

  // ── Controle do console visual de Logs do Sistema ──────────────────
  const consoleEl = document.getElementById('tweak-logs-console');
  const copyBtn   = document.getElementById('tweak-copy-logs');
  const clearBtn  = document.getElementById('tweak-clear-logs');

  function _appendLogEntry(entry) {
    if (!consoleEl) return;
    
    if (entry.type === 'clear') {
      consoleEl.innerHTML = '<div style="color:rgba(229,226,225,.3); font-style:italic;">Nenhum log registrado.</div>';
      return;
    }
    
    // Se o placeholder estiver ativo, limpa ele
    if (consoleEl.children.length === 1 && consoleEl.children[0].style.fontStyle === 'italic') {
      consoleEl.innerHTML = '';
    }

    const time = new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const colors = {
      ERROR: '#ffb4ab',
      WARN: '#e7b15a',
      INFO: 'rgba(229,226,225,.65)'
    };
    const color = colors[entry.level] || colors.INFO;
    
    const div = document.createElement('div');
    div.style.lineHeight = '1.3';
    div.style.marginBottom = '2px';
    div.style.wordBreak = 'break-all';
    
    const esc = window.escHtml || (s => String(s ?? ''));
    const safeMsg = esc(entry.message);
    const safeMeta = entry.meta ? ` <span style="color:rgba(229,226,225,.35); cursor:help;" title="${esc(JSON.stringify(entry.meta))}">({…})</span>` : '';
    
    div.innerHTML = `<span style="color:rgba(229,226,225,.3);">${time}</span> ` +
                    `<span style="color:${color}; font-weight:600;">[${entry.level}]</span> ` +
                    `<span style="color:rgba(229,226,225,.8);">${safeMsg}</span>${safeMeta}`;
                    
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight; // Auto-scroll para baixo
  }

  // Inicializa logs se o logger estiver carregado
  if (window.sysLogger && consoleEl) {
    const initialLogs = window.sysLogger.getLogs();
    if (initialLogs.length === 0) {
      consoleEl.innerHTML = '<div style="color:rgba(229,226,225,.3); font-style:italic;">Nenhum log registrado.</div>';
    } else {
      initialLogs.forEach(entry => _appendLogEntry(entry));
    }
    
    // Inscreve-se para receber novos logs
    window.sysLogger.subscribe(entry => _appendLogEntry(entry));
  }

  // Botão de copiar logs
  if (copyBtn && window.sysLogger) {
    copyBtn.addEventListener('click', function() {
      const logs = window.sysLogger.getLogs();
      const text = JSON.stringify(logs, null, 2);
      
      navigator.clipboard.writeText(text).then(() => {
        const origText = copyBtn.textContent;
        copyBtn.textContent = 'Copiado!';
        copyBtn.style.color = 'var(--color-primary)';
        setTimeout(() => {
          copyBtn.textContent = origText;
          copyBtn.style.color = '';
        }, 1500);
      }).catch(err => {
        console.error('[tweaks] Falha ao copiar logs:', err);
      });
    });
  }

  // Botão de limpar logs
  if (clearBtn && window.sysLogger) {
    clearBtn.addEventListener('click', function() {
      if (confirm('Deseja realmente limpar todos os logs do sistema localmente?')) {
        window.sysLogger.clearLogs();
      }
    });
  }

  window.toggleTweaks = toggleTweaks;
})();
