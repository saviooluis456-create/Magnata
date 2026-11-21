/** Lightweight keyword intelligence for captions (PT + EN): emoji suggestions and emphasis detection. */
const EMOJI: [string[], string][] = [
  [['dinheiro', 'grana', 'money', 'reais', 'dólar', 'dolar', 'dólares', 'rico', 'rica', 'ricos', 'lucro', 'salário', 'salario', 'pagar', 'pago', 'vender', 'venda', 'vendas', 'cash', 'rich', 'profit'], '💰'],
  [['fogo', 'quente', 'incrível', 'incrivel', 'top', 'fire', 'hot', 'insane', 'brabo', 'brabíssimo'], '🔥'],
  [['amor', 'amo', 'love', 'coração', 'coracao', 'apaixonado', 'apaixonada', 'paixão', 'heart'], '❤️'],
  [['rir', 'risada', 'engraçado', 'engracado', 'kkk', 'kkkk', 'haha', 'funny', 'lol', 'piada'], '😂'],
  [['triste', 'chorar', 'chorei', 'sad', 'cry', 'saudade'], '😢'],
  [['ideia', 'idéia', 'idea', 'dica', 'dicas', 'tip', 'segredo', 'secret', 'truque', 'hack'], '💡'],
  [['tempo', 'hora', 'horas', 'minuto', 'minutos', 'time', 'rápido', 'rapido', 'fast', 'agora', 'now'], '⏰'],
  [['mundo', 'world', 'global', 'planeta', 'terra'], '🌍'],
  [['sucesso', 'vencer', 'ganhar', 'win', 'winner', 'campeão', 'campeao', 'vitória', 'vitoria', 'success'], '🏆'],
  [['foguete', 'crescer', 'crescimento', 'growth', 'subir', 'decolar', 'rocket', 'escalar'], '🚀'],
  [['cérebro', 'cerebro', 'mente', 'pensar', 'brain', 'mind', 'inteligente', 'smart', 'estudo', 'estudar'], '🧠'],
  [['olha', 'veja', 'ver', 'look', 'see', 'olhar', 'atenção', 'atencao', 'watch'], '👀'],
  [['música', 'musica', 'music', 'som', 'cantar', 'song'], '🎵'],
  [['comida', 'comer', 'food', 'fome', 'delicioso', 'gostoso', 'eat'], '🍔'],
  [['academia', 'treino', 'treinar', 'gym', 'força', 'forca', 'músculo', 'strong'], '💪'],
  [['casa', 'home', 'lar', 'house'], '🏠'],
  [['carro', 'car', 'dirigir', 'drive'], '🚗'],
  [['celular', 'telefone', 'phone', 'app', 'aplicativo'], '📱'],
  [['câmera', 'camera', 'foto', 'vídeo', 'video', 'filmar', 'gravar'], '🎬'],
  [['perigo', 'cuidado', 'alerta', 'danger', 'warning', 'atenção!'], '⚠️'],
  [['não', 'nao', 'nunca', 'never', 'no', 'errado', 'erro', 'wrong'], '❌'],
  [['sim', 'certo', 'correto', 'yes', 'right', 'perfeito', 'perfect'], '✅'],
  [['estrela', 'star', 'brilhar', 'famoso', 'famosa', 'famous'], '⭐'],
  [['festa', 'party', 'comemorar', 'celebrar', 'parabéns', 'parabens'], '🎉'],
  [['surpresa', 'chocante', 'chocado', 'shock', 'wow', 'uau', 'nossa', 'meu deus'], '😱'],
  [['segredo', 'privado', 'secret'], '🤫'],
  [['negócio', 'negocio', 'empresa', 'business', 'trabalho', 'work', 'trabalhar', 'emprego'], '💼'],
  [['gráfico', 'grafico', 'dados', 'data', 'resultado', 'resultados', 'números', 'numeros'], '📈'],
  [['viagem', 'viajar', 'travel', 'avião', 'aviao', 'trip'], '✈️'],
  [['café', 'cafe', 'coffee'], '☕'],
  [['sol', 'sun', 'praia', 'beach', 'verão', 'verao'], '☀️'],
  [['dormir', 'sono', 'sleep', 'cansado', 'tired'], '😴'],
  [['louco', 'louca', 'crazy', 'maluco', 'doido'], '🤪'],
  [['pensando', 'pergunta', 'dúvida', 'duvida', 'question', 'porquê', 'porque', 'why'], '🤔'],
  [['bomba', 'explodir', 'boom', 'explosão'], '💥'],
  [['primeiro', 'primeira', 'first', 'número um', 'one'], '1️⃣'],
  [['alvo', 'meta', 'metas', 'objetivo', 'foco', 'goal', 'target', 'focus'], '🎯'],
  [['diamante', 'valioso', 'premium', 'diamond'], '💎'],
  [['rei', 'rainha', 'king', 'queen', 'coroa'], '👑'],
];

const NEGATIVE = new Set(['não', 'nao', 'nunca', 'never', 'erro', 'errado', 'problema', 'pior', 'perigo', 'cuidado', 'pare', 'stop', 'wrong', 'worst', 'mistake', 'ruim', 'péssimo', 'pessimo', 'morte', 'falha', 'fail', 'perder', 'perdi', 'lose']);

const POWER = new Set([
  'segredo', 'incrível', 'incrivel', 'sucesso', 'dinheiro', 'agora', 'grátis', 'gratis', 'melhor', 'único', 'unico', 'rápido', 'rapido',
  'fácil', 'facil', 'garantido', 'exclusivo', 'novo', 'nova', 'milhões', 'milhoes', 'milhão', 'milhao', 'mil', 'primeiro', 'primeira',
  'verdade', 'importante', 'simples', 'poderoso', 'resultado', 'resultados', 'vida', 'mudar', 'mudou', 'sonho', 'sonhos', 'rico', 'top',
  'free', 'best', 'secret', 'amazing', 'now', 'new', 'million', 'first', 'easy', 'fast', 'never', 'always', 'sempre', 'tudo', 'nada',
  'ninguém', 'ninguem', 'todos', 'viral', 'hack', 'dica', 'truque', 'chocante', 'insano', 'absurdo', 'impossível', 'impossivel',
  ...NEGATIVE,
]);

const emojiIndex = new Map<string, string>();
for (const [words, e] of EMOJI) for (const w of words) emojiIndex.set(w, e);

export const normalizeWord = (w: string) => w.toLowerCase().replace(/[.,!?;:"'“”‘’()[\]…]/g, '').trim();

export function emojiFor(word: string): string | undefined {
  return emojiIndex.get(normalizeWord(word));
}

/** 0 = normal, 1 = positive emphasis, 2 = negative emphasis */
export function emphasisOf(word: string): 0 | 1 | 2 {
  const n = normalizeWord(word);
  if (!n) return 0;
  if (/^[$€£r]*\$?\d/.test(n) || /^\d+[%x]?$/.test(n)) return 1;
  if (NEGATIVE.has(n)) return 2;
  if (POWER.has(n)) return 1;
  return 0;
}
