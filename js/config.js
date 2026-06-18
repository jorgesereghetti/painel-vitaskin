// js/config.js
// Configuração estática do painel — INFRA-01.
// As chaves reais ficam em js/config.local.js (gitignored).
// Este ficheiro lê de window.APP_CONFIG_LOCAL (carregado antes) e aplica
// fallbacks vazios com erro claro se o ficheiro local estiver ausente.
// CRUD restrito no Supabase: writes escopados em saas_clinicas_pacientes, saas_clinicas_agendamentos,
// saas_clinicas_pacotes_tratamentos e agente_somos_pacientes_fotos. PROIBIDO: SELECT/expor cpf, email ou
// data_nascimento; service key (apenas publishable key); RLS é a única proteção.

(function () {
  const local = window.APP_CONFIG_LOCAL || {};

  if (!local.SUPABASE_URL || !local.SUPABASE_PUBLISHABLE_KEY) {
    console.error(
      '[config] ⚠️  js/config.local.js não encontrado ou incompleto.\n' +
      'Copie js/config.example.js para js/config.local.js e preencha as chaves.'
    );
  }

  window.APP_CONFIG = {
    SUPABASE_URL:             local.SUPABASE_URL             || '',
    SUPABASE_PUBLISHABLE_KEY: local.SUPABASE_PUBLISHABLE_KEY || '',
    LOG_WEBHOOK_URL:          local.LOG_WEBHOOK_URL          || '',
    // Fotos clínicas via Supabase Storage (signed URL) em vez de Base64 no DB.
    // Default OFF: só ativar após criar o bucket 'pacientes-fotos' e migrar (trilha B).
    FOTOS_STORAGE:            !!local.FOTOS_STORAGE,
  };
})();


// Metadados de cada aba — alimenta o header (#tabNum, #tabTitle, #tabSub) via router.goTo().
window.TAB_META = {
  dashboard: {
    num:   '01',
    title: 'Dashboard',
    sub:   'Métricas em tempo real de agendamentos, leads captados e performance do bot.',
  },
  agenda: {
    num:   '02',
    title: 'Agenda do dia',
    sub:   'Consultas confirmadas, ocupação por médico e detalhes de cada slot.',
  },
  clientes: {
    num:   '03',
    title: 'Base de clientes',
    sub:   'Funil de leads ativos e histórico completo de prontuários de pacientes.',
  },
  agente: {
    num:   '04',
    title: 'Agente virtual',
    sub:   'Intenções detectadas e logs das conversações em tempo real.',
  },
  logs: {
    num:   '05',
    title: 'Logs de Auditoria',
    sub:   'Registro de atividades do sistema, carregamento de módulos e auditoria de segurança.',
  },
};

// Cores de status semântico — espelham os tokens CSS de css/variables.css.
// Fonte: SPEC.md "Status semânticos" linhas 65-71.
window.STATUS_COLORS = {
  agendado:   'var(--st-agendado)',
  confirmado: 'var(--st-confirmado)',
  cancelado:  'var(--st-cancelado)',
  realizado:  'var(--st-realizado)',
  reagendado: '#7ad6ff',
  falta:      'var(--st-cancelado)',
};

// Cores de intenção do agente — espelham --intent-* de css/variables.css.
// Fonte: SPEC.md "Intenções" linhas 73-80 + Phase 01 D-09 (--intent-reagendamento).
window.INTENT_COLORS = {
  agendamento:    'var(--intent-agendamento)',
  duvida:         'var(--intent-duvida)',
  cadastro:       'var(--intent-cadastro)',
  cancelamento:   'var(--intent-cancelamento)',
  urgencia:       'var(--intent-urgencia)',
  fora_do_escopo: 'var(--intent-fora-do-escopo)',
  reagendamento:  'var(--intent-reagendamento)',
};
