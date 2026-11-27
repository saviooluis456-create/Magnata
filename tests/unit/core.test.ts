import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCaptions } from '../../src/central/core/captions';
import { extractHashtags, filterHashtags, stripHashtags, tagKey } from '../../src/central/core/hashtags';
import { checkVideo, detectFormat } from '../../src/central/core/quality';

test('tagKey normalizes accents, case and symbols', () => {
  assert.equal(tagKey('#Crime Real!'), 'crimereal');
  assert.equal(tagKey('Séries'), 'series');
});

test('extract and strip hashtags (accents included)', () => {
  const t = 'O caso real por trás da série 😱\nContexto aqui.\n#TrueCrime #Séries #Duna';
  assert.deepEqual(extractHashtags(t), ['TrueCrime', 'Séries', 'Duna']);
  assert.equal(stripHashtags(t), 'O caso real por trás da série 😱\nContexto aqui.');
});

test('filter removes spam, generic, sensitive, duplicates and caps per network', () => {
  const r = filterHashtags(['fyp', 'Duna', 'duna', 'followforfollow', 'assassinato', 'filmes', 'series', 'cinema', 'scifi', 'denisvilleneuve', '2026'], { network: 'instagram' });
  assert.deepEqual(r.kept, ['Duna', 'filmes', 'series', 'cinema', 'scifi']);
  const reasons = Object.fromEntries(r.removed.map((x) => [x.tag, x.reason]));
  assert.match(reasons.fyp, /genérica/);
  assert.match(reasons.followforfollow, /spam/);
  assert.match(reasons.assassinato, /sensível/);
  assert.match(reasons['2026'], /números/);
  assert.match(reasons.denisvilleneuve, /limite de 5/);
  assert.equal(filterHashtags(['a1', 'b1', 'c1', 'd1'], { network: 'youtube' }).kept.length, 3);
});

test('priority tags come first and extra blocked tags are removed', () => {
  const r = filterHashtags(['filmes', 'spoiler'], { network: 'tiktok', priority: ['HarryPotterHBO'], extraBlocked: ['#spoiler'] });
  assert.deepEqual(r.kept, ['HarryPotterHBO', 'filmes']);
  assert.equal(r.removed[0].tag, 'spoiler');
});

test('buildCaptions adapts one text to the 3 networks', () => {
  const r = buildCaptions({
    text: 'Duna Parte 3: o que lembrar antes de ver\nTrês coisas que você esqueceu.\nVocê vai no cinema ou espera?\n#Duna #fyp #filmes #cinema',
    source: 'Variety',
    format: 'short',
  });
  assert.equal(r.captions.youtube.title, 'Duna Parte 3: o que lembrar antes de ver');
  assert.ok(!r.captions.youtube.description.includes('o que lembrar antes de ver'));
  assert.match(r.captions.instagram.caption, /FONTE: Variety\n\n#Duna #filmes #cinema$/);
  assert.ok(!r.captions.tiktok.caption.includes('#fyp'));
  assert.equal((r.captions.youtube.description.match(/#/g) ?? []).length, 3);
  assert.ok(r.captions.youtube.tags.includes('duna'));
  assert.equal(r.removed.instagram[0].tag, 'fyp');
});

test('detectFormat and quality checks', () => {
  assert.equal(detectFormat({ width: 1080, height: 1920, duration: 59 }), 'short');
  assert.equal(detectFormat({ width: 1080, height: 1920, duration: 200 }), 'long');
  assert.equal(detectFormat({ width: 1920, height: 1080, duration: 30 }), 'long');
  const good = checkVideo({ width: 1080, height: 1920, duration: 45, sizeBytes: 110e6, fps: 30, codec: 'avc' }, ['instagram', 'tiktok', 'youtube']);
  assert.ok(good.every((c) => c.level === 'ok'), JSON.stringify(good));
  const bad = checkVideo({ width: 540, height: 960, duration: 2, sizeBytes: 1e6, codec: 'vp9' }, ['instagram', 'tiktok']);
  assert.ok(bad.some((c) => c.level === 'erro' && /3 segundos/.test(c.message)));
  assert.ok(bad.some((c) => c.level === 'erro' && /Resolução baixa/.test(c.message)));
});
