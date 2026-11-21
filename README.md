# Magnata Studio

Editor de vídeo para celular, feito como PWA (app web instalável). Tudo roda no aparelho: a renderização é feita em WebGL, a exportação usa WebCodecs e as ferramentas de IA rodam localmente.

## Recursos

**Edição (inspirada em CapCut, Premiere e DaVinci)**
- Timeline com várias faixas: principal magnética, sobreposições, texto, áudio e legendas
- Dividir, aparar pelas alças, mover entre faixas, reordenar com toque longo, duplicar, substituir, congelar quadro, extrair áudio
- Pinça para zoom na timeline, encaixe magnético e marcadores de batida
- Desfazer/refazer (80 níveis) e salvamento automático no aparelho (IndexedDB)
- Velocidade de 0,1x a 10x, keyframes (posição, escala, rotação, opacidade, desfoque, volume) com 8 curvas de easing
- Máscaras (círculo, retângulo, linear, faixa, coração, estrela), chroma key, 13 modos de mesclagem e corte
- Animações de entrada, saída e contínuas
- 9 proporções de tela (9:16, 16:9, 1:1, 4:5, 21:9…) e fundo desfocado ou em cor sólida
- Atalhos de teclado (espaço, Ctrl+Z, S para dividir, setas, Del)

**Cor e efeitos**
- 47 filtros cinematográficos com controle de intensidade
- 14 ajustes de cor (exposição, contraste, realces, sombras, temperatura, vibração, nitidez, vinheta, granulado…)
- 83 efeitos em GLSL: glitch, VHS, CRT, vazamento de luz, bloom, partículas (neve, chuva, confete, corações), distorções, caleidoscópio, telas divididas, estilos artísticos…
- 51 transições, cada uma com um som associado e 28 efeitos sonoros sintetizados (whoosh, impacto, glitch, riser, shutter…), com volume ajustável

**Legendas (inspiradas no Captions)**
- Legendas automáticas com Whisper rodando no aparelho, com tempo de cada palavra e 10 idiomas
- Opções sem internet: sincronizar a partir de um roteiro colado, ou importar SRT/VTT
- 32 estilos prontos: palavra por palavra, karaokê, caixa na palavra ativa, neon, uma palavra por vez, gradiente…
- Personalização completa: fonte (41 Google Fonts), tamanho, peso, cores, gradiente, contorno, sombra, brilho, fundo (por linha, em bloco ou por palavra), 8 modos de destaque, 15 animações, palavras por vez, posição (arrastando na prévia), rotação
- Destaque automático de palavras-chave e emojis automáticos (PT/EN)

**IA**
- Remover silêncios, remover fundo (MediaPipe), zoom inteligente no ritmo da fala, cortar por cenas, sincronizar cortes com a batida (detecta o BPM), corrigir cor automaticamente, melhorar a voz e reduzir ruído, reenquadrar
- 10 efeitos de voz e equalizador de 3 bandas

**Exportação**
- 480p, 720p, 1080p, 2K e 4K, a 24, 25, 30, 50 ou 60 fps, com 5 níveis de qualidade
- Codecs H.264, HEVC, VP9 e AV1, nos formatos MP4, MOV e WebM. Se o aparelho não suportar o codec escolhido, o app troca por outro automaticamente e avisa
- Áudio AAC ou Opus (ou PCM em MOV como alternativa), entre 128 e 320 kbps
- Também exporta o quadro atual em PNG, só o áudio em WAV e as legendas em SRT, e permite compartilhar pelo menu nativo

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173  (use --host para abrir no celular na mesma rede)
npm run build      # gera dist/ para hospedar em qualquer servidor estático HTTPS
```

No celular, abra a URL e use **Adicionar à tela inicial** para instalar como app.

Navegadores suportados: Chrome/Edge para Android e Safari 16.4+ no iOS. A exportação acelerada exige WebCodecs.

## Testes

```bash
npm run dev &      # servidor em 5173
npm test           # E2E em Chromium (emulação Pixel 7); gera as mídias de teste com ffmpeg
```

O teste percorre o fluxo completo: importar, prévia, reprodução, transição com som, efeitos, filtros, ajustes, velocidade, animação, máscara, dividir, desfazer e refazer, texto, legendas, música, batidas, sobreposição arrastada na prévia, persistência após recarregar e exportação. No fim, valida o MP4 gerado com o ffprobe e decodifica o arquivo inteiro.

## Arquitetura

- `src/engine/compositor.ts`: compositor WebGL, que monta as camadas, aplica cor, máscara, chroma key, efeitos, transições, mesclagem e legendas
- `src/engine/player.ts`: prévia em tempo real (elementos de mídia, grafo WebAudio, sons das transições)
- `src/engine/exporter.ts`: exportação quadro a quadro com decodificação WebCodecs (mediabunny) e mixagem offline
- `src/ai/*`: Whisper (worker), segmentação, silêncios, batidas, cenas, auto-cor
- `src/store/editor.ts`: estado com histórico e salvamento automático
