# Central do Set: como colocar no ar

A Central do Set tem duas partes:

| Parte | Onde fica | O que faz |
|---|---|---|
| **App** (telas) | Magnata Studio, botão **🎬 Central do Set** | Você escolhe o vídeo, escreve a legenda, marca as redes e acompanha fila, comentários e métricas. |
| **Servidor** (esta pasta) | Cloudflare Workers | Guarda os vídeos, publica nas redes, busca comentários a cada 15 min, responde com IA e atualiza as métricas a cada hora. |

O servidor **nunca usa senha das redes**. Você conecta cada conta pelo botão oficial "Entrar com…", e os acessos ficam criptografados.

---

## O que é possível em cada rede

| | Instagram | TikTok | YouTube |
|---|---|---|---|
| Publicar | ✅ Reels | ⚠️ Privado até o TikTok aprovar o app | ⚠️ Privado até o Google aprovar o app |
| Responder comentários | ✅ | ❌ sem API pública: use o Windsor.ai (peça ao Claude) | ✅ |
| Métricas | ✅ views, alcance, tempo assistido, salvos | ✅ views, curtidas, compartilhamentos | ✅ inclusive retenção e inscritos ganhos |
| Arquivo original, sem recompressão | ✅ | ✅ | ✅ (até 4K) |

Aprovação (auditoria) do TikTok e do Google: é gratuita, mas pede formulário, vídeo de demonstração do app e política de privacidade. Leva de alguns dias a algumas semanas. Até lá, o vídeo chega privado e você toca em "público" no app.

## Custos

- **Cloudflare Workers Paid: US$ 5/mês (recomendado).** O plano grátis tem limites que travam a espera pelo processamento do Instagram.
- **R2 (vídeos):** 10 GB grátis; depois cerca de US$ 0,015 por GB/mês. Crie uma regra para apagar vídeos com mais de 30 dias (item 2).
- **IA nos comentários (Claude):** paga por uso, centavos de dólar por dezena de comentários. Opcional.
- Apps de desenvolvedor (Meta, Google, TikTok): grátis.

---

## Passo a passo

> Precisa de um computador para a instalação (uma vez). Depois, tudo funciona pelo celular.

### 1. Cloudflare
1. Crie uma conta em **dash.cloudflare.com**. Assine o plano **Workers Paid**.
2. Instale o Node.js (nodejs.org), abra o terminal nesta pasta (`server/`) e rode:
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create central-do-set        # copie o database_id para o wrangler.toml
   npx wrangler r2 bucket create central-do-set-videos
   npm run db:init
   ```
3. No `wrangler.toml`, preencha `database_id`, `APP_URL` (onde o app abre, ex.: `https://SEU-USUARIO.github.io/Magnata/`) e `R2_ACCOUNT_ID` (aparece no painel da Cloudflare, lado direito).
4. Crie os segredos básicos:
   ```bash
   npx wrangler secret put ADMIN_TOKEN     # uma senha longa (40+ caracteres) gerada no Bitwarden
   npx wrangler secret put TOKEN_KEY       # cole o resultado de: openssl rand -base64 32
   ```
5. Publique: `npm run deploy`. Copie a URL que aparecer (`https://central-do-set.xxxx.workers.dev`) para `API_URL` no `wrangler.toml` e rode `npm run deploy` de novo.

### 2. Vídeos grandes (opcional, recomendado para vídeo longo)
Sem este passo, o envio passa pelo servidor e aceita até **100 MB** (suficiente para Reels/Shorts em alta qualidade). Para vídeos longos:
1. Painel da Cloudflare → R2 → **Manage API tokens** → crie um token com *Object Read & Write* só para o bucket `central-do-set-videos`.
2. `npx wrangler secret put R2_ACCESS_KEY_ID` e `npx wrangler secret put R2_SECRET_ACCESS_KEY`.
3. No bucket → **Settings → CORS policy**, cole (troque pela URL do seu app):
   ```json
   [{ "AllowedOrigins": ["https://SEU-USUARIO.github.io"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
4. No bucket → **Settings → Object lifecycle rules**: apagar objetos com prefixo `videos/` após 30 dias.

### 3. Instagram (Meta)
1. No app do Instagram: **conta profissional → Criador**.
2. **developers.facebook.com** → Criar app → tipo **Empresa** → adicione o produto **Instagram** → "API com login do Instagram".
3. Em *Configurar login do Instagram*, adicione a URL de redirecionamento: `https://SUA-API.workers.dev/oauth/instagram/callback`.
4. Em *Funções do app → Testadores do Instagram*, adicione **@luiznoset** e aceite o convite no Instagram (Configurações → Apps e sites). Com isso o app funciona para a sua conta sem revisão da Meta.
5. Copie o ID e a chave secreta **do app do Instagram**:
   `npx wrangler secret put IG_APP_ID` e `npx wrangler secret put IG_APP_SECRET`.

### 4. YouTube (Google)
1. **console.cloud.google.com** → novo projeto "Central do Set".
2. Ative: **YouTube Data API v3** e **YouTube Analytics API**.
3. *Tela de consentimento OAuth*: tipo Externo, adicione o seu Gmail da conta mestre como **usuário de teste**.
4. *Credenciais → Criar ID do cliente OAuth* → Aplicativo da Web → URI de redirecionamento: `https://SUA-API.workers.dev/oauth/youtube/callback`.
5. `npx wrangler secret put GOOGLE_CLIENT_ID` e `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
6. Para os vídeos saírem públicos direto: peça a auditoria em *YouTube API Services – Audit and Quota Extension Form*. Até lá, eles chegam privados.
7. ⚠️ Com a tela de consentimento em modo "Teste", o Google exige reconectar a cada 7 dias. Publicar a tela de consentimento ("Em produção") resolve.

### 5. TikTok
1. **developers.tiktok.com** → Manage apps → Create app.
2. Adicione os produtos **Login Kit** e **Content Posting API** (ative *Direct Post*). Escopos: `user.info.basic`, `user.info.stats`, `video.publish`, `video.list`.
3. Redirect URI: `https://SUA-API.workers.dev/oauth/tiktok/callback`.
4. Em *Sandbox*, adicione a conta **@luiznoset** como usuária de teste.
5. `npx wrangler secret put TIKTOK_CLIENT_KEY` e `npx wrangler secret put TIKTOK_CLIENT_SECRET`.
6. Depois que o TikTok aprovar o app (auditoria), mude `TIKTOK_PUBLIC = "true"` no `wrangler.toml` e rode `npm run deploy`.

### 6. IA nos comentários (opcional)
1. **console.anthropic.com** → API Keys → crie uma chave.
2. `npx wrangler secret put ANTHROPIC_API_KEY`.
3. No app, aba **Comentários**: comece no modo **Aprovação**. Quando confiar nas respostas, passe para **Automático** (só elogios, perguntas e contatos de marca; o resto sempre vem para você).

### 7. Ligar o app
1. Abra o Magnata Studio → **🎬 Central do Set** → aba **Contas**.
2. Cole a URL da API e o `ADMIN_TOKEN` → **Salvar e testar**.
3. Toque em **Conectar** em cada rede e entre com a conta do perfil. No YouTube, escolha a Conta de Marca **Luiz no Set**.

---

## Segurança
- `ADMIN_TOKEN` é a chave da Central. Fica salvo só no navegador do seu celular. Se perder o celular, troque com `npx wrangler secret put ADMIN_TOKEN`.
- Os tokens das redes ficam criptografados (AES-GCM) no banco D1 e são renovados sozinhos.
- Para cortar o acesso de uma rede: aba Contas → Desconectar, e também remova o app nas configurações da própria rede.

## Desenvolvimento local
```bash
cp .dev.vars.example .dev.vars   # crie com ADMIN_TOKEN e TOKEN_KEY de teste
npx wrangler d1 execute central-do-set --local --file=schema.sql
npx wrangler dev --local --var APP_URL:http://localhost:5173/ --var API_URL:http://localhost:8787
```
