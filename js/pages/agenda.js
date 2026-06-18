/* js/pages/agenda.js — Aba Agenda
 * Depende de: window.fetchAgenda, window.formatTime, window.maskPhone,
 *             window.renderStatusBadge, window.originBadge,
 *             window.openSide, window.closeSide
 * Expõe: window.renderAgendaPage
 */
(function () {
  'use strict';

  let _all = [];
  let _inFlight = false;

  // ── Filtros locais ──────────────────────────────────────────────

  function _applyFilters() {
    const medicoActive = document.querySelector('#medicoFilters .seg-btn.active');
    const statusActive = document.querySelector('#statusFilters .seg-btn.active');
    const medico = medicoActive ? medicoActive.dataset.medico : 'todos';
    const status = statusActive ? statusActive.dataset.status : 'todos';

    if (window.sysLogger) {
      window.sysLogger.info(`Agenda: Filtrando slots por Médico: "${medico}", Status: "${status}".`);
    }

    let rows = _all;
    if (medico !== 'todos') rows = rows.filter(a => (a.medicos?.nome || '') === medico);
    if (status !== 'todos') rows = rows.filter(a => a.status === status);
    _renderRows(rows);
  }

  function _wireFilters(container) {
    container.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _applyFilters();
      });
    });
  }

  // ── Médico filters dinâmicos ────────────────────────────────────

  function _populateMedicoFilters(agendamentos) {
    const container = document.getElementById('medicoFilters');
    if (!container) return;
    const nomes = [...new Set(agendamentos.map(a => a.medicos?.nome).filter(Boolean))].sort();
    container.innerHTML =
      '<button class="seg-btn active" data-medico="todos">Todos</button>' +
      nomes.map(n => `<button class="seg-btn" data-medico="${window.escHtml(n)}">${window.escHtml(n)}</button>`).join('');
    _wireFilters(container);
  }

  // ── Ocupação ────────────────────────────────────────────────────

  function _renderOcupacao(agendamentos) {
    const ocupados = agendamentos.filter(a => a.status !== 'cancelado').length;
    const total = agendamentos.length;
    const pct = total ? Math.round((ocupados / total) * 100) : 0;
    const el = document.getElementById('ocupacaoText');
    if (el) el.textContent = `${ocupados}/${total} · ${pct}%`;
    const fill = document.querySelector('.occupancy-fill');
    if (fill) fill.style.width = pct + '%';
  }

  // ── Tabela ──────────────────────────────────────────────────────

  function _renderRows(rows) {
    const tbody = document.getElementById('agendaBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:32px 0;">' +
        '<div class="empty-state">' +
        '<span class="empty-icon grid place-items-center"><span class="material-symbols-outlined">calendar_today</span></span>' +
        '<div class="empty-title font-headline">Sem agendamentos</div>' +
        '<div class="empty-sub">Nenhum resultado para este filtro</div>' +
        '</div></td></tr>';
      return;
    }
    const esc = window.escHtml || (s => String(s ?? ''));
    tbody.innerHTML = rows.map(a => {
      const p = a.pacientes || {};
      const m = a.medicos || {};
      const hora = (typeof window.formatTime === 'function')
        ? window.formatTime(a.data_hora)
        : (a.data_hora ? a.data_hora.slice(11, 16) : '—');
      const badge = (typeof window.renderStatusBadge === 'function')
        ? window.renderStatusBadge(a.status)
        : `<span class="pill">${esc(a.status)}</span>`;
      const origem = (typeof window.originBadge === 'function')
        ? window.originBadge(p.canal_origem)
        : (p.canal_origem || '—');
      return `<tr data-id="${a.id}" style="cursor:pointer;">
        <td class="font-label tabular-nums">${esc(hora)}</td>
        <td>${esc(p.nome) || '—'}</td>
        <td>${esc(m.nome) || '—'}</td>
        <td>${badge}</td>
        <td>${origem}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const ag = _all.find(a => String(a.id) === tr.dataset.id);
        if (ag) _openDetail(ag);
      });
    });
  }

  // ── Side panel ──────────────────────────────────────────────────

  function _openDetail(ag) {
    const esc = window.escHtml || (s => String(s ?? ''));
    const p = ag.pacientes || {};
    const m = ag.medicos || {};
    const hora = (typeof window.formatTime === 'function')
      ? window.formatTime(ag.data_hora)
      : (ag.data_hora ? ag.data_hora.slice(11, 16) : '—');
    const data = ag.data_hora
      ? new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : '—';
    const tel = (typeof window.maskPhone === 'function') ? window.maskPhone(p.telefone) : (p.telefone || '—');
    const badge = (typeof window.renderStatusBadge === 'function')
      ? window.renderStatusBadge(ag.status)
      : `<span class="pill">${esc(ag.status)}</span>`;

    const html = `
      <div style="padding:32px 28px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
          <div>
            <div class="chip font-label">Agendamento</div>
            <div style="font-family:var(--font-headline);font-size:22px;font-weight:700;margin-top:8px;">${esc(p.nome) || '—'}</div>
            <div style="font-family:var(--font-label);font-size:11px;color:rgba(var(--color-on-surface-rgb),.55);margin-top:4px;">${esc(data)} · ${esc(hora)}</div>
          </div>
          <button onclick="window.closeSide()" style="background:none;border:none;cursor:pointer;color:var(--color-on-surface);opacity:.5;padding:4px;">
            <span class="material-symbols-outlined" style="font-size:20px;">close</span>
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div><div class="metric-label" style="margin-bottom:4px;">Médico</div><div style="font-size:13px;">${esc(m.nome) || '—'}</div></div>
          <div><div class="metric-label" style="margin-bottom:4px;">Especialidade</div><div style="font-size:13px;">${esc(ag.especialidade || m.especialidade) || '—'}</div></div>
          <div><div class="metric-label" style="margin-bottom:4px;">Telefone</div><div style="font-size:13px;">${esc(tel)}</div></div>
          <div>
            <label class="metric-label" style="margin-bottom:4px;display:block;">Status</label>
            <select id="edit-ag-status" class="field-i" style="width:100%;padding:8px 10px;border-radius:var(--radius-sm);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:12px;">
              <option value="agendado" ${ag.status === 'agendado' ? 'selected' : ''}>Agendado</option>
              <option value="confirmado" ${ag.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
              <option value="realizado" ${ag.status === 'realizado' ? 'selected' : ''}>Realizado</option>
              <option value="falta" ${ag.status === 'falta' ? 'selected' : ''}>Falta</option>
              <option value="cancelado" ${ag.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
          ${ag.criado_pelo_agente
            ? '<div class="chip font-label" style="color:var(--color-primary);width:fit-content;margin-top:4px;">Agendado via bot</div>'
            : ''}
          ${ag.observacoes
            ? `<div><div class="metric-label" style="margin-bottom:4px;">Observações</div><div style="font-size:13px;color:rgba(var(--color-on-surface-rgb),.70);line-height:1.4;">${esc(ag.observacoes)}</div></div>`
            : ''}
          <button id="btnSalvarStatusAgendamento" class="seg-btn active" style="padding:10px;font-size:11px;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;box-shadow:0 0 8px var(--color-highlight-shadow);cursor:pointer;border-radius:var(--radius-sm);margin-top:8px;width:100%;">
            Salvar Status
          </button>
        </div>
      </div>`;

    window.openSide(html);

    const saveBtn = document.getElementById('btnSalvarStatusAgendamento');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const newStatus = document.getElementById('edit-ag-status').value;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
          if (typeof window.updateAgendamentoStatus !== 'function') {
            throw new Error('Função window.updateAgendamentoStatus não encontrada.');
          }
          await window.updateAgendamentoStatus(ag.id, newStatus);

          if (window.sysLogger) {
            window.sysLogger.info(`Status do agendamento ${ag.id} atualizado para: ${newStatus}`);
          }

          window.closeSide();
          window.refreshCurrentTab();
        } catch (err) {
          console.error('[agenda] erro ao atualizar status do agendamento:', err);
          if (window.sysLogger) {
            window.sysLogger.error(`Erro ao atualizar status do agendamento: ${err.message || String(err)}`);
          }
          let parent = saveBtn.parentNode;
          let errorBanner = parent.querySelector('.error-banner');
          if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.className = 'error-banner';
            errorBanner.style.cssText = 'margin-bottom:14px;';
            parent.insertBefore(errorBanner, parent.firstChild);
          }
          errorBanner.innerHTML = `<span class="material-symbols-outlined">error_outline</span><span>Erro ao salvar status: ${window.escHtml(err.message || String(err))}</span>`;
          saveBtn.disabled = false;
          saveBtn.textContent = 'Salvar Status';
        }
      });
    }
  }

  // ── Skeletons ───────────────────────────────────────────────────

  function _showSkeletons() {
    const tbody = document.getElementById('agendaBody');
    if (!tbody) return;
    const cell = '<td><div class="skeleton" style="height:14px;border-radius:4px;"></div></td>';
    tbody.innerHTML = Array(6).fill(`<tr>${Array(5).fill(cell).join('')}</tr>`).join('');
  }

  // ── Error banner ────────────────────────────────────────────────

  function _showError(container) {
    container.innerHTML = '<tr><td colspan="5" style="padding:32px 0;">' +
      '<div class="error-banner"><span class="material-symbols-outlined">error_outline</span>' +
      ' <span>Erro ao carregar agenda.</span>' +
      ' <button class="retry-btn" onclick="window.renderAgendaPage()">Tentar novamente</button>' +
      ' </div></td></tr>';
  }

  // ── Orchestrator ─────────────────────────────────────────────────

  async function _openNewAppointmentModal(preSelectedPatientId) {
    const patientId = typeof preSelectedPatientId === 'string' ? preSelectedPatientId : null;
    window.openSide(`
      <div style="padding:32px 28px;">
        <div class="chip font-label" style="margin-bottom:8px;">Agenda</div>
        <div style="font-family:var(--font-headline);font-size:20px;font-weight:700;margin-bottom:20px;">Carregando dados...</div>
      </div>
    `);

    try {
      if (typeof window.fetchPacientes !== 'function' || typeof window.fetchMedicos !== 'function') {
        throw new Error('Funções de dados do Supabase indisponíveis.');
      }

      const [pacientes, medicos] = await Promise.all([
        window.fetchPacientes(),
        window.fetchMedicos()
      ]);

      const pacientesOptions = pacientes.map(p => {
        const pNome = window.escHtml ? window.escHtml(p.nome) : p.nome;
        const pTel = window.escHtml ? window.escHtml(window.maskPhone ? window.maskPhone(p.telefone) : p.telefone) : (window.maskPhone ? window.maskPhone(p.telefone) : p.telefone);
        const isSel = p.id === patientId ? 'selected' : '';
        return `<option value="${p.id}" ${isSel}>${pNome} (${pTel})</option>`;
      }).join('');

      const medicosOptions = medicos.map(m => 
        `<option value="${m.id}">${window.escHtml ? window.escHtml(m.nome) : m.nome} (${window.escHtml ? window.escHtml(m.especialidade) : m.especialidade})</option>`
      ).join('');

      const html = `
        <div style="padding:32px 28px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">
            <div>
              <div class="chip font-label">Agenda</div>
              <div style="font-family:var(--font-headline);font-size:22px;font-weight:700;margin-top:8px;">Novo Agendamento</div>
            </div>
            <button onclick="window.closeSide()" style="background:none;border:none;cursor:pointer;color:var(--color-on-surface);opacity:.5;padding:4px;">
              <span class="material-symbols-outlined" style="font-size:20px;">close</span>
            </button>
          </div>
          <form id="form-novo-agendamento" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Paciente</label>
              <select id="ag-paciente-id" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;">
                <option value="" disabled ${patientId ? '' : 'selected'}>Selecione o paciente...</option>
                ${pacientesOptions}
              </select>
            </div>
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Médico / Profissional</label>
              <select id="ag-medico-id" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;">
                <option value="" disabled selected>Selecione o profissional...</option>
                ${medicosOptions}
              </select>
            </div>
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Especialidade</label>
              <input type="text" id="ag-especialidade" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;" placeholder="Preenchido automaticamente ao selecionar médico">
            </div>
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Data e Hora</label>
              <input type="datetime-local" id="ag-data-hora" class="field-i" required style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;">
            </div>
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Status Inicial</label>
              <select id="ag-status" class="field-i" style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;">
                <option value="agendado" selected>Agendado</option>
                <option value="confirmado">Confirmado</option>
                <option value="realizado">Realizado</option>
              </select>
            </div>
            <div>
              <label class="metric-label" style="margin-bottom:4px;display:block;">Observações</label>
              <textarea id="ag-observacoes" class="field-i" style="width:100%;padding:10px;border-radius:var(--radius);background:rgba(var(--color-on-surface-rgb),.03);border:1px solid var(--color-outline-variant);color:var(--color-on-surface);font-size:13px;height:60px;" placeholder="Anotações e preferências de horário..."></textarea>
            </div>
            <button type="submit" class="seg-btn active" style="margin-top:8px;padding:12px;width:100%;background:var(--color-primary);color:var(--color-background);font-weight:600;border:none;box-shadow:0 0 12px var(--color-highlight-shadow);cursor:pointer;border-radius:var(--radius);">
              Confirmar Agendamento
            </button>
          </form>
        </div>`;

      window.openSide(html);

      // Listener para preencher especialidade automaticamente ao selecionar médico
      const medicoSelect = document.getElementById('ag-medico-id');
      const especInput = document.getElementById('ag-especialidade');
      if (medicoSelect && especInput) {
        medicoSelect.addEventListener('change', () => {
          const medId = medicoSelect.value;
          const med = medicos.find(m => String(m.id) === medId);
          if (med) {
            especInput.value = med.especialidade || '';
          }
        });
      }

      // Listener para envio do formulário
      const form = document.getElementById('form-novo-agendamento');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const paciente_id = document.getElementById('ag-paciente-id').value;
          const medico_id = document.getElementById('ag-medico-id').value;
          const especialidade = document.getElementById('ag-especialidade').value.trim();
          const data_hora = new Date(document.getElementById('ag-data-hora').value).toISOString();
          const status = document.getElementById('ag-status').value;
          const observacoes = document.getElementById('ag-observacoes').value.trim();

          const submitBtn = form.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          submitBtn.textContent = 'Gravando...';

          try {
            if (typeof window.insertAgendamento !== 'function') {
              throw new Error('Função window.insertAgendamento não encontrada.');
            }
            await window.insertAgendamento({
              paciente_id,
              medico_id,
              especialidade,
              data_hora,
              status,
              observacoes,
              criado_pelo_agente: false
            });

            if (window.sysLogger) {
              window.sysLogger.info(`Novo agendamento criado manualmente para o paciente ID: ${paciente_id}`);
            }

            window.closeSide();
            window.refreshCurrentTab();
          } catch (err) {
            console.error('[agenda] erro ao criar agendamento:', err);
            if (window.sysLogger) {
              window.sysLogger.error(`Erro ao criar agendamento: ${err.message || String(err)}`);
            }
            let errorBanner = form.querySelector('.error-banner');
            if (!errorBanner) {
              errorBanner = document.createElement('div');
              errorBanner.className = 'error-banner';
              errorBanner.style.cssText = 'margin-bottom:14px;';
              form.insertBefore(errorBanner, form.firstChild);
            }
            errorBanner.innerHTML = `<span class="material-symbols-outlined">error_outline</span><span>Erro ao criar agendamento: ${window.escHtml(err.message || String(err))}</span>`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar Agendamento';
          }
        });
      }

    } catch (err) {
      console.error('[agenda] erro ao preparar modal de agendamento:', err);
      window.openSide(`
        <div style="padding:32px 28px;">
          <div class="chip font-label" style="color:var(--color-error)">Erro</div>
          <div style="font-family:var(--font-headline);font-size:18px;font-weight:700;margin-top:8px;">Erro ao carregar dados</div>
          <div style="font-size:13px;color:rgba(var(--color-on-surface-rgb),.6);margin-top:8px;">Verifique a conexão de rede e tente novamente.</div>
        </div>
      `);
    }
  }

  let _currentAgendaDate = new Date();

  async function _renderAgendaPageForDate(date) {
    if (_inFlight) return;
    _inFlight = true;
    _currentAgendaDate = date;

    const dateStr = date.toLocaleDateString('pt-BR');
    if (window.sysLogger) {
      window.sysLogger.info(`Agenda: Solicitando agendamentos para a data: ${dateStr}`);
    }

    _showSkeletons();

    try {
      const data = await window.fetchAgenda(date);
      _all = data;
      _populateMedicoFilters(data);
      _renderOcupacao(data);
      _renderRows(data);

      if (window.sysLogger) {
        window.sysLogger.info(`Agenda: Agendamentos da data ${dateStr} carregados com sucesso. Slots ativos: ${data.length}`);
      }
    } catch (err) {
      console.error('[agenda] render error:', err);
      if (window.sysLogger) {
        window.sysLogger.error(`Agenda: Erro ao carregar agendamentos de ${dateStr}: ${err.message || String(err)}`);
      }
      const tbody = document.getElementById('agendaBody');
      if (tbody) _showError(tbody);
    } finally {
      _inFlight = false;
    }
  }

  async function renderAgendaPage() {
    // Wire status filter buttons
    const statusContainer = document.getElementById('statusFilters');
    if (statusContainer && !statusContainer.dataset.wired) { statusContainer.dataset.wired = '1'; _wireFilters(statusContainer); }

    // Injeta o seletor de data dinamicamente à direita dos filtros de status
    const filtersWrap = document.querySelector('.controls-card .flex.items-end.gap-5');
    if (filtersWrap && !document.getElementById('agenda-date-selector')) {
      const dateDiv = document.createElement('div');
      dateDiv.id = 'agenda-date-selector';
      dateDiv.innerHTML = `
        <div class="metric-label">Data</div>
        <input type="date" id="agenda-date-input" class="field-i" style="padding: 6px 12px; height: 32px; border-radius: var(--radius-sm); background: rgba(var(--color-on-surface-rgb),.03); border: 1px solid var(--color-outline-variant); color: var(--color-on-surface); font-family: var(--font-label); font-size: 11px; cursor: pointer; width: 130px;">
      `;
      filtersWrap.appendChild(dateDiv);

      const dateInput = document.getElementById('agenda-date-input');
      if (dateInput) {
        // Define data inicial do input com a data ativa formatada AAAA-MM-DD
        dateInput.value = _currentAgendaDate.toLocaleDateString('en-CA');
        dateInput.addEventListener('change', () => {
          const selected = new Date(dateInput.value + 'T00:00:00');
          _renderAgendaPageForDate(selected);
        });
      }
    }

    // Injeta botão "Novo Agendamento" ao lado do elemento de ocupação programaticamente
    const controlsWrap = document.querySelector('.controls-card .flex.items-end.justify-between');
    if (controlsWrap) {
      const occupancy = controlsWrap.querySelector('.occupancy');
      if (occupancy && !document.getElementById('btnNovoAgendamento')) {
        const btn = document.createElement('button');
        btn.id = 'btnNovoAgendamento';
        btn.className = 'seg-btn active';
        btn.style.cssText = 'font-size: 11px; padding: 8px 14px; height: 30px; background: var(--color-primary); color: var(--color-background); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: none; box-shadow: 0 0 10px var(--color-highlight-shadow); cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px;';
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 15px;">calendar_add_on</span> Novo Agendamento';
        btn.addEventListener('click', _openNewAppointmentModal);
        occupancy.parentNode.insertBefore(btn, occupancy);
      }
    }

    // Carrega a agenda para a data ativa
    await _renderAgendaPageForDate(_currentAgendaDate);
  }

  window.renderAgendaPage = renderAgendaPage;
  window.openNewAppointmentModal = _openNewAppointmentModal;
})();
