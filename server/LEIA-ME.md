# Central do Set: como colocar no ar

A Central do Set tem duas partes:

| Parte | Onde fica | O que faz |
|---|---|---|
| **App** (telas) | Magnata Studio, botão **🎬 Central do Set** | Você escolhe o vídeo, escreve a legenda, marca as redes e acompanha fila, comentários e métricas. |
| **Servidor** (esta pasta) | Cloudflare Workers | Guarda os vídeos, publica nas redes, busca comentários a cada 15 min, responde com IA e atualiza as métricas a cada hora. |

O servidor **nunca usa senha das redes**. Você conecta cada conta pelo botão oficial "Entrar com…", e os acessos ficam criptografados.

---

## Dois jeitos de conectar as redes

| | ⚡ Conexão rápida (recomendado) | App próprio (avançado) |
|---|---|---|
| Como | Conta no Zernio + 1 toque por rede | Criar app de desenvolvedor no Meta, Google e TikTok |
| Tempo | ~2 minutos | ~15 minutos por rede |
| Custo | 2 contas grátis; a 3ª ~US$ 6/mês. Comentários podem exigir o complemento de caixa de entrada | Grátis |
| TikTok | Vídeos públicos direto | Privados até a auditoria do TikTok |
| Concorrentes do YouTube (Inteligência) | Precisa também do YouTube pelo app próprio | ✅ |

Dá para misturar os modos. **Configuração do Luiz no Set: Instagram pelo Windsor.ai, TikTok e YouTube pelo Zernio.**

**Instagram pelo Windsor.ai:** na aba Contas → Instagram → *Conectar pelo Windsor.ai*, cole a chave da API do Windsor. A Central puxa as métricas sozinha. O Windsor não tem API de publicação, então os posts do Instagram ficam *aguardando o Claude*: no chat, peça **publicar pendentes**, e o Claude publica pelo Windsor e marca na Central. As respostas aos comentários do Instagram também saem pelo chat.

## O que é possível em cada rede (app próprio)

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

### Jeito fácil: o Claude coloca no ar
1. Crie uma conta grátis em **dash.cloudflare.com** e assine o **Workers Paid** (US$ 5/mês).
2. Em **My Profile → API Tokens → Create Token**, use o modelo **Edit Cloudflare Workers** e adicione as permissões **D1: Edit** e **Workers R2 Storage: Edit**.
3. No chat, peça ao Claude: **"coloca a Central no ar"**. Ele abre um formulário seguro para o token (nunca cole no chat), cria o banco e o armazenamento, publica o app e o servidor e te passa:
   - o **endereço da Central** (`https://central-do-set.xxxx.workers.dev`);
   - o **código de instalação** (uso único).
4. Abra o endereço no celular → **Central do Set** → crie a sua senha com o código.
5. Aba **Contas → ⚡ Conexão rápida**: crie uma conta grátis em zernio.com, copie a chave da API (Settings → API Keys), cole na Central e toque em **Conectar** em cada rede. Um toque por rede, sem app de desenvolvedor. (Alternativa avançada: "Usar app próprio", com o passo a passo na tela.)
6. Aba **Contas → Conectar o Claude**: gere a chave e entregue ao Claude pelo formulário seguro.
7. Depois, revogue o token da Cloudflare (ou deixe guardado se quiser que o Claude publique atualizações).

### Jeito manual (computador com Node.js)
```bash
cd server && npm install
npx wrangler login
npx wrangler d1 create central-do-set            # cole o database_id no wrangler.toml
npx wrangler r2 bucket create central-do-set-videos
npm run db:init
npx wrangler secret put TOKEN_KEY                 # resultado de: openssl rand -base64 32
npx wrangler secret put SETUP_CODE                # um código qualquer de uso único
cd .. && npm install && npm run build && cd server && npm run deploy
```
Opcionais: `ANTHROPIC_API_KEY` (IA nos comentários e no estrategista) e `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (vídeos acima de 100 MB; configure também o CORS e a regra de 30 dias no bucket).

### Notas por rede
- **Instagram:** a conta precisa ser profissional (Criador). Adicionar **luiznoset** como testador do app dispensa a revisão da Meta.
- **YouTube:** com a tela de consentimento em modo "Teste", o Google pede reconexão a cada 7 dias; publique a tela para acabar com isso. Os vídeos saem privados até a auditoria da API (gratuita).
- **TikTok:** os vídeos saem privados até a auditoria do app. Depois dela, mude `TIKTOK_PUBLIC = "true"` no `wrangler.toml` e publique de novo.

## Segurança
- A senha da Central fica guardada só como hash (PBKDF2). Cada aparelho recebe uma sessão de 90 dias. Trocar a senha desconecta todos os aparelhos. Depois de 8 tentativas erradas, o login trava por 15 minutos.
- A chave do Claude só lê e faz o que você marcou (responder, estratégia, publicar). Contas, chaves de app e senhas ficam fora do alcance dela. Revogue em Contas → Conectar o Claude.
- As chaves dos apps (Instagram, Google, TikTok) e os tokens das redes ficam criptografados (AES-GCM) no banco.
- Os tokens das redes ficam criptografados (AES-GCM) no banco D1 e são renovados sozinhos.
- Para cortar o acesso de uma rede: aba Contas → Desconectar, e também remova o app nas configurações da própria rede.

## Desenvolvimento local
```bash
cp .dev.vars.example .dev.vars   # TOKEN_KEY e SETUP_CODE de teste
(cd .. && npm run build)
npx wrangler d1 execute central-do-set --local --file=schema.sql
npx wrangler dev --local          # app + API em http://localhost:8787
```

---

## 🧠 Inteligência (análise e estratégia)

Funciona sozinha depois da instalação:
- **A cada hora:** guarda um registro das views de cada vídeo (curva de crescimento) e recalcula o **Índice Set** (100 = vídeo típico seu naquela rede e formato).
- **Sempre que a aba abre:** recalcula o que funciona por editoria, gancho, duração, horário, dia, legenda e hashtags, com encolhimento estatístico, intervalo de 90%, nível de confiança e alerta quando dois fatores andam juntos. Também avalia os testes A/B, descontando a editoria (teste de permutação).
- **Todo dia (3h):** atualiza os últimos 50 vídeos dos concorrentes que você adicionar (dados públicos do YouTube; precisa do YouTube conectado).
- **Toda segunda (9h):** o estrategista (Claude, precisa da `ANTHROPIC_API_KEY`) lê tudo, escreve o diagnóstico e as ações da semana, reescreve o playbook (nova versão) e propõe até 3 testes A/B, que você aprova na aba.

Se você instalou antes desta versão, rode de novo `npm run db:init` (só cria as tabelas novas) e `npm run deploy`.

O botão **Copiar para o Claude** (aba Inteligência) copia o playbook atual em texto. Cole no chat e peça `analisar`: o Claude junta com os dados do Windsor e atualiza `perfil-entretenimento/08-playbook.md`, que os roteiros seguem.
