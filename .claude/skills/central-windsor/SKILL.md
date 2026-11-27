---
name: central-windsor
description: Publica vídeos, responde comentários e lê métricas das contas do perfil Luiz no Set (Instagram, TikTok, YouTube) pelo conector Windsor.ai, direto do chat. Use quando o usuário escrever "publicar", "postar esse vídeo", "responder comentários", "responder comentários do TikTok", "como foi o vídeo", "métricas", "relatório da semana" ou quando a Central do Set (servidor próprio) ainda não estiver no ar.
---

# Central pelo Windsor.ai (atalho no chat)

**Configuração do perfil:** Instagram no Windsor; TikTok e YouTube no Zernio (pela Central). Com a Central conectada, a skill `central` coordena tudo e chama este fluxo só para o Instagram. Fora isso, use esta skill **só** se a Central do Set não estiver conectada (sem `perfil-entretenimento/central.json`); senão, use a skill `central`. Funciona enquanto a Central do Set própria (`server/`) não está no ar, e também é o **único caminho para comentários do TikTok** (o TikTok não tem API pública de comentários).

Leia antes: `perfil-entretenimento/04-legendas-e-hashtags.md` e `perfil-entretenimento/02-identidade-visual.md` (seção 6: voz).

## 0. Descobrir as contas
Chame `get_connectors` (servidor `Windsor_ai_for_Social_Media`). Use **só** as contas do Luiz no Set (@luiznoset / "Luiz no Set"). Pode haver outras contas conectadas (ex.: uma conta do TikTok): para o Luiz no Set, use no Windsor **só o Instagram @luiznoset**. Nunca publique nem responda em outra conta por engano. Se a conta do Luiz no Set não aparecer, peça ao usuário para conectar e passe o link de `get_connector_connect_info`.

## 1. Publicar
1. O vídeo precisa estar em uma **URL pública** (MP4). Se o usuário só tiver o arquivo, explique que a Central do Set (aba Publicar) é o caminho, ou peça um link direto.
2. Monte as legendas pelas regras de `src/central/core/captions.ts` e `hashtags.ts`: palavra-chave na primeira linha; 3 a 5 hashtags no Instagram e TikTok, 3 no YouTube; sem hashtags genéricas (#fyp, #viral), de spam ou sensíveis (#assassinato, #morte...).
3. **Mostre ao usuário as legendas e as redes e espere o "pode publicar"** antes de cada `execute_action`. Publicar é público e não dá para desfazer de forma limpa.
4. Ações:
   - Instagram: `create_video_post` (vira Reel), `share_to_feed: true`, `caption`.
   - YouTube: `upload_video` (`made_for_kids: false`, `category_id: "24"`, `privacy_status: "public"`; para agendar: `privacy_status: "private"` + `publish_at`). Limite do Windsor: 100 MB.
   - TikTok: `create_video_post`. Só aceita URL de domínio verificado pelo Windsor e sai **privado** até a aprovação do app deles. Avise o usuário.
5. Responda com o link de cada rede.

## 2. Responder comentários
1. Leia comentários recentes com `get_data` (valide os campos com `get_fields` antes; use um período de 7 dias).
2. Classifique cada um como na Central (`server/src/ai.ts`): simples, pergunta, crítica, ofensivo, sensível, marca, spam.
3. Escreva as respostas na voz do Luiz no Set: 1 a 2 frases, até 220 caracteres, no máximo 1 emoji, "equipe" para os seguidores, nada de spoiler sem aviso, nunca chamar de culpado quem não foi condenado. Marca/parceria: encaminhe para luiznoset@gmail.com. Ofensivo, sensível e spam: **não responda**; liste para o usuário (pode sugerir `hide_comment` no spam).
4. Mostre a lista "comentário → resposta" e **só envie depois do ok do usuário** (`reply_to_comment` em cada rede). Se o usuário disser "pode responder sempre os simples", ainda assim confirme a cada lote.

## 3. Métricas
1. `get_fields` e depois `get_data` para cada rede (views, curtidas, comentários, compartilhamentos, salvamentos, tempo médio assistido, seguidores).
2. Entregue: top 5 vídeos, média por editoria (quadro), o que funcionou no gancho e na duração, e 3 recomendações para a próxima semana.
3. Se pedirem um relatório para guardar ou compartilhar, publique como artifact.
4. Use as conclusões para ajustar `perfil-entretenimento/01-pesquisa-base.md` (seção 5) no começo de cada mês.
