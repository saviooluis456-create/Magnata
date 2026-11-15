# Identidade Visual — SEMEC Pilar

Sistema de identidade visual da **Secretaria Municipal de Educação e Cultura de Pilar – AL** (sede, escolas, creches, serviços, campanhas e eventos), construído a partir do estilo das peças de referência da Prefeitura de Pilar e da SEPREV: tipografia condensada pesada, faixas inclinadas, estouros, cores chapadas da bandeira do município e o azul institucional.

- **Entregáveis prontos:** pasta [`identidade-semec/`](identidade-semec)
- **Comece por aqui:** [`identidade-semec/00-manual/manual-da-marca-semec.pdf`](identidade-semec/00-manual/manual-da-marca-semec.pdf)
- **Código-fonte que gera tudo:** pasta [`gerador/`](gerador)

## O que tem em cada pasta

| Pasta | Conteúdo |
|---|---|
| `00-manual` | Manual da marca (PDF, 11 páginas) e as páginas em PNG |
| `01-logos` | Logo SEMEC (horizontal/vertical; cor, negativo, mono; PNG + PDF vetorial; símbolo em SVG) e, para **cada escola, creche e serviço**: logo cor, logo negativo, PDF vetorial, selo e **foto de perfil** 1080×1080 |
| `02-stories` | **40 presets** de stories 1080×1920 **sem fundo e sem texto** para cada tema (sede, escolas, Escola Bilíngue, creches, Creches CRIA, serviços) + kit de 9 presets com a marca de cada unidade e de cada serviço. Inclui 4 legendas pequenas (`18` a `21`) para descrever o que acontece no vídeo |
| `03-destaques` | 38 capas de destaques do Instagram em 3 estilos (colorido, azul-marinho, claro) |
| `04-lower-thirds` | 12 lower thirds **sem fundo e sem texto** por tema, em horizontal (1920×1080) e vertical (1080×1920) + 3 por unidade/serviço |
| `05-uniformes` | Mockups frente/costas: fardamento do aluno e de educação física (por escola/creche), polo da equipe, camiseta de ação e colete (serviços e sede) |
| `06-crachas` | Crachá frente e verso (PNG + PDF 54×86 mm para impressão), arte do **cordão** de 20 mm e mockup — sede, cada unidade, cada serviço e por função |
| `07-vinhetas` | Vinhetas de **5 s** em formato Reels (1080×1920, 30 fps, H.264 + áudio AAC) — SEMEC, temas, cada unidade e cada serviço |
| `08-impressos` | 33 eventos/campanhas (Jornada Pedagógica, Busca Ativa, Matrículas, São João, Natal, Festa da Padroeira, aniversário de Pilar…) com cartaz A3, banner roll-up 80×200, faixa 3×1 m, backdrop 3×2 m, placa de foto, post, story e título transparente; kits institucionais por tema e por unidade; calendários 2027 |

Os PDFs de impressão são **vetoriais e em tamanho real**; os textos de data, horário e local são marcadores para editar no Illustrator/Corel/Canva.

## Pesquisa da rede (novembro/2026)

Unidades municipais listadas no Censo Escolar (via escol.as):

- **Escolas (17):** Anísio de Souza · Antônio Eustáquio de Melo · Dep. Oséas Cardoso · Dr. Manoel Ramos · Emb. Renato de Mendonça · Min. Jarbas Passarinho · Nossa Senhora do Pilar · Pres. Emílio G. Médici · Prof. Arthur Ramos · Prof. Jorge Barros · Profª Jacy da Costa Ayres · Profª Lourinete Barbosa · Profª Sueli Cristina Santos Chagas · Ver. José Washington Melo Maia · Maria Gorete da Silva · Elisabeth Macena dos Santos · Profª Iraci Ferreira dos Santos
- **Escola Bilíngue:** Centro Integral de Ensino Fundamental Bilíngue de Pilar Profª Maria Euda de Melo Omena
- **Creches e CMEIs (6):** CEI Rubens Cavalcante de Barros · CMEI Profª Rosilene Mota de Lima · CMEI Afonso Cavalcante da Silva · Creche Enoch Cavalcanti de Barros · Creche Padre Eduardo Tadeu Lopes da Silva · Creche Tia Mariinha

Fontes: [escol.as – Pilar/AL](https://www.escol.as/cidades/1724-pilar/dependencia/municipal) · [Prefeitura de Pilar](https://pilar.al.gov.br/) · [TNH1 – Escola Bilíngue](https://www.tnh1.com.br/noticia/nid/escola-bilingue-de-pilar-recebe-reconhecimento-nacional-do-mec-por-inovacao-no-ensino-integral/) · [Jovem Pan – ensino bilíngue](https://jovempan.com.br/educacao/cidade-de-pilar-al-vira-referencia-nacional-em-ensino-bilingue-na-rede-publica/) · [Tribuna do Sertão – Creches CRIA em Pilar](https://www.tribunadosertao.com.br/cidades/2022/02/16/422200-governo-de-alagoas-investe-cerca-de-r-50-milhoes-em-pilar) · [TNH1 – Festival de Cinema / Cine Pilarense](https://www.tnh1.com.br/noticia/nid/2-festival-de-cinema-de-pilar-celebra-o-audiovisual-alagoano-com-o-tema-conexoes/) · [TNH1 – Pilar do Preto](https://www.tnh1.com.br/noticia/nid/campanha-pilar-do-preto-celebra-semana-da-consciencia-negra/)

### Pontos a confirmar com a Secretaria

1. **Sigla:** usei **SEMEC**, que é a forma dos editais oficiais. Para trocar, altere `SIGLA` em `gerador/core.js` e gere de novo.
2. **Creches CRIA:** não encontrei os nomes oficiais das unidades de Pilar; criei a identidade do tema e duas unidades-modelo ("Unidade I" e "Unidade II"). Basta trocar os nomes em `UNIDADES`.
3. **Serviços e coordenações:** a lista (Busca Ativa, Comunicação, Alimentação Escolar, Transporte, Educação Especial, EJA, etc.) foi montada a partir das peças de referência e da estrutura usual de uma secretaria — ajuste nomes, inclua ou remova em `SERVICOS`.
4. **Elisabeth Macena** e **Iraci Ferreira** aparecem no Censo só com o nome; tratei como "Escola Municipal".
5. **Datas** dos eventos ficaram como marcadores; o calendário 2027 traz feriados nacionais e estaduais (feriados municipais não incluídos).
6. **Logo da Prefeitura:** os rodapés reservam o espaço "Prefeitura de Pilar" em texto; aplique o logo oficial por cima.

## Como gerar de novo

```bash
cd gerador
npm install
node logos.js && node stories.js && node social.js && node mockups.js
node print.js && node calendario.js && node vinheta.js && node manual.js
```

Requer Node 22, Playwright com Chromium, Python 3 (numpy, Pillow) e ffmpeg. Cada script aceita um filtro, por exemplo `node print.js sao-joao` ou `node stories.js tema-creche`.

Fontes: Anton, Poppins e Baloo 2 (Google Fonts, licença OFL). Ícones: Phosphor Icons (MIT). O áudio das vinhetas é sintetizado pelo próprio `audio.py`, sem trilhas de terceiros.
