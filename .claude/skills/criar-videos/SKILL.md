---
name: criar-videos
description: Cria os roteiros completos (curtos para TikTok/Reels/Shorts e/ou vídeo longo do YouTube) do perfil de entretenimento, com legendas por rede, capa e fontes. Use quando o usuário escrever "crie os vídeos para amanhã", "crie um vídeo para amanhã", "crie o vídeo sobre X", "roteiro longo sobre X", "roteiros da semana" ou "planejar o mês".
---

# Criar vídeos

**Leia antes, sempre:**
0. `perfil-entretenimento/08-playbook.md`: as regras **ativas** valem mais que qualquer outro arquivo. Regras **em teste** e **experimentos ativos** definem a variante de cada roteiro.
1. `perfil-entretenimento/03-padrao-roteiro.md` (estruturas, banco de ganchos, regras, checklist)
2. `perfil-entretenimento/04-legendas-e-hashtags.md`
3. `perfil-entretenimento/02-identidade-visual.md` (seções 5 e 6: edição e voz)
4. `perfil-entretenimento/06-pilares-e-rotina.md` (seção 5: regras éticas/jurídicas)

## 1. Definir o que criar
- "para amanhã" → data = amanhã. "os vídeos" = vídeo principal + vídeo 2 (e o longo, se amanhã for domingo ou dia de longo no calendário). "um vídeo" = só o principal.
- Procure `perfil-entretenimento/pautas/<data>.md`. **Se não existir ou tiver mais de 24h**, rode primeiro o fluxo da skill `pesquisar` para essa data.
- Cruze com o calendário do mês (`05-calendario-*.md`) e com o quadro fixo do dia.

## 2. Pesquisa de profundidade (por vídeo)
Para cada tema escolhido, faça **pesquisa dedicada de história** (no mínimo 6 buscas, leia as melhores páginas por inteiro):
- fatos centrais e datas (confirme em 2 fontes)
- bastidores, declarações, curiosidades pouco conhecidas
- conexões criativas (caso real que inspirou, versão anterior, ator que quase fez, número surpreendente)
- para crime real: status judicial atual e linguagem correta
- imagens disponíveis (trailer oficial, press kit, fotos de arquivo)

Escolha **o ângulo mais surpreendente** que seja verdadeiro. Escreva 3 opções de gancho e escolha a melhor (diga qual e por quê).

## 3. Escrever
- Curto: `perfil-entretenimento/templates/roteiro-curto.md`. Respeite a contagem de palavras do formato (2,7 palavras/s).
- Longo: `perfil-entretenimento/templates/roteiro-longo.md` (150 palavras/min), com capítulos, retomadas, marcações `[IMAGEM]` e `[CORTE]`, 5 títulos e descrição.
- Inclua: roteiro em tabela (tempo, locução, texto na tela, imagem, som), locução corrida, capa, legendas de Instagram/TikTok/YouTube, notas de edição para o Magnata Studio, fontes com links.
- Passe o **checklist** da seção 5 do padrão e marque cada item.

## 3b. Experimentos
- Se houver experimento ativo que caiba no vídeo, aplique a variante com menos vídeos até agora (conte os roteiros já marcados em `roteiros/`). Mude **só** o que o experimento testa.
- No cabeçalho do roteiro, preencha `Tipo de gancho`, `Experimento` e `Variante`. Sem isso, a análise não aprende com o vídeo.
- Na Central do Set, ao publicar, escolha o mesmo experimento e a mesma variante.

## 4. Salvar
`perfil-entretenimento/roteiros/AAAA-MM-DD/<numero>-<slug>.md` (ex.: `01-duna-parte-tres-guia.md`).

## 5. Responder no chat
Curto: lista dos vídeos (título, formato, duração, gancho) e caminhos dos arquivos. Aponte qualquer dado que não deu para confirmar.

## "planejar o mês"
Gere `perfil-entretenimento/05-calendario-<mes>-<ano>.md` no mesmo formato do calendário de dezembro de 2026: grandes momentos (estreias de cinema e streaming com datas confirmadas, eventos, premiações), vídeos longos do mês e grade dia a dia por semana, com fontes.
