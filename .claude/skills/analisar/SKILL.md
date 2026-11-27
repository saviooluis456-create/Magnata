---
name: analisar
description: Análise de desempenho e estratégia do perfil Luiz no Set. Puxa os dados de todos os vídeos nas três redes, calcula o Índice Set, o que funciona (com confiança estatística e alerta de fatores misturados), avalia os experimentos A/B, compara com concorrentes e reescreve o playbook dinâmico. Use para "analisar", "análise da semana", "estratégia", "o que está funcionando", "por que esse vídeo bombou/flopou" ou "atualizar o playbook".
---

# Analisar: o cérebro do Luiz no Set

Objetivo: cada semana, o perfil fica mais inteligente. Os dados entram, as regras do `perfil-entretenimento/08-playbook.md` mudam, e os próximos roteiros já saem melhores.

**Método (não negociável):**
- Nada vira regra com base em 1 ou 2 vídeos. Confiança fraca = experimento, não regra.
- Correlação não é causa. Se dois fatores andam sempre juntos (o script marca "misturado com"), proponha um teste que os separe.
- Compare sempre com a mediana do próprio perfil na mesma rede e formato (Índice Set), nunca views brutas entre redes.
- Vídeos com menos de 48h não entram nas comparações (ainda estão crescendo). Use-os só no "decolando agora".
- Cite números como evidência. Não invente dados.

## 1. Coletar
1. Windsor (`Windsor_ai_for_Social_Media`): `get_connectors`, e use **só** as contas do Luiz no Set (nunca "Laudo Noturno").
2. Para cada rede (instagram, tiktok_organic, youtube): `get_fields` e depois `get_data` dos vídeos dos últimos 90 dias. Campos: id, título/legenda, data de publicação, duração, views/plays, curtidas, comentários, compartilhamentos, salvos, tempo médio assistido / % assistido, seguidores ganhos.
3. Associe cada vídeo ao roteiro em `perfil-entretenimento/roteiros/` (pelo título, gancho ou legenda) para pegar **editoria, tipo de gancho e experimento/variante** do cabeçalho. Sem roteiro: classifique a editoria pelo conteúdo e deixe o gancho em branco.
4. Se a Central do Set estiver no ar, o usuário pode colar o resultado de "Copiar para o Claude" (aba Inteligência). Use-o junto.

## 2. Calcular (mesmo motor da Central)
1. Salve os dados no formato descrito no topo de `scripts/analisar.ts` em `perfil-entretenimento/analises/dados-AAAA-MM-DD.json`. Salve os experimentos ativos do playbook em `experimentos.json`.
2. Rode: `npm run -s analisar -- perfil-entretenimento/analises/dados-AAAA-MM-DD.json perfil-entretenimento/analises/experimentos.json`
3. Leia o resultado: ranking do Índice Set, efeitos por dimensão (editoria, gancho, duração, horário, dia, legenda, hashtags) com IC de 90% e confiança, alertas de fatores misturados e veredito de cada experimento.

## 3. Olhar para fora
- Concorrentes e referências (Carol Moreira, Omelete, Jovem Nerd, Ei Nerd, Pipocando e outros que o usuário indicar): pesquise o que viralizou neles nos últimos 30 dias (temas, formato de título, duração). Se a Central estiver no ar, a aba Inteligência já traz isso do YouTube.
- Tendências do nicho da semana (a mesma varredura do `pesquisar`, mais curta).

## 4. Decidir
1. **Diagnóstico:** de 3 a 5 achados, cada um com número e confiança.
2. **Playbook:** reescreva `perfil-entretenimento/08-playbook.md` com versão nova:
   - promova a ativa o que tem confiança forte ou experimento vencido;
   - aposente o que os dados contradizem, dizendo por quê;
   - mantenha em teste o que ainda é hipótese;
   - de 6 a 15 regras, concretas para quem escreve roteiro.
   Atualize a tabela de experimentos (conclua os decididos e crie no máximo 2 novos, cada um mudando uma coisa só) e o mix de editorias da semana. Acrescente uma linha no Histórico.
3. **Ações da semana:** até 5, cada uma com como medir.
4. Salve o relatório em `perfil-entretenimento/analises/AAAA-MM-DD.md` (diagnóstico, tabelas do script, ações).

## 5. Entregar
- No chat: resumo curto (o que funcionou, o que mudou no playbook, os testes da semana).
- Se o usuário quiser um relatório visual ou para compartilhar, publique como artifact.
- Faça commit e push do playbook e da análise no branch de trabalho.
- Com menos de 10 vídeos maduros, diga claramente que a amostra é pequena e que as mudanças são provisórias.
