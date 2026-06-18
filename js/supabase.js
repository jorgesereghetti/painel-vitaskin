// js/supabase.js
// Inicialização do cliente Supabase + smoke test — INFRA-02.
// CRUD restrito: writes escopados (saas_clinicas_pacientes, saas_clinicas_agendamentos, saas_clinicas_pacotes_tratamentos, agente_somos_pacientes_fotos).
// PROIBIDO: service key (só publishable key); SELECT/expor cpf/email/data_nascimento; RLS é a única proteção.
// Depende de: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"> ANTES deste script.
// Depende de: js/config.js carregado antes (window.APP_CONFIG).

(function() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    const msg = '[supabase] CDN @supabase/supabase-js@2 não carregou antes de js/supabase.js. Verifique a ordem dos <script> em index.html.';
    console.error(msg);
    if (window.sysLogger) window.sysLogger.error(msg);
    return;
  }
  if (!window.APP_CONFIG || !window.APP_CONFIG.SUPABASE_URL) {
    const msg = '[supabase] window.APP_CONFIG ausente. js/config.js precisa carregar antes de js/supabase.js.';
    console.error(msg);
    if (window.sysLogger) window.sysLogger.error(msg);
    return;
  }

  // Sobrescrevemos window.supabase (que vem do UMD da CDN como namespace) pela INSTÂNCIA do client.
  // Após esta linha, window.supabase.from(...), window.supabase.auth, etc. funcionam diretamente.
  const client = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false }, // painel sem login no MVP (auth fica para fase futura)
    }
  );
  window.supabase = client;

  // Smoke test — leitura barata pra validar URL + key + RLS.
  // Usa head:true + count:exact pra não trafegar linhas (privacidade).
  (async function smokeTest() {
    try {
      const { count, error } = await client
        .from('saas_clinicas_pacientes')
        .select('id', { count: 'exact', head: true });
      if (error) {
        console.error('[supabase] smoke test FALHOU:', error.message, error);
        if (window.sysLogger) window.sysLogger.error('Smoke test falhou no Supabase.', { message: error.message, details: error });
      } else {
        console.log('[supabase] smoke test ok — pacientes count:', count);
        if (window.sysLogger) window.sysLogger.info('Smoke test concluído com sucesso.', { countPacientes: count });
      }
    } catch (e) {
      console.error('[supabase] smoke test EXCEPTION:', e);
      if (window.sysLogger) window.sysLogger.error('Exceção no smoke test do Supabase.', { error: e.message || String(e) });
    }
  })();
})();
