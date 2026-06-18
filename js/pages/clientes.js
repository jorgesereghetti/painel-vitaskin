/* js/pages/clientes.js — Aba Clientes (Unificada)
 * Gerencia dinamicamente sub-abas para Funil de Leads e Histórico de Pacientes.
 * Incorpora controle de follow-ups diretamente no Funil de Leads.
 * Oferece proteção rigorosa contra injeção de scripts (XSS) via escHtml.
 * Expõe: window.renderClientesPage
 */
(function() {
  'use strict';

  // Estado interno da aba
  let _activeSubtab = 'leads'; // 'leads' ou 'pacientes'
  let _leadsData = [];
  let _convertidosSet = new Set();
  let _patientsData = [];
  let _inFlight = false;

  // ── Inicialização & Eventos das Sub-abas ────────────────────────────

  function _wireSubtabs() {
    const buttons = document.querySelectorAll('.seg-option[data-subtab]');
    buttons.forEach(btn => {
      // Evita listener duplo
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';

      btn.addEventListener('click', async () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const target = btn.dataset.subtab;
        _activeSubtab = target;
        if (window.sysLogger) {
          window.sysLogger.info(`Clientes: Alterado para sub-aba "${target}"`);
        }

        // Alterna subpainéis visuais
        const panelLeads = document.getElementById('subpanel-leads');
        const panelPacientes = document.getElementById('subpanel-pacientes');

        if (target === 'leads') {
          if (panelLeads) panelLeads.classList.remove('hidden');
          if (panelPacientes) panelPacientes.classList.add('hidden');
        } else {
          if (panelLeads) panelLeads.classList.add('hidden');
          if (panelPacientes) panelPacientes.classList.remove('hidden');
        }

        // Força a atualização e o fetch de dados da aba recém-selecionada
        await renderClientesPage();
      });
    });
  }

  // Injeta info complementar no header da aba
  function _renderLeadsSupport() {
    const supportEl = document.getElementById('clientes-header-support');
    if (supportEl) {
      const activeLeads = _leadsData.filter(l => !_convertidosSet.has(l.id)).length;
      supportEl.innerHTML = `<span class="chip font-label">${activeLeads} Leads ativos</span>` +
        `<button id="btnNovoClienteLeads" class="seg-btn active" style="font-size: 11px; padding: 6px 12px; height: 28px; background: var(--color-primary); color: var(--color-background); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: none; box-shadow: 0 0 10px var(--color-highlight-shadow); cursor: pointer; border-radius: var(--radius-sm); margin-left: 10px;">` +
        `<span class="material-symbols-outlined" style="font-size: 14px;">person_add</span> Novo Cliente` +
        `</button>`;

      const btn = document.getElementById('btnNovoClienteLeads');
      if (btn) {
        btn.addEventListener('click', _openNewPatientModal);
      }
    }
  }

  function _renderPatientsSupport() {
    const supportEl = document.getElementById('clientes-header-support');
    if (supportEl) {
      supportEl.innerHTML = `<span class="chip font-label">${_patientsData.length} Pacientes cadastrados</span>` +
        `<button id="btnNovoClientePatients" class="seg-btn active" style="font-size: 11px; padding: 6px 12px; height: 28px; background: var(--color-primary); color: var(--color-background); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: none; box-shadow: 0 0 10px var(--color-highlight-shadow); cursor: pointer; border-radius: var(--radius-sm); margin-left: 10px;">` +
        `<span class="material-symbols-outlined" style="font-size: 14px;">person_add</span> Novo Cliente` +
        `</button>`;

      const btn = document.getElementById('btnNovoClientePatients');
      if (btn) {
        btn.addEventListener('click', _openNewPatientModal);
      }
    }
  }

  function _openNewPatientModal() {
    if (window.sysLogger) {
      window.sysLogger.info('Clientes: Modal de cadastro de novo cliente aberto');
    }
    const html = `
      <div style="padding:32px 28px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
          <div>
            <div class="chip font-label">Cadastro</div>
            <div style="font-family:var(--font-headline);font-size:22px;font-weight:700;margin-top:8px;">Novo Paciente</div>
          </div>
          <button onclick="window.closeSide()" style="background:none;border:none;cursor:pointer;color:var(--color-on-surface);opacity:.5;padding:4px;">
            <span class="material-symbols-outlined" style="font-size:20px;">close</span>
          </button>
        </div>
        <form id="form-novo-paciente" style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Nome Completo</label>
            <input type="text" id="pac-nome" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;" placeholder="Ex: Ana Silva">
          </div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Telefone</label>
            <input type="text" id="pac-telefone" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;" placeholder="Ex: (11) 99999-9999">
          </div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Convênio</label>
            <input type="text" id="pac-convenio" class="field-i" style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;" placeholder="Ex: Particular ou Bradesco" value="particular">
          </div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Canal de Origem</label>
            <select id="pac-origem" class="field-i" style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;">
              <option value="telefone" selected>Telefone</option>
              <option value="presencial">Presencial</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Observações Clínicas</label>
            <textarea id="pac-observacoes" class="field-i" style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;height:80px;" placeholder="Alergias, preferências de tratamentos, etc."></textarea>
          </div>
          <button type="submit" class="seg-btn active" style="margin-top:8px;padding:12px;width:100%;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;box-shadow:0 0 12px var(--color-highlight-shadow);cursor:pointer;border-radius:var(--radius);">
            Salvar Cadastro
          </button>
        </form>
      </div>`;

    window.openSide(html);

    const form = document.getElementById('form-novo-paciente');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('pac-nome').value.trim();
        const telefone = document.getElementById('pac-telefone').value.trim();
        const convenio = document.getElementById('pac-convenio').value.trim();
        const canal_origem = document.getElementById('pac-origem').value;
        const observacoes = document.getElementById('pac-observacoes').value.trim();

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gravando...';

        try {
          if (typeof window.insertPaciente !== 'function') {
            throw new Error('Função window.insertPaciente não encontrada.');
          }
          await window.insertPaciente({
            nome,
            telefone,
            convenio,
            canal_origem,
            observacoes
          });
          
          if (window.sysLogger) {
            window.sysLogger.info(`Novo paciente cadastrado com sucesso: ${nome}`);
          }
          
          window.closeSide();
          // Recarrega os dados e a aba de pacientes
          window.refreshCurrentTab();
        } catch (err) {
          console.error('[clientes] erro ao inserir paciente:', err);
          if (window.sysLogger) {
            window.sysLogger.error(`Erro ao cadastrar paciente: ${err.message || String(err)}`);
          }
          let errorBanner = form.querySelector('.error-banner');
          if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.className = 'error-banner';
            errorBanner.style.cssText = 'margin-bottom:14px;';
            form.insertBefore(errorBanner, form.firstChild);
          }
          errorBanner.innerHTML = `<span class="material-symbols-outlined">error_outline</span><span>Erro ao cadastrar paciente: ${window.escHtml(err.message || String(err))}</span>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar Cadastro';
        }
      });
    }
  }

  // ── BLOC0 A: LÓGICA DE LEADS ───────────────────────────────────────

  function _leadStatus(lead) {
    if (!lead) return 'pendente';
    if (_convertidosSet.has(lead.id)) return 'convertido';
    const fps = lead.follow_ups || [];
    if (!fps.length) return 'pendente';
    const sorted = [...fps].sort((a, b) => {
      const dA = a.ultimo_envio ? new Date(a.ultimo_envio).getTime() : 0;
      const dB = b.ultimo_envio ? new Date(b.ultimo_envio).getTime() : 0;
      const valA = isNaN(dA) ? 0 : dA;
      const valB = isNaN(dB) ? 0 : dB;
      return valB - valA;
    });
    return sorted[0].status || 'pendente';
  }

  function _isFrio(lead) {
    if (!lead) return false;
    const convs = lead.conversas || [];
    if (!convs.length) return false;
    const sorted = [...convs].sort((a, b) => {
      const dA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      const valA = isNaN(dA) ? 0 : dA;
      const valB = isNaN(dB) ? 0 : dB;
      return valB - valA;
    });
    if (!sorted[0] || !sorted[0].timestamp) return false;
    const tUltima = new Date(sorted[0].timestamp).getTime();
    if (isNaN(tUltima)) return false;
    const diffH = (Date.now() - tUltima) / (1000 * 60 * 60);
    return diffH > 48;
  }

  function _lastIntencao(lead) {
    if (!lead) return '—';
    const convs = (lead.conversas || []).filter(c => c.intencao);
    if (!convs.length) return '—';
    const sorted = [...convs].sort((a, b) => {
      const dA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      const valA = isNaN(dA) ? 0 : dA;
      const valB = isNaN(dB) ? 0 : dB;
      return valB - valA;
    });
    return String(sorted[0].intencao || '—').replace(/_/g, ' ');
  }

  function _statusBadge(status) {
    const map = {
      convertido: 'pill-realizado',
      respondido: 'pill-confirmado',
      encerrado:  'pill-cancelado',
      pendente:   'pill-pendente',
    };
    const cls = map[status] || 'pill-pendente';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="pill ${cls}"><span class="dot"></span>${window.escHtml(label)}</span>`;
  }

  function _renderLeadsFunnel(leads) {
    const funnelStages = document.querySelectorAll('.leads-funnel-stage .metric-val');
    const rateStages = document.querySelectorAll('.leads-funnel-stage .funnel-conversion-rate');
    if (!funnelStages.length) return;

    const captados     = leads.length;
    const qualificados = leads.filter(l => (l.conversas || []).some(c => c.intencao)).length;
    const agendados    = leads.filter(l => (l.conversas || []).some(c => c.intencao === 'agendamento')).length;
    const convertidos  = leads.filter(l => _convertidosSet.has(l.id)).length;
    
    const vals = [captados, qualificados, agendados, convertidos];
    funnelStages.forEach((el, i) => { el.textContent = vals[i] ?? '—'; });

    if (rateStages.length >= 4) {
      // 1. Qualificação (Qualificados / Captados)
      const txQual = captados ? Math.round((qualificados / captados) * 100) : 0;
      _formatFunnelRate(rateStages[1], txQual, 'Conv: ');

      // 2. Agendamento (Agendados / Qualificados)
      const txAgend = qualificados ? Math.round((agendados / qualificados) * 100) : 0;
      _formatFunnelRate(rateStages[2], txAgend, 'Conv: ');

      // 3. Conversão final (Convertidos / Agendados)
      const txConv = agendados ? Math.round((convertidos / agendados) * 100) : 0;
      _formatFunnelRate(rateStages[3], txConv, 'Show-rate: ');
    }
  }

  function _formatFunnelRate(el, rate, prefix) {
    if (!el) return;
    el.style.opacity = '1'; // Reseta opacidade padrão
    if (rate < 30) {
      // Gargalo detectado! Destaca em dourado/âmbar de atenção
      el.style.color = 'var(--st-agendado)';
      el.innerHTML = `${prefix}${rate}% <span style="margin-left:2px; font-weight:600;">⚠ gargalo</span>`;
    } else if (rate >= 55) {
      // Excelente conversão! Verde/Azul sucesso
      el.style.color = 'var(--st-confirmado)';
      el.innerHTML = `${prefix}${rate}% <span style="margin-left:2px; font-weight:600;">✓ excelente</span>`;
    } else {
      // Conversão padrão saudável
      el.style.color = 'var(--color-on-surface)';
      el.style.opacity = '0.45';
      el.textContent = `${prefix}${rate}%`;
    }
  }

  function _renderFollowups(leads) {
    // Agrupa follow-ups
    const counts = [0, 0, 0]; // T1, T2, T3
    leads.forEach(l => {
      const fps = l.follow_ups || [];
      const pendentes = fps.filter(fu => fu.status === 'pendente');
      pendentes.forEach(item => {
        const t = Number(item.tentativa);
        if (t >= 1 && t <= 3) counts[t - 1] += 1;
      });
    });
    const total = counts[0] + counts[1] + counts[2];

    const totalEl = document.querySelector('#subpanel-leads .followups-total');
    if (totalEl) totalEl.textContent = String(total);

    const countEls = document.querySelectorAll('#subpanel-leads .followup-count');
    countEls.forEach((el, i) => {
      el.textContent = String(counts[i]);
    });
  }

  function _applyLeadsFilter(statusFilter) {
    if (window.sysLogger) {
      window.sysLogger.info(`Clientes: Leads filtrados por status "${statusFilter}"`);
    }
    let rows = _leadsData;
    if (statusFilter !== 'todos') {
      rows = rows.filter(l => _leadStatus(l) === statusFilter);
    }
    _renderLeadsRows(rows);
  }

  function _wireLeadsFilters() {
    const container = document.getElementById('leadsFilters');
    if (!container || container.dataset.wired) return;
    container.dataset.wired = '1';
    container.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _applyLeadsFilter(btn.dataset.status);
      });
    });
  }

  function _renderLeadsRows(rows) {
    const tbody = document.getElementById('leadsBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:32px 0;">' +
        '<div class="empty-state">' +
        '<span class="empty-icon grid place-items-center"><span class="material-symbols-outlined">person_search</span></span>' +
        '<div class="empty-title font-headline">Nenhum lead encontrado</div>' +
        '<div class="empty-sub">Sem resultados para este filtro</div>' +
        '</div></td></tr>';
      return;
    }
    
    const esc = window.escHtml || (s => String(s ?? ''));
    
    tbody.innerHTML = rows.map(l => {
      const tel = (typeof window.maskPhone === 'function') ? window.maskPhone(l.telefone) : (l.telefone || '—');
      const origem = (typeof window.originBadge === 'function') ? window.originBadge(l.canal_origem) : (l.canal_origem || '—');
      const intencao = _lastIntencao(l);
      const status = _leadStatus(l);
      const frio = _isFrio(l);
      const frioTag = frio ? '<span class="pill" style="background:rgba(var(--color-on-surface-rgb),.05);color:var(--color-error);border-color:var(--color-outline-variant);margin-left:6px;"><span class="dot" style="background:var(--color-error);"></span>frio</span>' : '';
      return `<tr data-id="${l.id}" style="cursor:pointer;">
        <td>${esc(l.nome) || '—'}${frioTag}</td>
        <td class="font-label">${esc(tel)}</td>
        <td>${origem}</td>
        <td class="font-label" style="text-transform:capitalize;">${esc(intencao)}</td>
        <td>${_statusBadge(status)}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const lead = _leadsData.find(l => String(l.id) === tr.dataset.id);
        if (lead) _openLeadDetail(lead);
      });
    });
  }

  function _openLeadDetail(lead) {
    if (window.sysLogger) {
      window.sysLogger.info(`Clientes: Detalhes do lead "${lead.nome}" visualizados`, { leadId: lead.id });
    }
    const esc = window.escHtml || (s => String(s ?? ''));
    const tel = (typeof window.maskPhone === 'function') ? window.maskPhone(lead.telefone) : (lead.telefone || '—');
    const cleanPhone = (lead.telefone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? (cleanPhone.startsWith('55') ? `https://wa.me/${cleanPhone}` : `https://wa.me/55${cleanPhone}`) : '';
    const conversas = [...(lead.conversas || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const timeline = conversas.length
      ? conversas.map(c => {
          const isIn = c.direcao === 'entrada';
          const hora = c.timestamp
            ? new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : '—';
          const intentTag = c.intencao
            ? `<span style="font-family:var(--font-label);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--color-primary);margin-top:2px;display:block;">${esc(c.intencao.replace(/_/g, ' '))}</span>`
            : '';
          return `<div class="${isIn ? 'dir-in' : 'dir-out'}" style="padding:8px 12px;margin-bottom:6px;border-radius:6px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="flex:1;">
                <div style="font-size:13px;line-height:1.4;">${esc(c.mensagem) || '—'}</div>
                ${intentTag}
              </div>
              <div style="font-family:var(--font-label);font-size:10px;color:rgba(var(--color-on-surface-rgb),.40);white-space:nowrap;">${hora}</div>
            </div>
          </div>`;
        }).join('')
      : '<div style="padding:16px 0;color:rgba(var(--color-on-surface-rgb),.45);font-family:var(--font-label);font-size:12px;">Sem conversas registadas</div>';

    const html = `
      <div style="padding:32px 28px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
          <div>
            <div class="chip font-label">Lead</div>
            <div style="font-family:var(--font-headline);font-size:22px;font-weight:700;margin-top:8px;">${esc(lead.nome) || '—'}</div>
            <div style="font-family:var(--font-label);font-size:11px;color:rgba(var(--color-on-surface-rgb),.55);margin-top:4px;display:flex;align-items:center;gap:6px;">
              ${esc(tel)}
              ${waLink ? `
                <a href="${waLink}" target="_blank" style="color:#25d366;text-decoration:none;display:inline-flex;align-items:center;transition:transform 0.2s;line-height:1;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Abrir conversa no WhatsApp">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle;">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.882 1.452 5.432 0 9.851-4.417 9.855-9.848.002-2.63-1.018-5.101-2.87-6.956C16.61 1.948 14.137.95 11.512.95c-5.436 0-9.854 4.419-9.859 9.852-.001 1.81.488 3.578 1.42 5.161l-.988 3.606 3.692-.969zm10.74-5.328c-.294-.148-1.743-.86-2.012-.958-.267-.099-.463-.148-.657.148-.196.297-.753.958-.923 1.153-.17.195-.34.218-.634.07-.294-.148-1.243-.458-2.37-1.464-.877-.78-1.47-1.744-1.642-2.04-.17-.295-.018-.455.13-.602.132-.132.294-.34.442-.512.147-.171.196-.293.294-.49.099-.196.05-.369-.024-.518-.074-.148-.658-1.585-.902-2.174-.237-.57-.478-.492-.658-.501-.17-.008-.364-.01-.559-.01-.196 0-.514.074-.783.37-.268.295-1.026 1.008-1.026 2.457 0 1.45 1.053 2.848 1.2 3.045.148.196 2.074 3.167 5.024 4.446.702.304 1.25.486 1.677.622.705.224 1.346.19 1.854.114.565-.084 1.743-.711 1.99-1.396.248-.686.248-1.276.172-1.396-.074-.12-.272-.193-.566-.341z"/>
                  </svg>
                </a>
              ` : ''}
            </div>
          </div>
          <button onclick="window.closeSide()" style="background:none;border:none;cursor:pointer;color:var(--color-on-surface);opacity:.5;padding:4px;">
            <span class="material-symbols-outlined" style="font-size:20px;">close</span>
          </button>
        </div>
        <div style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${_statusBadge(_leadStatus(lead))}
          ${_isFrio(lead) ? '<span class="pill" style="background:rgba(var(--color-on-surface-rgb),.05);color:var(--color-error);border-color:var(--color-outline-variant);"><span class="dot" style="background:var(--color-error);"></span>frio</span>' : ''}
          <button id="btnConverterLead" class="seg-btn active" style="margin-left:auto;padding:6px 12px;font-size:10px;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;box-shadow:0 0 8px var(--color-highlight-shadow);cursor:pointer;border-radius:var(--radius-sm);display:inline-flex;align-items:center;gap:4px;">
            <span class="material-symbols-outlined" style="font-size:14px;">calendar_add_on</span> Agendar Consulta
          </button>
        </div>
        <div class="metric-label" style="margin-bottom:12px;">Timeline de conversas (${conversas.length})</div>
        <div>${timeline}</div>
      </div>`;
    window.openSide(html);

    const convBtn = document.getElementById('btnConverterLead');
    if (convBtn) {
      convBtn.addEventListener('click', () => {
        if (window.sysLogger) {
          window.sysLogger.info(`Clientes: Iniciada conversão de lead "${lead.nome}" em agendamento`, { leadId: lead.id });
        }
        window.closeSide();
        if (typeof window.goTo === 'function') {
          window.goTo('agenda');
        }
        setTimeout(() => {
          if (typeof window.openNewAppointmentModal === 'function') {
            window.openNewAppointmentModal(lead.id);
          }
        }, 150);
      });
    }
  }

  // ── BLOCO B: LÓGICA DE PACIENTES ───────────────────────────────────

  function _lastVisit(agendamentos) {
    if (!agendamentos || !agendamentos.length) return '—';
    const realizados = agendamentos.filter(a => a.status === 'realizado');
    const arr = realizados.length ? realizados : agendamentos;
    const sorted = [...arr].sort((a, b) => {
      const dA = a.data_hora ? new Date(a.data_hora).getTime() : 0;
      const dB = b.data_hora ? new Date(b.data_hora).getTime() : 0;
      const valA = isNaN(dA) ? 0 : dA;
      const valB = isNaN(dB) ? 0 : dB;
      return valB - valA;
    });
    if (!sorted[0] || !sorted[0].data_hora) return '—';
    if (typeof window.formatDate === 'function') return window.formatDate(sorted[0].data_hora);
    return new Date(sorted[0].data_hora).toLocaleDateString('pt-BR');
  }

  function _togglePatientsEmpty(show) {
    const empty = document.getElementById('patientsEmpty');
    const tbody = document.getElementById('patientsBody');
    if (!empty || !tbody) return;
    if (show) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
    }
  }

  function _applyPatientsSearch(query) {
    if (query && query.trim().length >= 2 && window.sysLogger) {
      window.sysLogger.info(`Clientes: Busca de pacientes executada com termo "${query}"`);
    }
    const q = (query || '').toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    const filtered = q
      ? _patientsData.filter(p =>
          (p.nome || '').toLowerCase().includes(q) ||
          (qDigits.length >= 2 && (p.telefone || '').replace(/\D/g, '').includes(qDigits))
        )
      : _patientsData;
    _renderPatientsRows(filtered);
  }

  function _wirePatientsSearch() {
    const input = document.getElementById('patientSearch');
    if (!input || input.dataset.wired) return;
    input.dataset.wired = '1';
    input.addEventListener('input', () => _applyPatientsSearch(input.value));
  }

  function _renderPatientsRows(rows) {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '';
      _togglePatientsEmpty(true);
      return;
    }
    _togglePatientsEmpty(false);

    const esc = window.escHtml || (s => String(s ?? ''));

    tbody.innerHTML = rows.map(p => {
      const nome = esc(p.nome) || '—';
      const tel  = (typeof window.maskPhone === 'function') ? window.maskPhone(p.telefone) : (p.telefone || '—');
      const origem = (typeof window.originBadge === 'function') ? window.originBadge(p.canal_origem) : (p.canal_origem || '—');
      const ultima = _lastVisit(p.agendamentos);
      const total  = (p.agendamentos || []).length;
      return `<tr data-id="${p.id}" style="cursor:pointer;">
        <td>${nome}</td>
        <td class="font-label">${esc(tel)}</td>
        <td>${origem}</td>
        <td class="font-label">${ultima}</td>
        <td class="font-label tabular-nums">${total}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const p = _patientsData.find(x => String(x.id) === tr.dataset.id);
        if (p) _openPatientDetail(p);
      });
    });
  }

  function _openPatientDetail(p) {
    if (window.sysLogger) {
      window.sysLogger.info(`Clientes: Prontuário do paciente "${p.nome}" visualizado`, { pacienteId: p.id });
    }
    const esc    = window.escHtml || (s => String(s ?? ''));
    const tel    = (typeof window.maskPhone === 'function') ? window.maskPhone(p.telefone) : (p.telefone || '—');
    const cleanPhone = (p.telefone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? (cleanPhone.startsWith('55') ? `https://wa.me/${cleanPhone}` : `https://wa.me/55${cleanPhone}`) : '';
    const origem = (typeof window.originBadge === 'function') ? window.originBadge(p.canal_origem) : (p.canal_origem || '—');
    const agendamentos = (p.agendamentos || []).sort((a, b) => {
      const dA = a.data_hora ? new Date(a.data_hora).getTime() : 0;
      const dB = b.data_hora ? new Date(b.data_hora).getTime() : 0;
      const valA = isNaN(dA) ? 0 : dA;
      const valB = isNaN(dB) ? 0 : dB;
      return valB - valA;
    });

    const historicoRows = agendamentos.length
      ? agendamentos.map(a => {
          const dataStr = (typeof window.formatDate === 'function')
            ? window.formatDate(a.data_hora)
            : new Date(a.data_hora).toLocaleDateString('pt-BR');
          const badge = (typeof window.renderStatusBadge === 'function')
            ? window.renderStatusBadge(a.status)
            : `<span class="pill">${esc(a.status)}</span>`;
          const medico = esc(a.medicos?.nome) || '—';
          const espec  = esc(a.especialidade) || '—';
          return `<div style="display:flex;align-items:center;justify-content:space-between;
                              padding:10px 0;border-bottom:1px solid var(--color-outline-variant);">
            <div>
              <div style="font-size:13px;">${dataStr} · ${medico}</div>
              <div style="font-family:var(--font-label);font-size:10px;color:rgba(var(--color-on-surface-rgb),.55);margin-top:2px;">${espec}</div>
            </div>
            <div>${badge}</div>
          </div>`;
        }).join('')
      : '<div style="padding:16px 0;color:rgba(var(--color-on-surface-rgb),.45);font-family:var(--font-label);font-size:12px;">Sem histórico registado</div>';

    const html = `
      <div style="padding:32px 28px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
          <div>
            <div class="chip font-label">Paciente</div>
            <div style="font-family:var(--font-headline);font-size:22px;font-weight:700;margin-top:8px;">${esc(p.nome) || '—'}</div>
          </div>
          <button onclick="window.closeSide()" style="background:none;border:none;cursor:pointer;color:var(--color-on-surface);opacity:.5;padding:4px;">
             <span class="material-symbols-outlined" style="font-size:20px;">close</span>
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;">
          <div>
            <div class="metric-label" style="margin-bottom:4px;">Telefone</div>
            <div style="font-size:13px;display:flex;align-items:center;gap:6px;">
              ${esc(tel)}
              ${waLink ? `
                <a href="${waLink}" target="_blank" style="color:#25d366;text-decoration:none;display:inline-flex;align-items:center;transition:transform 0.2s;line-height:1;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Abrir conversa no WhatsApp">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle;">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.882 1.452 5.432 0 9.851-4.417 9.855-9.848.002-2.63-1.018-5.101-2.87-6.956C16.61 1.948 14.137.95 11.512.95c-5.436 0-9.854 4.419-9.859 9.852-.001 1.81.488 3.578 1.42 5.161l-.988 3.606 3.692-.969zm10.74-5.328c-.294-.148-1.743-.86-2.012-.958-.267-.099-.463-.148-.657.148-.196.297-.753.958-.923 1.153-.17.195-.34.218-.634.07-.294-.148-1.243-.458-2.37-1.464-.877-.78-1.47-1.744-1.642-2.04-.17-.295-.018-.455.13-.602.132-.132.294-.34.442-.512.147-.171.196-.293.294-.49.099-.196.05-.369-.024-.518-.074-.148-.658-1.585-.902-2.174-.237-.57-.478-.492-.658-.501-.17-.008-.364-.01-.559-.01-.196 0-.514.074-.783.37-.268.295-1.026 1.008-1.026 2.457 0 1.45 1.053 2.848 1.2 3.045.148.196 2.074 3.167 5.024 4.446.702.304 1.25.486 1.677.622.705.224 1.346.19 1.854.114.565-.084 1.743-.711 1.99-1.396.248-.686.248-1.276.172-1.396-.074-.12-.272-.193-.566-.341z"/>
                  </svg>
                </a>
              ` : ''}
            </div>
          </div>
          <div><div class="metric-label" style="margin-bottom:4px;">Origem</div><div style="font-size:13px;">${origem}</div></div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Convênio</label>
            <input type="text" id="edit-pac-convenio" class="field-i" style="width:100%;padding:8px 10px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:12px;" value="${esc(p.convenio || 'particular')}">
          </div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Observações Clínicas</label>
            <textarea id="edit-pac-observacoes" class="field-i" style="width:100%;padding:8px 10px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:12px;height:70px;line-height:1.4;" placeholder="Alergias, observações...">${esc(p.observacoes || '')}</textarea>
          </div>
          <button id="btnSalvarEdicaoPaciente" class="seg-btn active" style="padding:10px;font-size:11px;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;box-shadow:0 0 8px var(--color-highlight-shadow);cursor:pointer;border-radius:var(--radius-sm);margin-top:6px;width:100%;">
            Salvar Alterações
          </button>
        </div>
        <div style="border-top:1px solid var(--color-outline-variant);padding-top:20px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div class="metric-label">Pacotes e Sessões</div>
            <button id="btnNovoPacote" class="seg-btn" style="margin-left:auto;padding:4px 8px;font-size:10px;height:22px;border-radius:4px;border:1px solid var(--color-primary);background:none;color:var(--color-primary);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px;">
              <span class="material-symbols-outlined" style="font-size:12px;">add</span> Novo Pacote
            </button>
          </div>
          
          <!-- Formulário inline oculto para cadastrar pacote -->
          <div id="form-novo-pacote-container" class="hidden" style="background:rgba(var(--color-on-surface-rgb),.02);border:1px solid var(--color-outline-variant);padding:12px;border-radius:8px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="font-size:10px;color:rgba(var(--color-on-surface-rgb),.6);margin-bottom:2px;display:block;">Procedimento / Tratamento</label>
              <input type="text" id="pacote-nome-input" class="field-i" placeholder="Ex: Depilação Laser Axila" style="width:100%;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:11px;">
            </div>
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <div style="flex:1;">
                <label style="font-size:10px;color:rgba(var(--color-on-surface-rgb),.6);margin-bottom:2px;display:block;">Sessões Contratadas</label>
                <input type="number" id="pacote-sessoes-input" class="field-i" value="5" min="1" style="width:100%;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:11px;">
              </div>
              <div style="display:flex;">
                <button id="btnSalvarPacote" class="seg-btn active" style="padding:6px 12px;height:30px;font-size:11px;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;border-radius:var(--radius-sm);cursor:pointer;">Salvar</button>
                <button id="btnCancelarPacote" class="seg-btn" style="padding:6px 10px;height:30px;font-size:11px;background:none;border:none;color:var(--color-on-surface);cursor:pointer;opacity:0.6;margin-left:4px;">Cancelar</button>
              </div>
            </div>
          </div>

          <div id="pacotesContainer" style="display:flex;flex-direction:column;gap:8px;">
            <div class="skeleton" style="height:32px;border-radius:6px;"></div>
          </div>
        </div>

        <div style="border-top:1px solid var(--color-outline-variant);padding-top:20px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div class="metric-label">Evolução Clínica (Antes e Depois)</div>
            <button id="btnNovaFoto" class="seg-btn" style="margin-left:auto;padding:4px 8px;font-size:10px;height:22px;border-radius:4px;border:1px solid var(--color-primary);background:none;color:var(--color-primary);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px;">
              <span class="material-symbols-outlined" style="font-size:12px;">add_a_photo</span> Adicionar Foto
            </button>
          </div>

          <!-- Formulário inline oculto para enviar foto -->
          <div id="form-nova-foto-container" class="hidden" style="background:rgba(var(--color-on-surface-rgb),.02);border:1px solid var(--color-outline-variant);padding:12px;border-radius:8px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="font-size:10px;color:rgba(var(--color-on-surface-rgb),.6);margin-bottom:2px;display:block;">Descrição da Foto</label>
              <input type="text" id="foto-titulo-input" class="field-i" placeholder="Ex: Botox - Antes (Frente)" style="width:100%;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:11px;">
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="flex:1;">
                <label style="font-size:10px;color:rgba(var(--color-on-surface-rgb),.6);margin-bottom:2px;display:block;">Arquivo de Imagem</label>
                <input type="file" id="foto-arquivo-input" accept="image/*" style="font-size:11px;color:var(--color-on-surface);width:100%;">
              </div>
              <div style="display:flex;">
                <button id="btnSalvarFoto" class="seg-btn active" style="padding:6px 12px;height:30px;font-size:11px;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;border-radius:var(--radius-sm);cursor:pointer;">Enviar</button>
                <button id="btnCancelarFoto" class="seg-btn" style="padding:6px 10px;height:30px;font-size:11px;background:none;border:none;color:var(--color-on-surface);cursor:pointer;opacity:0.6;margin-left:4px;">Cancelar</button>
              </div>
            </div>
          </div>

          <div id="fotosContainer" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">
            <div class="skeleton" style="height:80px;border-radius:6px;"></div>
            <div class="skeleton" style="height:80px;border-radius:6px;"></div>
          </div>
        </div>
        
        <div style="border-top:1px solid var(--color-outline-variant);padding-top:20px;">
          <div class="metric-label" style="margin-bottom:12px;">Histórico de consultas (${agendamentos.length})</div>
          ${historicoRows}
        </div>
      </div>`;

    window.openSide(html);

    // Carrega e renderiza pacotes e fotos de forma assíncrona
    _loadAndRenderPacotes(p.id);
    _loadAndRenderFotos(p.id);

    // Lógica para controle do formulário inline de fotos
    const btnNovaFoto = document.getElementById('btnNovaFoto');
    const formNovaFotoContainer = document.getElementById('form-nova-foto-container');
    const btnCancelarFoto = document.getElementById('btnCancelarFoto');
    const btnSalvarFoto = document.getElementById('btnSalvarFoto');
    const inputArquivoFoto = document.getElementById('foto-arquivo-input');

    if (btnNovaFoto && formNovaFotoContainer) {
      btnNovaFoto.addEventListener('click', () => {
        formNovaFotoContainer.classList.remove('hidden');
      });
    }

    if (btnCancelarFoto && formNovaFotoContainer) {
      btnCancelarFoto.addEventListener('click', () => {
        formNovaFotoContainer.classList.add('hidden');
        document.getElementById('foto-titulo-input').value = '';
        inputArquivoFoto.value = '';
      });
    }

    if (btnSalvarFoto && formNovaFotoContainer && inputArquivoFoto) {
      btnSalvarFoto.addEventListener('click', async () => {
        const titulo = document.getElementById('foto-titulo-input').value.trim();
        const file = inputArquivoFoto.files[0];

        if (!titulo) {
          alert('Por favor, informe uma descrição/título para a foto.');
          return;
        }
        if (!file) {
          alert('Por favor, selecione um arquivo de imagem.');
          return;
        }

        btnSalvarFoto.disabled = true;
        btnSalvarFoto.textContent = 'Enviando...';

        if (typeof window.insertFotoPaciente !== 'function') {
          console.error('[clientes] Função window.insertFotoPaciente não encontrada.');
          alert('Falha ao salvar imagem.');
          btnSalvarFoto.disabled = false;
          btnSalvarFoto.textContent = 'Enviar';
          return;
        }

        const _finalizarFoto = async () => {
          formNovaFotoContainer.classList.add('hidden');
          document.getElementById('foto-titulo-input').value = '';
          inputArquivoFoto.value = '';
          await _loadAndRenderFotos(p.id);
        };
        const _erroFoto = (err) => {
          console.error('[clientes] erro ao salvar foto:', err);
          alert('Falha ao salvar imagem.');
        };
        const _resetBtn = () => {
          btnSalvarFoto.disabled = false;
          btnSalvarFoto.textContent = 'Enviar';
        };

        const usarStorage = !!(window.APP_CONFIG && window.APP_CONFIG.FOTOS_STORAGE);
        if (usarStorage) {
          // Caminho novo: envia o File direto ao Storage (sem data URI).
          try {
            await window.insertFotoPaciente({ paciente_id: p.id, titulo, file });
            await _finalizarFoto();
          } catch (err) {
            _erroFoto(err);
          } finally {
            _resetBtn();
          }
        } else {
          // Caminho legado: data URI Base64 no banco.
          try {
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                await window.insertFotoPaciente({ paciente_id: p.id, titulo, url_foto: event.target.result });
                await _finalizarFoto();
              } catch (err) {
                _erroFoto(err);
              } finally {
                _resetBtn();
              }
            };
            reader.readAsDataURL(file);
          } catch (err) {
            console.error('[clientes] erro ao ler arquivo:', err);
            _resetBtn();
          }
        }
      });
    }

    // Lógica para controle do formulário inline de novo pacote
    const btnNovoPacote = document.getElementById('btnNovoPacote');
    const formNovoPacoteContainer = document.getElementById('form-novo-pacote-container');
    const btnCancelarPacote = document.getElementById('btnCancelarPacote');
    const btnSalvarPacote = document.getElementById('btnSalvarPacote');

    if (btnNovoPacote && formNovoPacoteContainer) {
      btnNovoPacote.addEventListener('click', () => {
        formNovoPacoteContainer.classList.remove('hidden');
      });
    }

    if (btnCancelarPacote && formNovoPacoteContainer) {
      btnCancelarPacote.addEventListener('click', () => {
        formNovoPacoteContainer.classList.add('hidden');
        document.getElementById('pacote-nome-input').value = '';
      });
    }

    if (btnSalvarPacote && formNovoPacoteContainer) {
      btnSalvarPacote.addEventListener('click', async () => {
        const nome_tratamento = document.getElementById('pacote-nome-input').value.trim();
        const sessoes_contratadas = parseInt(document.getElementById('pacote-sessoes-input').value, 10);

        if (!nome_tratamento) {
          alert('Por favor, informe o nome do tratamento.');
          return;
        }

        btnSalvarPacote.disabled = true;
        btnSalvarPacote.textContent = 'Gravando...';

        try {
          await window.insertPacoteTratamento({
            paciente_id: p.id,
            nome_tratamento,
            sessoes_contratadas,
            sessoes_realizadas: 0
          });
          formNovoPacoteContainer.classList.add('hidden');
          document.getElementById('pacote-nome-input').value = '';
          await _loadAndRenderPacotes(p.id);
        } catch (err) {
          console.error('[clientes] erro ao criar pacote:', err);
        } finally {
          btnSalvarPacote.disabled = false;
          btnSalvarPacote.textContent = 'Salvar';
        }
      });
    }

    const saveBtn = document.getElementById('btnSalvarEdicaoPaciente');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const convenio = document.getElementById('edit-pac-convenio').value.trim();
        const observacoes = document.getElementById('edit-pac-observacoes').value.trim();

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
          if (typeof window.updatePaciente !== 'function') {
            throw new Error('Função window.updatePaciente não encontrada.');
          }
          await window.updatePaciente(p.id, {
            convenio,
            observacoes
          });

          if (window.sysLogger) {
            window.sysLogger.info(`Dados do paciente ${p.nome} editados com sucesso.`);
          }

          window.closeSide();
          window.refreshCurrentTab();
        } catch (err) {
          console.error('[clientes] erro ao atualizar paciente:', err);
          if (window.sysLogger) {
            window.sysLogger.error(`Erro ao salvar alterações do paciente: ${err.message || String(err)}`);
          }
          let parent = saveBtn.parentNode;
          let errorBanner = parent.querySelector('.error-banner');
          if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.className = 'error-banner';
            errorBanner.style.cssText = 'margin-bottom:14px;';
            parent.insertBefore(errorBanner, parent.firstChild);
          }
          errorBanner.innerHTML = `<span class="material-symbols-outlined">error_outline</span><span>Erro ao salvar prontuário: ${window.escHtml(err.message || String(err))}</span>`;
          saveBtn.disabled = false;
          saveBtn.textContent = 'Salvar Alterações';
        }
      });
    }
  }

  async function _loadAndRenderPacotes(pacienteId) {
    const container = document.getElementById('pacotesContainer');
    if (!container) return;

    try {
      if (typeof window.fetchPacotesPaciente !== 'function') {
        throw new Error('Função window.fetchPacotesPaciente não encontrada.');
      }
      const pacotes = await window.fetchPacotesPaciente(pacienteId);
      
      if (!pacotes.length) {
        container.innerHTML = `<div style="padding:12px;text-align:center;font-size:11px;color:rgba(var(--color-on-surface-rgb),.45);font-family:var(--font-label);">Nenhum pacote ativo registrado</div>`;
        return;
      }

      const esc = window.escHtml || (s => String(s ?? ''));

      container.innerHTML = pacotes.map(pkg => {
        const realizado = pkg.sessoes_realizadas || 0;
        const contratado = pkg.sessoes_contratadas || 1;
        const pct = Math.min(100, Math.round((realizado / contratado) * 100));
        
        // Verifica se completou
        const completo = realizado >= contratado;
        const progressStyle = completo 
          ? 'background: linear-gradient(90deg, var(--color-primary) 0%, #ff85a2 100%); box-shadow: 0 0 8px var(--color-highlight-shadow);' 
          : 'background: var(--color-primary);';

        return `
          <div style="background:rgba(var(--color-on-surface-rgb),.02); border:1px solid var(--color-outline-variant); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:600; font-size:13px; color:var(--color-on-surface);">${esc(pkg.nome_tratamento)}</div>
                <div style="font-size:10px; color:rgba(var(--color-on-surface-rgb),.5); font-family:var(--font-label); margin-top:2px;">Adquirido em: ${new Date(pkg.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <button class="btn-session-dec seg-btn" data-id="${pkg.id}" data-current="${realizado}" style="padding:0; min-width:20px; height:20px; font-size:12px; cursor:pointer; background:none; border:1px solid var(--color-outline-variant); border-radius:4px; color:var(--color-on-surface); display:inline-flex; align-items:center; justify-content:center; opacity:0.6;" ${realizado <= 0 ? 'disabled' : ''}>
                  <span class="material-symbols-outlined" style="font-size:12px;">remove</span>
                </button>
                <span style="font-family:var(--font-label); font-weight:600; font-size:12px; min-width:32px; text-align:center;" class="tabular-nums">${realizado} / ${contratado}</span>
                <button class="btn-session-inc seg-btn active" data-id="${pkg.id}" data-current="${realizado}" data-total="${contratado}" style="padding:0; min-width:20px; height:20px; font-size:12px; cursor:pointer; background:var(--color-primary); border:none; border-radius:4px; color:var(--color-background); display:inline-flex; align-items:center; justify-content:center; font-weight:bold;" ${completo ? 'disabled' : ''}>
                  <span class="material-symbols-outlined" style="font-size:12px;">add</span>
                </button>
              </div>
            </div>
            
            <div style="width:100%; height:6px; background:rgba(var(--color-on-surface-rgb),.05); border-radius:3px; overflow:hidden; position:relative; border:1px solid rgba(var(--color-on-surface-rgb),.02);">
              <div style="position:absolute; top:0; left:0; height:100%; width:${pct}%; border-radius:3px; transition:width 0.4s cubic-bezier(0.4, 0, 0.2, 1); ${progressStyle}"></div>
            </div>
          </div>
        `;
      }).join('');

      // Adiciona eventos de clique nos botões de controle de sessão
      container.querySelectorAll('.btn-session-inc').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pkgId = btn.dataset.id;
          const current = parseInt(btn.dataset.current, 10);
          btn.disabled = true;
          try {
            await window.updatePacoteSessoes(pkgId, current + 1);
            await _loadAndRenderPacotes(pacienteId);
          } catch (err) {
            btn.disabled = false;
            console.error('[clientes] erro ao incrementar sessões:', err);
          }
        });
      });

      container.querySelectorAll('.btn-session-dec').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pkgId = btn.dataset.id;
          const current = parseInt(btn.dataset.current, 10);
          btn.disabled = true;
          try {
            await window.updatePacoteSessoes(pkgId, current - 1);
            await _loadAndRenderPacotes(pacienteId);
          } catch (err) {
            btn.disabled = false;
            console.error('[clientes] erro ao decrementar sessões:', err);
          }
        });
      });

    } catch (err) {
      console.error('[clientes] erro ao renderizar pacotes:', err);
      container.innerHTML = `<div style="padding:12px; text-align:center; font-size:11px; color:var(--color-error);"><span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle;">error</span> Erro ao carregar pacotes.</div>`;
    }
  }

  const FOTOS_BUCKET = 'pacientes-fotos';

  // Resolve a URL exibivel de uma foto: data-URI/URL absoluta (legado) usa direto;
  // qualquer outra coisa e tratada como path no Storage -> signed URL temporaria.
  async function _resolveFotoUrl(urlOrPath) {
    if (!urlOrPath) return '';
    if (/^data:/i.test(urlOrPath) || /^https?:\/\//i.test(urlOrPath)) return urlOrPath;
    try {
      const { data, error } = await window.supabase.storage
        .from(FOTOS_BUCKET).createSignedUrl(urlOrPath, 3600);
      if (error) throw error;
      return (data && data.signedUrl) || '';
    } catch (e) {
      console.error('[clientes] erro ao gerar signed URL da foto:', e);
      return '';
    }
  }

  async function _loadAndRenderFotos(pacienteId) {
    const container = document.getElementById('fotosContainer');
    if (!container) return;

    try {
      if (typeof window.fetchFotosPaciente !== 'function') {
        throw new Error('Função window.fetchFotosPaciente não encontrada.');
      }
      const fotos = await window.fetchFotosPaciente(pacienteId);

      if (!fotos.length) {
        container.style.display = 'block';
        container.innerHTML = `<div style="padding:16px;text-align:center;font-size:11px;color:rgba(var(--color-on-surface-rgb),.45);font-family:var(--font-label);border:1px dashed var(--color-outline-variant);border-radius:6px;">Nenhuma foto clínica registrada</div>`;
        return;
      }

      container.style.display = 'grid';
      const esc = window.escHtml || (s => String(s ?? ''));

      container.innerHTML = fotos.map((f, i) => {
        return `
          <div class="relative group" style="background:rgba(var(--color-on-surface-rgb),.02); border:1px solid var(--color-outline-variant); border-radius:6px; overflow:hidden; display:flex; flex-direction:column; gap:4px; padding:6px; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            <div style="width:100%; height:90px; border-radius:4px; overflow:hidden; background:#000; display:flex; align-items:center; justify-content:center; position:relative;">
              <img data-foto-idx="${i}" style="max-width:100%; max-height:100%; object-fit:cover;" title="Clique para ampliar">
              <button class="btn-deletar-foto" data-id="${f.id}" style="position:absolute; top:4px; right:4px; padding:2px; background:rgba(0,0,0,0.6); border:none; border-radius:4px; color:#ff6b6b; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;" title="Remover foto">
                <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
              </button>
            </div>
            <div style="font-weight:600; font-size:11px; color:var(--color-on-surface); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; padding:0 2px;" title="${esc(f.titulo)}">${esc(f.titulo)}</div>
            <div style="font-size:9px; color:rgba(var(--color-on-surface-rgb),.4); font-family:var(--font-label); padding:0 2px;">${new Date(f.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        `;
      }).join('');

      // Resolve as URLs e liga o clique sem interpolar URL crua em HTML (anti-XSS).
      const imgs = container.querySelectorAll('img[data-foto-idx]');
      for (const img of imgs) {
        const f = fotos[Number(img.dataset.fotoIdx)];
        if (!f) continue;
        const url = await _resolveFotoUrl(f.url_foto);
        if (url) img.src = url;            // propriedade, nunca string HTML
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => window.openImageFull(url, f.titulo));
      }

      // CSS rápido para exibir o botão de deletar foto no hover da imagem
      container.querySelectorAll('.relative').forEach(el => {
        el.addEventListener('mouseenter', () => {
          const btn = el.querySelector('.btn-deletar-foto');
          if (btn) btn.style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
          const btn = el.querySelector('.btn-deletar-foto');
          if (btn) btn.style.opacity = '0';
        });
      });

      // Adiciona o evento de exclusão
      container.querySelectorAll('.btn-deletar-foto').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const fotoId = btn.dataset.id;
          if (!confirm('Deseja realmente excluir esta foto clínica?')) return;
          btn.disabled = true;
          try {
            await window.deleteFotoPaciente(fotoId);
            await _loadAndRenderFotos(pacienteId);
          } catch (err) {
            btn.disabled = false;
            console.error('[clientes] erro ao deletar foto:', err);
          }
        });
      });

    } catch (err) {
      console.error('[clientes] erro ao carregar fotos:', err);
      container.style.display = 'block';
      container.innerHTML = `<div style="padding:12px; text-align:center; font-size:11px; color:var(--color-error);"><span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle;">error</span> Erro ao carregar fotos clínicas.</div>`;
    }
  }

  window.openImageFull = function(url, titulo) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; padding:20px; transition:opacity 0.25s; opacity:0;';
    // Header (titulo via textContent, nunca interpolado em HTML)
    const header = document.createElement('div');
    header.style.cssText = 'position:absolute; top:20px; right:20px; display:flex; gap:12px; align-items:center;';
    const tituloEl = document.createElement('span');
    tituloEl.style.cssText = 'font-family:var(--font-headline); font-weight:600; color:#fff; font-size:16px;';
    tituloEl.textContent = titulo || '';
    const btnClose = document.createElement('button');
    btnClose.id = 'btnCloseImgFull';
    btnClose.style.cssText = 'background:none; border:none; cursor:pointer; color:#fff; opacity:0.8; padding:6px; display:inline-flex;';
    btnClose.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px;">close</span>';
    header.appendChild(tituloEl);
    header.appendChild(btnClose);
    // Imagem (src via propriedade, nunca string HTML)
    const imgEl = document.createElement('img');
    imgEl.style.cssText = 'max-width:90%; max-height:80%; border-radius:8px; border:2px solid rgba(255,255,255,0.1); box-shadow:0 0 30px rgba(0,0,0,0.5); object-fit:contain;';
    if (url) imgEl.src = url;
    modal.appendChild(header);
    modal.appendChild(imgEl);
    document.body.appendChild(modal);
    setTimeout(() => { modal.style.opacity = '1'; }, 10);

    const close = () => {
      modal.style.opacity = '0';
      setTimeout(() => { modal.remove(); }, 250);
    };

    modal.addEventListener('click', close);
    modal.querySelector('img').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('btnCloseImgFull').addEventListener('click', close);
  };

  // ── SKELETONS & GERAL ──────────────────────────────────────────────

  function _showLeadsSkeletons() {
    const tbody = document.getElementById('leadsBody');
    if (!tbody) return;
    const cell = '<td><div class="skeleton" style="height:14px;border-radius:4px;"></div></td>';
    tbody.innerHTML = Array(7).fill(`<tr>${Array(5).fill(cell).join('')}</tr>`).join('');
  }

  function _showPatientsSkeletons() {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return;
    const cell = '<td><div class="skeleton" style="height:14px;border-radius:4px;"></div></td>';
    tbody.innerHTML = Array(8).fill(`<tr>${Array(5).fill(cell).join('')}</tr>`).join('');
  }

  // ── ORQUESTRADOR GLOBAL ────────────────────────────────────────────

  async function renderClientesPage() {
    if (_inFlight) return;
    _inFlight = true;
    
    try {
      _wireSubtabs();

      // 1. Renderiza sub-aba de Leads
      if (_activeSubtab === 'leads') {
        _showLeadsSkeletons();
        _wireLeadsFilters();
        
        try {
          const { leads, convertidosSet } = await window.fetchLeads();
          _leadsData = leads;
          _convertidosSet = convertidosSet;
          
          _renderLeadsFunnel(leads);
          _renderFollowups(leads);
          _renderLeadsRows(leads);
          _renderLeadsSupport();
          
          // Mantém filtro ativo se houver
          const activeFilter = document.querySelector('#leadsFilters .seg-btn.active');
          if (activeFilter && activeFilter.dataset.status !== 'todos') {
            _applyLeadsFilter(activeFilter.dataset.status);
          }
        } catch (err) {
          console.error('[clientes] render leads error:', err);
          if (window.sysLogger) window.sysLogger.error('Falha ao renderizar Leads na aba Clientes', err);
          const tbody = document.getElementById('leadsBody');
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:32px 0;">' +
              '<div class="error-banner"><span class="material-symbols-outlined">error_outline</span>' +
              ' <span>Erro ao carregar leads.</span>' +
              ' <button class="retry-btn" onclick="window.renderClientesPage()">Tentar novamente</button>' +
              ' </div></td></tr>';
          }
        }
      } 
      // 2. Renderiza sub-aba de Pacientes
      else {
        _showPatientsSkeletons();
        _togglePatientsEmpty(false);
        
        try {
          const data = await window.fetchPacientes();
          _patientsData = data;
          
          _renderPatientsRows(data);
          _wirePatientsSearch();
          _renderPatientsSupport();
          
          // Mantém busca ativa se houver
          const searchInput = document.getElementById('patientSearch');
          if (searchInput && searchInput.value) {
            _applyPatientsSearch(searchInput.value);
          }
        } catch (err) {
          console.error('[clientes] render patients error:', err);
          if (window.sysLogger) window.sysLogger.error('Falha ao renderizar Pacientes na aba Clientes', err);
          const tbody = document.getElementById('patientsBody');
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:32px 0;">' +
              '<div class="error-banner"><span class="material-symbols-outlined">error_outline</span>' +
              ' <span>Erro ao carregar prontuários de pacientes.</span>' +
              ' <button class="retry-btn" onclick="window.renderClientesPage()">Tentar novamente</button>' +
              ' </div></td></tr>';
          }
        }
      }
    } finally {
      _inFlight = false;
    }
  }

  // Expor globalmente
  window.renderClientesPage = renderClientesPage;

})();
