---
name: central
description: Conecta o Claude à Central do Set (servidor próprio do perfil Luiz no Set) e usa as contas do Instagram, TikTok e YouTube por ela - métricas, comentários, inteligência, testes A/B, publicação. Use quando o usuário escrever "conectar a Central", colar o endereço da Central (…workers.dev), ou pedir métricas, comentários, análise ou publicação depois que a Central estiver conectada. É o caminho preferido; o Windsor.ai (skill central-windsor) só entra se a Central não estiver no ar.
---

# Central do Set pelo chat

## Conectar (uma vez por ambiente)
1. O usuário passa o endereço da Central (ex.: `https://central-do-set.xxxx.workers.dev`). Grave em `perfil-entretenimento/central.json` como `{ "apiUrl": "..." }`. O endereço não é segredo; a chave é.
2. Peça a chave **só** pela ferramenta `request_credential`: host = o domínio da Central (sem https://), `suggested_type: "bearer"`, display name "Chave do Claude da Central do Set". Explique antes, em uma frase: a chave é gerada na Central, em Contas → Conectar o Claude, e vai num formulário seguro, nunca no chat. **Se o usuário colar a chave no chat**, não use: peça que revogue essa chave na Central e gere outra pelo formulário.
3. Teste: `curl -s https://HOST/api/me`. O proxy coloca a chave sozinho, então não mande cabeçalho de autorização. A resposta mostra `role: "claude"` e as permissões (`ler`, `responder`, `estrategia`, `publicar`). Se vier 401, a chave está errada ou revogada. Se vier `request blocked`, espere um minuto e tente de novo.

## Usar (todas as chamadas: `curl -s https://HOST/...`, JSON)
| O que | Rota | Permissão |
|---|---|---|
| Contas, seguidores, preferências | `GET /api/status` | ler |
| Fila de posts | `GET /api/posts` | ler |
| Métricas brutas | `GET /api/metrics` · atualizar: `POST /api/metrics/sync` | ler |
| **Inteligência completa** (Índice Set, efeitos com confiança, alertas de mistura, testes A/B, decolando, playbook, concorrentes) | `GET /api/intel` | ler |
| Playbook em texto | `GET /api/intel/playbook.md` | ler |
| Comentários | `GET /api/comments?status=revisar\|rascunho\|novo\|respondido` · buscar novos: `POST /api/comments/sync` | ler |
| Responder / ignorar | `POST /api/comments/{id}/reply` `{"text"}` · `POST /api/comments/{id}/ignore` | responder |
| Gerar análise do estrategista | `POST /api/intel/report` | estrategia |
| Criar / mudar teste A/B | `POST /api/experiments` `{"name","hypothesis","dimension","variants":[...]}` · `PUT /api/experiments/{id}` `{"status"}` | estrategia |
| Concorrentes do YouTube | `POST /api/bench` `{"handle":"@canal"}` · `POST /api/bench/sync` | estrategia / ler |
| Legendas por rede (com filtro de hashtags) | `POST /api/captions` `{"text","format","source","priorityTags"}` | ler |
| Publicar | `POST /api/uploads` → PUT do arquivo na `uploadUrl` → `POST /api/posts` | publicar |

Contas conectadas pela ⚡ conexão rápida (Zernio) funcionam igual pelas mesmas rotas: a Central escolhe o caminho sozinha.

## Configuração atual do Luiz no Set
- **Instagram → Windsor.ai.** A Central lê as métricas pelo Windsor. **Publicar e responder comentários no Instagram é com você**, pelas ações do Windsor no chat (o Windsor não tem API de publicação).
- **TikTok e YouTube → Zernio** (conexão rápida). Publicação, comentários e métricas são automáticos pela Central.

### "publicar pendentes" (Instagram via Windsor)
1. `GET /api/handoff` (permissão publicar): lista os posts com `status: aguardando`, com `caption`, `videoUrl` (link assinado, válido por 6h) e `coverOffsetMs`.
2. Mostre ao usuário o que vai sair (legenda e horário) e espere o ok.
3. Para cada item do Instagram: no servidor `Windsor_ai_for_Social_Media`, `execute_action` com connector `instagram`, ação `create_video_post`, `video_url` = `videoUrl`, `caption` = `caption`, `share_to_feed: true`, e `thumb_offset` = `coverOffsetMs` se houver. Use **só** a conta do @luiznoset.
4. Informe a Central: `PUT /api/posts/{postId}/targets/instagram` com `{"status":"publicado","remoteId":"<media_id>","url":"<link>"}`. Se a publicação falhar: `{"status":"erro","error":"<motivo>"}`.
5. Se o `videoUrl` tiver expirado, chame `GET /api/handoff` de novo para gerar outro link.

### "responder comentários do Instagram"
Leia os comentários pelo Windsor (`get_fields` e depois `get_data`, connector `instagram`), escreva as respostas na voz do perfil, mostre a lista e, depois do ok, envie com `reply_to_comment` do Windsor.

**Nunca** tente rotas de contas, chaves de app, senhas ou chaves do Claude: são só do app, e a chave do Claude recebe 403 de propósito.

## Regras
- **Responder comentários:** monte a lista "comentário → resposta" na voz do perfil (`perfil-entretenimento/02-identidade-visual.md`, seção 6; regras de `server/src/ai.ts`), mostre ao usuário e **só envie depois do ok**. Ofensivo, sensível e spam: não responda, só liste.
- **Publicar:** sempre mostre redes, legendas e horário e espere o "pode publicar".
- **Analisar:** com a Central conectada, a skill `analisar` usa `GET /api/intel` como fonte principal (já vem calculado com o mesmo motor de `scripts/analisar.ts`), junta pesquisa de concorrentes na web e atualiza `perfil-entretenimento/08-playbook.md`. Se a análise do repositório e a da Central divergirem, diga isso e explique por quê.
- Mostre números com a fonte ("Índice Set 184, Instagram, 3 dias").
