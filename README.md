# Identidade Visual — SEMEC Pilar

Sistema de identidade visual da **Secretaria Municipal de Educação e Cultura de Pilar – AL**: marcas, redes sociais, grafismos, impressos, vinhetas e as identidades próprias da Casa da Cultura e da Secretária.

- **Arquivos prontos:** pasta [`identidade-semec/`](identidade-semec)
- **Apresentação em slides:** https://claude.ai/artifact/TzwQn9Rw26pikYtbGeA1iz (privada; compartilhe pelo menu Share)
- **Manual da marca:** [`identidade-semec/00-manual/manual-da-marca-semec.pdf`](identidade-semec/00-manual/manual-da-marca-semec.pdf)
- **Código que gera tudo:** pasta [`gerador/`](gerador)

## Mapa das pastas

| Pasta | O que tem |
|---|---|
| `00-manual` | Manual da marca (PDF) |
| `01-logos` | Logo SEMEC e, para cada escola, creche e serviço: logo, selo e foto de perfil |
| `02-stories` | **80 presets** de stories sem fundo e sem texto por tema (sede, escolas, Bilíngue, creches, CRIA, serviços) + kit de 15 com a marca de cada unidade e serviço. Inclui molduras para 2, 3 e 4 fotos, saiu na mídia, convite, aniversariante, placar, antes e depois, legendas pequenas |
| `03-destaques` | 38 capas de destaques em 3 estilos |
| `04-lower-thirds` | Lower thirds sem fundo, horizontal e vertical |
| `05-uniformes` · `06-crachas` | Mockups de fardamento e polo; crachá frente, verso, PDF de impressão e cordão |
| `07-vinhetas` | Vinhetas de 5 s (1080×1920, com som) em **seis estilos**: livro, cortina, adesivos, círculo, faixas e linha |
| `08-impressos` | **Refeitos.** Por evento/campanha (36): 4 cartazes A3, 2 panfletos A5, 2 banners roll-up, 2 faixas e 3 backdrops de arte inteira, em JPG + PDF vetorial. Institucional por tema, unidade e serviço, com panfletos informativos por serviço. Calendários 2027 |
| `09-grafismos` | **51 pacotes** de elementos em PNG transparente (5 frentes, 22 serviços, 24 datas), mais de mil por frente e por serviço: ilustrações, ícones, formas e palavras-adesivo |
| `10-feed` | Presets de feed sem fundo (1080×1350) e posts prontos por frente e serviço |
| `11-fundos` | 10 estilos de fundo por tema, para story e feed |
| `12-carrosseis-prontos` · `13-stories-prontos` | 86 temas informativos escritos, em carrossel e em sequência de stories |
| `14-datas-comemorativas` | 24 datas, cada uma com **foto de perfil sazonal da Secretaria**, 12 destaques, 10 títulos sem fundo, posts, stories, fundos, presets e vinheta |
| `15-casa-da-cultura` | Identidade própria em estilo xilogravura: logo, ilustrações da cultura de Pilar, panoramas, padrões, série Patrimônios, programação, redes sociais, sinalização, postais, marcadores, banners e backdrops |
| `16-secretaria-elizaneide-costa` | Identidade pessoal da Secretária (roxo, rosa e branco): 3 opções de logo, perfil, destaques, presets, fundos, artes com título, lower thirds, papelaria e vinhetas |
| `17-sala-da-comunicacao` | 18 formulários de planejamento em 3 cores, kanban, placas de porta, títulos de mural, lombadas, etiquetas, capas e cartazes de parede |
| `18-presets-animados-sem-fundo` | 10 animações de 3 s por tema, em WebM com transparência e em MP4 com fundo verde (chroma key) |

## Sobre os números de grafismos

Cada pacote parte de desenhos-base (115 ilustrações desenhadas para este projeto, ícones Phosphor e cerca de 90 formas) e os entrega em várias cores e acabamentos. Por isso um pacote passa de mil arquivos sem ter mil desenhos diferentes.

## Sobre resolução

Logos, títulos e presets principais saem em 1,5× a 2× (até 2160 px de largura). PDFs de impressão são vetoriais em tamanho real; os da Casa da Cultura embutem imagem em alta, porque a textura de xilogravura não é vetorial. Artes com fundo saem entre 1080 e 1620 px de largura. Para regerar qualquer peça maior, aumente `scale` no script correspondente.

## Pesquisa

- **Rede (Censo Escolar):** 17 escolas, a Escola Bilíngue e 6 creches/CMEIs — lista completa em `gerador/core.js`.
- **Cultura de Pilar:** Boi do Canário (Mestre Canarinho, Dia de Reis), bloco Os Caçadores, Banda Fanfarra, Peixe Bagre, Cine Pilarense (1924), Museu Arthur Ramos, Mestra Bida, lagoa Manguaba, festivais Mestre Canarinho, de Cinema e de Artes e Saberes das Águas.
- **Secretária:** a imprensa local grafa "Elizaneide Costa".

Fontes: [escol.as](https://www.escol.as/cidades/1724-pilar/dependencia/municipal) · [Prefeitura de Pilar](https://pilar.al.gov.br/) · [Portal AL7 – nova secretária](https://portalal7.com.br/pilar-prefeita-fatima-rezende-anuncia-professora-elizaneide-costa-como-nova-secretaria-de-educacao/) · [AMA – Patrimônio Vivo](https://ama-al.com.br/pela-primeira-vez-em-alagoas-pilar-diploma-grupos-folcloricos-como-patrimonio-vivo/) · [Mapa da Cultura – Boi do Canário](https://mapa.cultura.gov.br/agente/14395152/) · [Tribuna do Sertão – Festival de Artes e Saberes das Águas](https://www.tribunadosertao.com.br/cidades/2026/11/13/1021037-festival-de-artes-e-saberes-das-aguas-valoriza-tradicoes-culturais-e-identidade-de-pilar) · [TNH1 – Cine Pilarense](https://www.tnh1.com.br/noticia/nid/primeiro-festival-de-cinema-de-pilar-sera-realizado-em-homenagem-aos-cem-anos-do-cine-pilarense/) · [TNH1 – Escola Bilíngue](https://www.tnh1.com.br/noticia/nid/escola-bilingue-de-pilar-recebe-reconhecimento-nacional-do-mec-por-inovacao-no-ensino-integral/)

## Pontos a confirmar

1. **Sigla** SEMEC (`SIGLA` em `gerador/core.js`) e **grafia do nome da Secretária** (`NOME` em `gerador/secretaria.js`).
2. **Creches CRIA:** nomes oficiais não encontrados; há duas unidades-modelo.
3. **Serviços e coordenações:** lista de 22 montada por dedução.
4. **Textos informativos:** são gerais (legislação e programas nacionais). Datas, telefones e endereços ficam como marcadores. O termo de uso de imagem é um modelo e deve passar pela Procuradoria.
5. **Ilustrações de prédios** (Cine, igreja, Casa da Cultura) são estilizadas, não retratos fiéis.
6. **Som das vinhetas:** sintetizado pelo `audio.py` e não ouvido durante a produção.
7. **Marca da Secretária:** é para canais pessoais. A publicidade oficial não pode trazer nomes ou símbolos de promoção pessoal (Constituição, art. 37, §1º).
8. **Logo da Prefeitura:** os rodapés trazem "Prefeitura de Pilar" em texto.

## Como gerar de novo

```bash
cd gerador && npm install
node logos.js && node stories.js && node social.js && node social2.js
node grafismos.js && node conteudo.js && node datas.js
node print2.js && node calendario.js && node cultura.js
node secretaria.js && node comunicacao.js
node vinheta.js && node vinheta2.js && node manual.js
```

Requer Node 22, Playwright com Chromium, Python 3 (numpy, Pillow) e ffmpeg. Cada script aceita um filtro (`node print2.js sao-joao`). `PULAR=1` pula o que já existe; `CONC=2` limita o paralelismo.

Fontes tipográficas: Anton, Poppins, Baloo 2, Lilita One, Alfa Slab One, Caveat Brush, Playfair Display, DM Serif Display e Great Vibes (Google Fonts, licença OFL). Ícones: Phosphor (MIT).
