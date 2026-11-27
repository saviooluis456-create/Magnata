---
name: pesquisar
description: Pesquisa intensa de pautas do dia para o perfil de entretenimento (filmes, séries, crime real, bastidores, notícias). Use quando o usuário escrever "pesquisar", "pesquisar hoje", "pesquisar para amanhã", "o que está bombando" ou pedir pautas.
---

# Pesquisar: pautas do dia

Antes de começar, leia: `perfil-entretenimento/06-pilares-e-rotina.md` (editorias, grade, regras) e a linha do dia em `perfil-entretenimento/05-calendario-*.md` (o mês atual).

## 1. Data alvo
- "pesquisar" = hoje. "pesquisar para amanhã" = amanhã. Use a data atual do sistema.
- Veja qual é o **quadro fixo** do dia na grade semanal e o que já estava planejado no calendário.

## 2. Varredura (rode as buscas em paralelo, no mesmo turno)
Faça **no mínimo 12 buscas**, cobrindo todas as frentes. Use `WebSearch` e, para páginas que importam, leia a página inteira (agente `web-fetch`).

**Notícias (últimas 24-72h)**
- notícias de cinema/séries hoje (Omelete, Jovem Nerd, Ei Nerd, Pipoca Moderna, Terra/UOL entretenimento, G1 Pop & Arte)
- Hollywood: Variety, Deadline, The Hollywood Reporter (escalação, cancelamento, renovação, bilheteria)
- bilheteria Brasil e EUA do fim de semana

**Estreias**
- estreias da semana em cinema (Brasil estreia na quinta) e em cada streaming (Netflix, HBO Max, Prime Video, Disney+, Apple TV, Globoplay, Paramount+)
- trailers lançados nas últimas 48h

**O que está sendo comentado**
- top 10 Netflix Brasil da semana (site oficial Netflix Top 10 / FlixPatrol)
- tendências públicas: TikTok Creative Center (hashtags em alta, Brasil), Google Trends (pesquisas em alta, entretenimento), "em alta" do YouTube
- polêmicas, brigas de bastidor, declarações de atores, memes de série

**Crime real**
- casos reais ligados a séries/filmes/docs que estreiam ou estão em alta
- novidades de casos que já viraram doc (julgamentos, novas provas)

**Datas**
- confirme na fonte oficial toda data de estreia que vai aparecer na pauta.

> Limite honesto: não há login no Instagram/TikTok nesta sessão. A pesquisa usa páginas públicas, buscadores e ferramentas de tendência abertas. Se o conector Windsor.ai estiver conectado às contas do perfil, leia também os vídeos com melhor desempenho dos últimos 14 dias e use isso na nota.

## 3. Ranqueamento
Para cada pauta candidata (mínimo 10), dê notas 0-5:
- **A** Atualidade · **C** Volume de conversa · **P** Encaixe no perfil · **H** Potencial de história · **E** Imagens disponíveis · **R** Risco (jurídico, spoiler, boato)
- **Total = A×2 + C×2 + P + H + E − R**

## 4. Saída
Salve em `perfil-entretenimento/pautas/AAAA-MM-DD.md` usando `perfil-entretenimento/templates/pauta-diaria.md`. Inclua:
- Radar (o que está acontecendo, com fonte e link de cada item)
- Tabela ranqueada
- Recomendação: vídeo principal, vídeo 2, carrossel/story, o que guardar para o longo, com **gancho sugerido** e **formato**
- Datas a confirmar
- Lista de fontes com links

Se uma notícia urgente surgir, ela passa à frente do quadro fixo.

No chat, responda curto: as 3 melhores pautas com a nota e o caminho do arquivo. Pergunte se pode seguir para "crie os vídeos".
