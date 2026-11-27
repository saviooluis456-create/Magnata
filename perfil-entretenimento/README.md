# Sistema do Perfil de Entretenimento

Perfil sobre **filmes, séries, casos criminais ligados ao entretenimento, bastidores e notícias do dia/semana**.
Plataformas: **TikTok, Instagram (Reels + carrossel), YouTube Shorts e YouTube vídeo longo**.

> Perfil: **Luiz no Set** · `@luiznoset`. Identidade em `02-identidade-visual.md`; criação das contas em `07-criacao-das-contas.md`.

---

## Como usar (comandos)

| Você escreve | O que acontece |
|---|---|
| **`pesquisar`** (ou "pesquisar hoje", "pesquisar para amanhã") | Pesquisa intensa do dia: notícias, estreias, o que está sendo comentado, tendências. Gera `pautas/AAAA-MM-DD.md` com as pautas ranqueadas por nota. |
| **`crie os vídeos para amanhã`** / **`crie um vídeo para amanhã`** / "crie o vídeo sobre X" | Usa a pauta do dia (ou pesquisa antes, se não existir), escolhe os melhores temas e escreve os roteiros completos no padrão, com legendas para cada rede, texto de capa e fontes. Salva em `roteiros/AAAA-MM-DD/`. |
| **`planejar o mês`** / "planejar janeiro" | Gera um calendário mensal novo no formato de `05-calendario-dezembro-2026.md`. |
| **`roteiro longo sobre X`** | Roteiro de vídeo longo para o YouTube (12 a 20 min) no padrão de `03-padrao-roteiro.md`. |
| **`analisar`** | Puxa os dados de todos os vídeos, calcula o que funciona (com confiança estatística), avalia os testes A/B, olha os concorrentes e reescreve o `08-playbook.md`. Os próximos roteiros já seguem as regras novas. |
| **`publicar`** / **`responder comentários`** / **`métricas`** | Pelo Windsor.ai, direto no chat (sempre com sua confirmação antes de publicar ou responder). Único caminho para comentários do TikTok. |

## Central do Set (plataforma de publicação)

No Magnata Studio, botão **🎬 Central do Set**: publica o mesmo vídeo em Instagram Reels, TikTok e YouTube (Shorts ou longo, detectado sozinho), com legenda adaptada por rede, filtro de hashtags, checagem de qualidade máxima, agendamento, respostas a comentários com IA, painel de métricas e a aba **🧠 Inteligência** (Índice Set, o que funciona com confiança estatística, alerta de fatores misturados, testes A/B, velocidade nas primeiras 24h, concorrentes do YouTube e o estrategista com IA que reescreve o playbook toda segunda). Código em `src/central/` (app) e `server/` (servidor). Instalação: `server/LEIA-ME.md`.

As regras desses comandos ficam em `.claude/skills/pesquisar/` e `.claude/skills/criar-videos/`, então funcionam em qualquer sessão nova aberta neste repositório.

---

## Mapa dos arquivos

| Arquivo | Conteúdo |
|---|---|
| `01-pesquisa-base.md` | O que a pesquisa encontrou: referências (Carol Moreira, Omelete, Jovem Nerd, Ei Nerd...), dados de retenção, duração e padrões. |
| `02-identidade-visual.md` | Nome, paleta, tipografia, selos por editoria, capas, legendas na tela, regras de edição. |
| `03-padrao-roteiro.md` | **A máquina do roteiro**: estruturas por formato, banco de ganchos, regras de escrita, contagem de palavras. |
| `04-legendas-e-hashtags.md` | Fórmulas de legenda por rede, SEO social, títulos do YouTube, hashtags. |
| `05-calendario-dezembro-2026.md` | Planejamento de dezembro dia a dia, com estreias, ângulos e os vídeos longos do mês. |
| `06-pilares-e-rotina.md` | Editorias, frequência, grade semanal, rotina de produção e regras éticas/jurídicas. |
| `07-criacao-das-contas.md` | Bios prontas, e-mails, segurança e passo a passo para criar as contas. |
| `08-playbook.md` | **Playbook dinâmico**: regras que os dados confirmam, testes ativos e mix da semana. Atualizado pelo `analisar` e pela Central. |
| `analises/` | Relatórios semanais e dados usados em cada análise. |
| `templates/` | Modelos em branco de pauta, roteiro curto e roteiro longo. |
| `pautas/` | Saída do comando `pesquisar`. |
| `roteiros/` | Saída do comando `crie os vídeos`. |

O repositório também tem o **Magnata Studio** (editor de vídeo). Os roteiros indicam estilo de legenda, cortes e efeitos para montar o vídeo nele.
