// js/utils.js
// Helpers puros para o painel — INFRA-05.
// Sem dependências externas. Não toca em Supabase, não conhece dados.
// Todas as funções são expostas em window.* para uso pelas Phases 3-6.

(function() {

  // ---------------------------------------------------------------
  // Formatters pt-BR
  // ---------------------------------------------------------------

  // fmtDate('2026-04-22T14:30:00Z') → '22/04/2026'
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  window.fmtDate = fmtDate;

  // fmtTime('2026-04-22T14:30:00Z') → '14:30' (depende do timezone do browser, esperado)
  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  window.fmtTime = fmtTime;

  // fmtDateTime('2026-04-22T14:30:00Z') → '22/04/2026 14:30'
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  }
  window.fmtDateTime = fmtDateTime;

  // fmtRelative('...') → 'agora' | '3h atrás' | '2d atrás'
  function fmtRelative(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 0) return 'agora'; // datas no futuro: tratar como "agora" (ex: agendamento futuro)
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'agora';
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  }
  window.fmtRelative = fmtRelative;

  // ---------------------------------------------------------------
  // escHtml — escapa caracteres HTML especiais para evitar XSS.
  // Use sempre que inserir dados do usuário via innerHTML.
  // escHtml('<script>') → '&lt;script&gt;'
  // ---------------------------------------------------------------
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }
  window.escHtml = escHtml;

  // ---------------------------------------------------------------
  // maskPhone — protege dígitos do meio do número.
  // '+5511987654321' → '(55) 1****-4321'
  // '11987654321'   → '(11) 9****-4321'
  // Inputs inválidos (null, < 10 dígitos) retornam o input original sem mascarar.
  // ---------------------------------------------------------------
  function maskPhone(phone) {
    const d = (phone || '').replace(/\D/g, '');
    if (d.length < 10) return phone;
    return `(${d.slice(0,2)}) ${d[2]}****-${d.slice(-4)}`;
  }
  window.maskPhone = maskPhone;

  // ---------------------------------------------------------------
  // renderStatusBadge — pill colorida pelo status do agendamento.
  // Cores em CSS custom properties (ver css/variables.css).
  // ---------------------------------------------------------------
  function renderStatusBadge(status) {
    const map = {
      agendado:   { label: 'Agendado',   color: 'var(--st-agendado)'   },
      confirmado: { label: 'Confirmado', color: 'var(--st-confirmado)' },
      cancelado:  { label: 'Cancelado',  color: 'var(--st-cancelado)'  },
      realizado:  { label: 'Realizado',  color: 'var(--st-realizado)'  },
      reagendado: { label: 'Reagendado', color: 'var(--intent-reagendamento)' },
      falta:      { label: 'Falta',      color: 'var(--st-cancelado)'  }, // vermelho suave — mesmo tom de cancelado
    };
    const s = map[status] || { label: status || '—', color: 'var(--color-outline)' };
    return `<span class="pill" style="--pill-color:${s.color}"><span class="dot"></span>${s.label}</span>`;
  }
  window.renderStatusBadge = renderStatusBadge;

  // ---------------------------------------------------------------
  // originBadge — badge com ícone do canal de origem.
  // Aceita 'whatsapp' / 'site' / 'indicação'.
  // ---------------------------------------------------------------
  function originBadge(canal) {
    const key = (canal || '').toLowerCase().trim();
    const map = {
      whatsapp:   { icon: 'forum',     label: 'WhatsApp',  color: 'var(--color-primary)' },
      site:       { icon: 'language',  label: 'Site',      color: '#7ad6ff' },
      'indicação':{ icon: 'group_add', label: 'Indicação', color: '#b79bf0' },
      indicacao:  { icon: 'group_add', label: 'Indicação', color: '#b79bf0' }, // tolerante a sem acento
      telefone:   { icon: 'call',      label: 'Telefone',  color: '#b79bf0' }, // canal de origem manual
      presencial: { icon: 'person',    label: 'Presencial',color: '#869489' }, // canal de origem manual
    };
    const o = map[key] || { icon: 'help', label: canal || '—', color: '#869489' };
    // escHtml no label do fallback — evita XSS se canal_origem vier com valor inesperado do banco.
    const safeLabel = (typeof window.escHtml === 'function') ? window.escHtml(o.label) : String(o.label || '—');
    return `<span class="origin-badge" style="color:${o.color}"><span class="material-symbols-outlined">${o.icon}</span>${safeLabel}</span>`;
  }
  window.originBadge = originBadge;

  // ---------------------------------------------------------------
  // openSide(html) / closeSide() — controle do side panel.
  // index.html já tem #sidePanel (aside vazio) e #sideBack (overlay).
  // css/components.css tem .side-panel.open + .side-back.open com slide-in.
  // ---------------------------------------------------------------
  function openSide(html) {
    const panel = document.getElementById('sidePanel');
    const back  = document.getElementById('sideBack');
    if (!panel || !back) {
      console.warn('[utils] openSide: #sidePanel ou #sideBack não encontrado.');
      return;
    }
    panel.innerHTML = html || '';
    panel.classList.add('open');
    back.classList.add('open');
    // ESC fecha
    document.addEventListener('keydown', escClose);
    // Click fora fecha
    back.addEventListener('click', closeSide, { once: true });
  }
  window.openSide = openSide;

  function closeSide() {
    const panel = document.getElementById('sidePanel');
    const back  = document.getElementById('sideBack');
    if (panel) panel.classList.remove('open');
    if (back)  back.classList.remove('open');
    document.removeEventListener('keydown', escClose);
  }
  window.closeSide = closeSide;

  function escClose(e) {
    if (e.key === 'Escape') closeSide();
  }

  // Aliases para compatibilidade com agenda.js e pacientes.js
  window.formatTime = fmtTime;
  window.formatDate = fmtDate;

})();
