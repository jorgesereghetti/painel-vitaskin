# 🏥 Painel VitaSkin — SaaS para Clínicas

Painel de gestão para clínicas (estética/dermatologia): **pacientes, agendamentos, pacotes de tratamento** e indicadores, com backend serverless no Supabase e deploy na Netlify.

> Projeto de portfólio — front-end modular (HTML/CSS/JS) integrado a banco em tempo real.

---

## ✨ Funcionalidades

- Gestão de pacientes e agendamentos
- Pacotes de tratamento e acompanhamento
- Dashboard com gráficos e indicadores
- Backend em tempo real via Supabase (com RLS como proteção)

## 🛠️ Tecnologias

- **HTML5, CSS3, JavaScript** (modular, sem framework)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Netlify** (deploy)
- Chart.js (gráficos)

## 🚀 Como rodar

```bash
# Configure suas chaves (ficam fora do Git)
cp js/config.example.js js/config.local.js
# edite js/config.local.js com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY
```

Depois abra `index.html` (ou sirva com um servidor estático / Netlify).

> 🔒 Apenas a *publishable key* do Supabase é usada no frontend; a proteção real é via RLS. Nenhuma chave secreta é versionada.

## 👤 Autor
**Jorge Sereghetti** — Especialista em IA e Automação para Negócios
