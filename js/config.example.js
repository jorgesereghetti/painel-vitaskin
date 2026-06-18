// js/config.example.js — TEMPLATE (sem chaves reais)
// ✅  Este ficheiro É commitado — serve de referência para quem clonar o repo.
// Copie para js/config.local.js e preencha com as chaves reais.

window.APP_CONFIG_LOCAL = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_COLE_SUA_CHAVE_AQUI',
  LOG_WEBHOOK_URL: 'https://seu-n8n-ou-endpoint-de-logs.com/webhook', // Opcional
  // FOTOS_STORAGE: true,  // ativar APÓS criar bucket 'pacientes-fotos' + migrar (trilha B); default false
  // ⚠️  NUNCA coloque a secret key (sb_secret_*) aqui — é só para servidor.
};
