// js/data.js
// Camada de dados — INFRA-06 + Caching & Offline Fallback (Pilar 2).
// 5 funções fetch* expostas em window.* para uso pelas Phases 3-5.
// CRUD restrito: writes escopados (saas_clinicas_pacientes, saas_clinicas_agendamentos, saas_clinicas_pacotes_tratamentos, agente_somos_pacientes_fotos).
// PROIBIDO: SELECT/expor cpf, email, data_nascimento; service key (só publishable); RLS é a única proteção.
// Privacidade: NUNCA seleciona cpf, email ou data_nascimento de pacientes.

(function() {
  'use strict';

  if (!window.supabase || typeof window.supabase.from !== 'function') {
    const msg = '[data] window.supabase não está pronto. js/supabase.js precisa carregar antes.';
    console.error(msg);
    if (window.sysLogger) window.sysLogger.error(msg);
  }

  // === 🚀 Camada de Cache Local & Resiliência (Pilar 2) ===
  const _cache = {};
  const CACHE_TTL_MS = 30000; // 30 segundos de cache na memória

  // Limpa o cache de dados (chamado pelo botão de atualizar do cabeçalho)
  window.clearDataCache = function() {
    for (const key in _cache) {
      delete _cache[key];
    }
    console.log('[data] Cache local de consultas invalidado.');
    if (window.sysLogger) window.sysLogger.info('Cache local de dados limpo pelo usuário.');
  };

  // Função auxiliar para envelopar buscas com cache em memória e persistência de sessão (Offline Fallback)
  async function withCache(cacheKey, fetchFn) {
    const agora = Date.now();

    // 1. Tenta ler do cache em memória se ainda for válido (TTL)
    if (_cache[cacheKey] && (agora - _cache[cacheKey].timestamp < CACHE_TTL_MS)) {
      console.log(`[data] Cache em memória recuperado para: ${cacheKey}`);
      return _cache[cacheKey].data;
    }

    // 2. Tenta recuperar do sessionStorage para suporte Offline / Carregamento Instantâneo
    let fallbackData = null;
    try {
      const stored = sessionStorage.getItem('vitaskin_cache_' + cacheKey);
      if (stored) {
        fallbackData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[data] Falha ao ler do sessionStorage:', e);
    }

    try {
      // 3. Faz busca fresca no Supabase
      console.log(`[data] Buscando dados novos no Supabase para: ${cacheKey}`);
      const freshData = await fetchFn();

      // Salva no cache em memória
      _cache[cacheKey] = {
        data: freshData,
        timestamp: agora
      };

      // Salva no sessionStorage para inicialização instantânea no próximo reload
      try {
        sessionStorage.setItem('vitaskin_cache_' + cacheKey, JSON.stringify(freshData));
      } catch (e) {
        // ignora se atingir limite de armazenamento
      }

      return freshData;
    } catch (err) {
      console.error(`[data] Falha ao obter dados frescos para ${cacheKey}:`, err);
      
      // Se a rede falhar e tivermos dados anteriores salvos, agimos com resiliência!
      if (fallbackData) {
        console.warn(`[data] Usando fallback offline do sessionStorage para: ${cacheKey}`);
        if (window.sysLogger) {
          window.sysLogger.warn(`Usando cache offline resiliente para '${cacheKey}' devido a erro de rede.`, { error: err.message });
        }
        return fallbackData;
      }
      throw err;
    }
  }

  // Listas de colunas — concentradas em constantes para reuso.
  const COLS_PACIENTE = 'id, nome, telefone, canal_origem, convenio, observacoes, created_at, updated_at';
  const COLS_PACIENTE_LEAD = 'id, nome, telefone, canal_origem, created_at';
  const COLS_AGENDAMENTO = 'id, paciente_id, medico_id, especialidade, data_hora, status, lembrete_enviado, criado_pelo_agente, observacoes, created_at';
  const COLS_MEDICO = 'id, nome, especialidade';
  const COLS_FOLLOWUP = 'tentativa, status, ultimo_envio';
  const COLS_CONVERSA_LEAD = 'intencao, timestamp, direcao';

  // ---------------------------------------------------------------
  // fetchDashboard()
  // Retorna { agendamentosHoje, leadsWeek, taxaConversao, showRate,
  //           porSemana, porEspec, funil:{leads,agendados,confirmados,realizados},
  //           fuPendentes }
  // Tudo agrupado/agregado no JS (constraint do projeto).
  // ---------------------------------------------------------------
  async function fetchDashboard() {
    return withCache('dashboard', async () => {
      const sb = window.supabase;
      const inicio = new Date(); inicio.setHours(0,0,0,0);
      const fim    = new Date(); fim.setHours(23,59,59,999);
      const seteDias      = new Date(Date.now() -  7 * 86400000);
      const seisSemanasAtras = new Date(Date.now() - 42 * 86400000);

      // Batch 1 — queries totalmente independentes: disparo em paralelo.
      const [
        { count: agendamentosHoje },
        { count: leadsWeek },
        { count: totalPac },
        { data:  pacComAgend },
        { count: realizadosCount },
        { count: confirmadosCount },
        { count: faltasCount },
        { data:  porSemana },
        { data:  porEspec },
        { count: leadsTotal },
        { count: agendadosCount },
        { data:  fuPendentes },
      ] = await Promise.all([
        // 1. Agendamentos hoje — exclui cancelados.
        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .gte('data_hora', inicio.toISOString())
          .lte('data_hora', fim.toISOString())
          .neq('status', 'cancelado'),

        // 2. Novos leads — últimos 7 dias.
        sb.from('saas_clinicas_pacientes')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', seteDias.toISOString()),

        // 3a. Total de pacientes (para taxa de conversão).
        sb.from('saas_clinicas_pacientes')
          .select('id', { count: 'exact', head: true }),

        // 3b. Pacientes com agendamento (para taxa de conversão).
        sb.from('saas_clinicas_agendamentos')
          .select('paciente_id'),

        // 4a. Contagem de realizados (show rate).
        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'realizado'),

        // 4b. Contagem de confirmados (show rate).
        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'confirmado'),

        // 4c. Contagem de faltas (show rate).
        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'falta'),

        // 5. Agendamentos por semana — últimas 6 semanas.
        sb.from('saas_clinicas_agendamentos')
          .select('data_hora, status')
          .gte('data_hora', seisSemanasAtras.toISOString())
          .neq('status', 'cancelado'),

        // 6. Distribuição por especialidade.
        sb.from('saas_clinicas_agendamentos')
          .select('especialidade')
          .neq('status', 'cancelado'),

        // 7a. Total pacientes para o funil (mesmo valor de 3a, query dedicada para legibilidade).
        sb.from('saas_clinicas_pacientes')
          .select('id', { count: 'exact', head: true }),

        // 7b. Agendados (funil).
        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'agendado'),

        // 8. Follow-ups pendentes. (Mockado/Desativado pois follow_up não faz parte do projeto)
        Promise.resolve({ data: [] }),
      ]);

      // Derivações JS (sem round-trip extra).
      const unicos = new Set((pacComAgend || []).map(r => r.paciente_id)).size;
      const taxaConversao = totalPac ? ((unicos / totalPac) * 100).toFixed(1) : '0';
      const denomShow = (realizadosCount || 0) + (confirmadosCount || 0) + (faltasCount || 0);
      const showRate  = denomShow ? (((realizadosCount || 0) / denomShow) * 100).toFixed(1) : '0';

      return {
        agendamentosHoje: agendamentosHoje || 0,
        leadsWeek:        leadsWeek || 0,
        taxaConversao,
        showRate,
        porSemana:  porSemana  || [],
        porEspec:   porEspec   || [],
        funil: {
          leads:       leadsTotal       || 0,
          agendados:   agendadosCount   || 0,
          confirmados: confirmadosCount || 0,
          realizados:  realizadosCount  || 0,
        },
        fuPendentes: fuPendentes || [],
      };
    });
  }
  window.fetchDashboard = fetchDashboard;

  // ---------------------------------------------------------------
  // fetchAgenda(date)
  // Retorna array de agendamentos do dia, com paciente e médico embutidos.
  // 'date' é Date — usa início/fim do dia local.
  // ---------------------------------------------------------------
  async function fetchAgenda(date) {
    const d = date instanceof Date ? date : new Date(date);
    const dStr = d.toLocaleDateString('en-CA'); // Formato AAAA-MM-DD local seguro
    
    return withCache(`agenda_${dStr}`, async () => {
      const sb = window.supabase;
      const diaInicio = new Date(d); diaInicio.setHours(0,0,0,0);
      const diaFim    = new Date(d); diaFim.setHours(23,59,59,999);

      const { data, error } = await sb
        .from('saas_clinicas_agendamentos')
        .select(`
          id, data_hora, status, especialidade, criado_pelo_agente, observacoes,
          pacientes:saas_clinicas_pacientes ( id, nome, telefone, canal_origem ),
          medicos:saas_clinicas_medicos   ( id, nome, especialidade )
        `)
        .gte('data_hora', diaInicio.toISOString())
        .lte('data_hora', diaFim.toISOString())
        .order('data_hora', { ascending: true });

      if (error) {
        console.error('[data] fetchAgenda error:', error);
        if (window.sysLogger) window.sysLogger.error('Erro na query fetchAgenda', { error: error.message || String(error), details: error });
        throw error;
      }
      return data || [];
    });
  }
  window.fetchAgenda = fetchAgenda;

  // ---------------------------------------------------------------
  // fetchLeads()
  // Retorna { leads: array, convertidosSet: Set<paciente_id> }.
  // Cada lead inclui follow_ups[] e conversas[].
  // convertidosSet: ids de pacientes com agendamento status='realizado'.
  // ---------------------------------------------------------------
  async function fetchLeads() {
    return withCache('leads', async () => {
      const sb = window.supabase;

      const { data: leads, error } = await sb
        .from('saas_clinicas_pacientes')
        .select(`
          id, nome, telefone, canal_origem, created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[data] fetchLeads error:', error);
        if (window.sysLogger) window.sysLogger.error('Erro na query fetchLeads (pacientes)', { error: error.message || String(error), details: error });
        throw error;
      }

      if (leads) {
        leads.forEach(lead => {
          lead.follow_ups = [];
          lead.conversas = [];
        });
      }

      try {
        const { data: convertidosData, error: errorConvertidos } = await sb
          .from('saas_clinicas_agendamentos')
          .select('paciente_id')
          .eq('status', 'realizado');
        
        if (errorConvertidos) {
          console.error('[data] fetchLeads convertidos error:', errorConvertidos);
          if (window.sysLogger) window.sysLogger.warn('Erro ao buscar convertidos em fetchLeads', errorConvertidos);
        }
        
        const convertidosSet = new Set((convertidosData || []).map(r => r.paciente_id));
        return { leads: leads || [], convertidosSet };
      } catch (e) {
        if (window.sysLogger) window.sysLogger.error('Exceção ao processar convertidos em fetchLeads', { error: e.message || String(e) });
        return { leads: leads || [], convertidosSet: new Set() };
      }
    });
  }
  window.fetchLeads = fetchLeads;

  // ---------------------------------------------------------------
  // fetchAgente()
  // Retorna { msgsHoje, cadastrosBot, agendBot, intencoes, logConv }.
  // ---------------------------------------------------------------
  async function fetchAgente() {
    return withCache('agente', async () => {
      const sb = window.supabase;
      const inicio = new Date(); inicio.setHours(0,0,0,0);
      const fim    = new Date(); fim.setHours(23,59,59,999);
      const seteDiasAtras = new Date(Date.now() - 7 * 86400000);

      const [
        { count: msgsHoje },
        { count: cadastrosBot },
        { count: agendBot },
        { data: intencoes },
        { data: logConv },
      ] = await Promise.all([
        Promise.resolve({ count: 0 }), // msgsHoje (Mockado/Desativado pois agente_clinica_conversas não faz parte do projeto)

        // cadastrosBot — canal whatsapp nos últimos 7 dias (janela coerente com o label da UI).
        sb.from('saas_clinicas_pacientes')
          .select('id', { count: 'exact', head: true })
          .eq('canal_origem', 'whatsapp')
          .gte('created_at', seteDiasAtras.toISOString()),

        sb.from('saas_clinicas_agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('criado_pelo_agente', true)
          .gte('created_at', seteDiasAtras.toISOString()),

        Promise.resolve({ data: [] }), // intencoes (Mockado/Desativado)
        Promise.resolve({ data: [] }), // logConv (Mockado/Desativado)
      ]);

      return {
        msgsHoje:     msgsHoje    || 0,
        cadastrosBot: cadastrosBot || 0,
        agendBot:     agendBot    || 0,
        intencoes:    intencoes   || [],
        logConv:      logConv     || [],
      };
    });
  }
  window.fetchAgente = fetchAgente;

  // ---------------------------------------------------------------
  // fetchPacientes()
  // Retorna array de pacientes com agendamentos embutidos (cada um com médico).
  // NUNCA seleciona cpf, email, data_nascimento.
  // ---------------------------------------------------------------
  async function fetchPacientes() {
    return withCache('pacientes', async () => {
      const sb = window.supabase;
      const { data, error } = await sb
        .from('saas_clinicas_pacientes')
        .select(`
          id, nome, telefone, canal_origem, convenio, created_at,
          agendamentos:saas_clinicas_agendamentos ( id, data_hora, status, especialidade,
                         medicos:saas_clinicas_medicos ( nome ) )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[data] fetchPacientes error:', error);
        if (window.sysLogger) window.sysLogger.error('Erro na query fetchPacientes', { error: error.message || String(error), details: error });
        throw error;
      }
      return data || [];
    });
  }
  window.fetchPacientes = fetchPacientes;

  // ---------------------------------------------------------------
  // fetchMedicos()
  // Retorna a lista de médicos cadastrados
  // ---------------------------------------------------------------
  async function fetchMedicos() {
    return withCache('medicos', async () => {
      const sb = window.supabase;
      const { data, error } = await sb
        .from('saas_clinicas_medicos')
        .select('id, nome, especialidade, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      if (error) {
        console.error('[data] fetchMedicos error:', error);
        throw error;
      }
      return data || [];
    });
  }
  window.fetchMedicos = fetchMedicos;

  // ---------------------------------------------------------------
  // insertPaciente(paciente)
  // Insere um novo paciente no Supabase.
  // ---------------------------------------------------------------
  async function insertPaciente(paciente) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Iniciando cadastro manual de paciente "${paciente.nome}"`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_pacientes')
      .insert([paciente])
      .select('id');
    if (error) {
      console.error('[data] insertPaciente error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao cadastrar paciente "${paciente.nome}": ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Paciente "${paciente.nome}" cadastrado com sucesso.`);
    }
    // Invalida cache de pacientes e leads
    window.clearDataCache();
    return data;
  }
  window.insertPaciente = insertPaciente;

  // ---------------------------------------------------------------
  // updatePaciente(id, dados)
  // Atualiza dados de um paciente existente.
  // ---------------------------------------------------------------
  async function updatePaciente(id, dados) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Iniciando atualização do paciente (ID: ${id})`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_pacientes')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('[data] updatePaciente error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao atualizar paciente (ID: ${id}): ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Paciente (ID: ${id}) atualizado com sucesso.`);
    }
    // Invalida cache
    window.clearDataCache();
    return data;
  }
  window.updatePaciente = updatePaciente;

  // ---------------------------------------------------------------
  // insertAgendamento(agendamento)
  // Insere um novo agendamento no Supabase.
  // ---------------------------------------------------------------
  async function insertAgendamento(agendamento) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Iniciando cadastro de novo agendamento para o Paciente ID: ${agendamento.paciente_id}`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_agendamentos')
      .insert([agendamento])
      .select();
    if (error) {
      console.error('[data] insertAgendamento error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao cadastrar agendamento: ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Novo agendamento para o Paciente ID: ${agendamento.paciente_id} cadastrado com sucesso.`);
    }
    // Invalida cache de agendamentos e dashboard
    window.clearDataCache();
    return data;
  }
  window.insertAgendamento = insertAgendamento;

  // ---------------------------------------------------------------
  // updateAgendamentoStatus(id, status)
  // Atualiza apenas o status de um agendamento.
  // ---------------------------------------------------------------
  async function updateAgendamentoStatus(id, status) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Iniciando alteração de status do agendamento (ID: ${id}) para "${status}"`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_agendamentos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('[data] updateAgendamentoStatus error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao atualizar status do agendamento (ID: ${id}): ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Status do agendamento (ID: ${id}) alterado para "${status}" com sucesso.`);
    }
    // Invalida cache
    window.clearDataCache();
    return data;
  }
  window.updateAgendamentoStatus = updateAgendamentoStatus;

  // ---------------------------------------------------------------
  // fetchPacotesPaciente(pacienteId)
  // Retorna a lista de pacotes de tratamento de um paciente.
  // ---------------------------------------------------------------
  async function fetchPacotesPaciente(pacienteId) {
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_pacotes_tratamentos')
      .select('id, paciente_id, nome_tratamento, sessoes_contratadas, sessoes_realizadas, observacoes, created_at')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[data] fetchPacotesPaciente error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao buscar pacotes do paciente (ID: ${pacienteId}): ${error.message || String(error)}`);
      }
      return [];
    }
    return data || [];
  }
  window.fetchPacotesPaciente = fetchPacotesPaciente;

  // ---------------------------------------------------------------
  // insertPacoteTratamento(pacote)
  // Cadastra um novo pacote de tratamento para um paciente.
  // ---------------------------------------------------------------
  async function insertPacoteTratamento(pacote) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Iniciando cadastro de pacote "${pacote.nome_tratamento}"`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_pacotes_tratamentos')
      .insert([pacote])
      .select();
    if (error) {
      console.error('[data] insertPacoteTratamento error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao cadastrar pacote "${pacote.nome_tratamento}": ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Paciente (ID: ${pacote.paciente_id}) adquiriu pacote "${pacote.nome_tratamento}" com sucesso.`);
    }
    // Invalida cache
    window.clearDataCache();
    return data;
  }
  window.insertPacoteTratamento = insertPacoteTratamento;

  // ---------------------------------------------------------------
  // updatePacoteSessoes(id, sessoesRealizadas)
  // Atualiza a contagem de sessões realizadas de um pacote.
  // ---------------------------------------------------------------
  async function updatePacoteSessoes(id, sessoesRealizadas) {
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Atualizando sessões de pacote (ID: ${id}) para ${sessoesRealizadas}`);
    }
    const sb = window.supabase;
    const { data, error } = await sb
      .from('saas_clinicas_pacotes_tratamentos')
      .update({ sessoes_realizadas: sessoesRealizadas, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('[data] updatePacoteSessoes error:', error);
      if (window.sysLogger) {
        window.sysLogger.error(`Supabase DB: Erro ao atualizar sessões do pacote (ID: ${id}): ${error.message || String(error)}`);
      }
      throw error;
    }
    if (window.sysLogger) {
      window.sysLogger.info(`Supabase DB: Sessões do pacote (ID: ${id}) atualizadas para ${sessoesRealizadas} com sucesso.`);
    }
    // Invalida cache
    window.clearDataCache();
    return data;
  }
  window.updatePacoteSessoes = updatePacoteSessoes;

  // ---------------------------------------------------------------
  // fetchFotosPaciente(pacienteId)
  // Retorna a lista de fotos de evolução clínica (Antes e Depois) de um paciente. (Desativado/Mockado)
  // ---------------------------------------------------------------
  async function fetchFotosPaciente(pacienteId) {
    return [];
  }
  window.fetchFotosPaciente = fetchFotosPaciente;

  // ---------------------------------------------------------------
  // insertFotoPaciente(foto)
  // Insere uma nova foto de evolução clínica para o paciente. (Desativado/Mockado)
  // ---------------------------------------------------------------
  const FOTOS_BUCKET = 'pacientes-fotos';

  async function insertFotoPaciente(foto) {
    if (window.sysLogger) {
      window.sysLogger.info(`Upload de foto desativado (tabela agente_somos_pacientes_fotos não faz parte do projeto).`);
    }
    return [];
  }
  window.insertFotoPaciente = insertFotoPaciente;

  // ---------------------------------------------------------------
  // deleteFotoPaciente(id)
  // Remove uma foto de evolução clínica do paciente. (Desativado/Mockado)
  // ---------------------------------------------------------------
  async function deleteFotoPaciente(id) {
    if (window.sysLogger) {
      window.sysLogger.info(`Remoção de foto desativada (tabela agente_somos_pacientes_fotos não faz parte do projeto).`);
    }
    return [];
  }
  window.deleteFotoPaciente = deleteFotoPaciente;

  // ---------------------------------------------------------------
  // migrarFotosParaStorage()  — UTILITÁRIO ONE-TIME (rodar no console) (Desativado/Mockado)
  // ---------------------------------------------------------------
  async function migrarFotosParaStorage() {
    console.log('[migracao] Desativada (tabela agente_somos_pacientes_fotos não faz parte do projeto).');
    return { migradas: 0, puladas: 0, erros: 0 };
  }
  window.migrarFotosParaStorage = migrarFotosParaStorage;

})();
