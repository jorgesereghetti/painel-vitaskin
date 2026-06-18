// js/logger.js
// Módulo de logs do sistema persistente no cliente — INFRA-LOG.
// Armazena logs estruturados no localStorage com rotação automática para controle de tamanho.
// Intercepta erros globais do navegador e rejeições de Promise não tratadas.

(function() {
  'use strict';

  const STORAGE_KEY = 'vitaskin_system_logs';
  const MAX_LOGS = 150;
  const ROTATE_REMOVE_COUNT = 30;

  // Lista de callbacks para atualizar a UI em tempo real
  const listeners = [];

  // Função interna para obter os logs existentes do localStorage de forma segura
  function _readLogs() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[logger] Falha ao ler logs do localStorage. Reiniciando.', e);
      return [];
    }
  }

  // Função interna para persistir os logs de forma segura e rodar logs se exceder o limite
  function _writeLogs(logs) {
    try {
      let finalLogs = logs;
      // Rotação: se passar do limite, remove os registros mais antigos
      if (finalLogs.length > MAX_LOGS) {
        finalLogs = finalLogs.slice(finalLogs.length - (MAX_LOGS - ROTATE_REMOVE_COUNT));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalLogs));
    } catch (e) {
      console.error('[logger] Erro ao gravar logs no localStorage:', e);
    }
  }

  // Adiciona um log no sistema
  function log(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level: String(level).toUpperCase(),
      message: String(message),
      meta: meta ? JSON.parse(JSON.stringify(meta)) : null // clonagem simples segura
    };

    // Imprime no console nativo com formatação agradável
    const color = level === 'error' ? 'color:#f28b82; font-weight:bold;' :
                  level === 'warn' ? 'color:#e7b15a; font-weight:bold;' :
                  'color:#a6b9a8;';
    console.log(`%c[SYSTEM_LOG] [${entry.level}] ${entry.message}`, color, meta || '');

    const logs = _readLogs();
    logs.push(entry);
    _writeLogs(logs);

    // Notifica os listeners (UI de tweaks atualiza em tempo real)
    listeners.forEach(fn => {
      try { fn(entry); } catch (e) { /* ignore */ }
    });

    // 🚀 Envio Silencioso de Erros Críticos para Webhook Remoto (Pilar 3, item 2)
    if (level === 'error' && window.APP_CONFIG && window.APP_CONFIG.LOG_WEBHOOK_URL) {
      fetch(window.APP_CONFIG.LOG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'vitaskin_painel_error',
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          meta: entry.meta,
          userAgent: navigator.userAgent
        })
      }).catch(err => {
        // Falha silenciosa para evitar loops recursivos de log de erros
        console.warn('[logger] Erro ao enviar log de auditoria ao webhook:', err.message);
      });
    }
  }

  const sysLogger = {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    
    // Retorna todos os logs
    getLogs: () => _readLogs(),
    
    // Limpa a base de logs
    clearLogs: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        listeners.forEach(fn => {
          try { fn({ type: 'clear' }); } catch (e) { /* ignore */ }
        });
        console.log('[logger] Histórico de logs limpo com sucesso.');
      } catch (e) {
        console.error('[logger] Falha ao limpar localStorage:', e);
      }
    },
    
    // Inscreve um callback para ser notificado sobre novos logs ou limpezas
    subscribe: (fn) => {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };

  // Expor globalmente
  window.sysLogger = sysLogger;

  // ── Interceptadores Globais de Erros ───────────────────────────────

  // Captura erros globais do navegador (exceções não tratadas no runtime)
  window.addEventListener('error', function(event) {
    // Ignora erros que não têm mensagem útil
    if (!event.message) return;
    
    const meta = {
      filename: event.filename || 'unknown',
      lineno: event.lineno || 0,
      colno: event.colno || 0
    };
    if (event.error && event.error.stack) {
      meta.stack = event.error.stack.split('\n').slice(0, 4).join('\n'); // pega primeiros 4 níveis da pilha
    }
    
    sysLogger.error(`JS_ERROR: ${event.message}`, meta);
  });

  // Captura rejeições de Promise não tratadas (ex: falhas de rede do fetch do Supabase)
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const meta = {};
    let msg = 'Unhandled Promise Rejection';

    if (reason) {
      if (reason instanceof Error) {
        msg = reason.message || reason.name;
        meta.stack = reason.stack ? reason.stack.split('\n').slice(0, 4).join('\n') : '';
      } else if (typeof reason === 'object') {
        msg = reason.message || JSON.stringify(reason);
        meta.details = reason;
      } else {
        msg = String(reason);
      }
    }

    sysLogger.error(`PROMISE_REJECT: ${msg}`, meta);
  });

  // Log de inicialização do sistema
  sysLogger.info('Sistema de auditoria de logs ativado.');

})();
