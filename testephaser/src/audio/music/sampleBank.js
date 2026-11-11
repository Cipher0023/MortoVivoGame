// Banco de instrumentos gravados (amostras), como o chip de som do SNES:
// cada instrumento tem algumas notas gravadas (zonas) e a engine afina a
// zona mais próxima para a nota pedida. Os sustentados têm um trecho que se
// repete (loop) enquanto a nota estiver ligada.
//
// O banco é gerado por scripts/gerar-banco-instrumentos.mjs (npm run banco)
// a partir de bibliotecas CC0: arquivos em public/assets/music/instrumentos/
// e o índice em instrumentBank.json. No arquivo da música, o timbre de um
// instrumento do banco é "bank:<id>" (ex.: "bank:cordas").
//
// Os arquivos só são baixados quando uma música (ou o editor) usa o
// instrumento.

import BANK from './instrumentBank.json' with { type: 'json' };

const BASE_URL = `${import.meta.env?.BASE_URL ?? '/'}assets/music/instrumentos/`;
const BANK_PREFIX = 'bank:';

export const BANK_INSTRUMENTS = BANK.instruments;
const BY_ID = new Map(BANK_INSTRUMENTS.map((entry) => [entry.id, entry]));

// AudioContext -> Map(arquivo -> AudioBuffer | Promise)
const cache = new WeakMap();

export function bankWave(id) {
  return `${BANK_PREFIX}${id}`;
}

export function bankIdOf(wave) {
  return typeof wave === 'string' && wave.startsWith(BANK_PREFIX) ? wave.slice(BANK_PREFIX.length) : null;
}

export function bankEntry(wave) {
  return BY_ID.get(bankIdOf(wave) ?? wave) ?? null;
}

function buffersOf(ctx) {
  let map = cache.get(ctx);
  if (!map) cache.set(ctx, (map = new Map()));
  return map;
}

async function loadZone(ctx, file) {
  const map = buffersOf(ctx);
  if (map.has(file)) return map.get(file);
  const promise = fetch(BASE_URL + file)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      map.set(file, buffer);
      return buffer;
    })
    .catch((err) => {
      // sem o arquivo, a nota desse instrumento fica muda (o resto toca)
      console.warn(`Instrumento: não carregou ${file} (${err.message})`);
      map.delete(file);
      return null;
    });
  map.set(file, promise);
  return promise;
}

// Baixa as zonas do instrumento do banco (ex.: 'bank:cordas').
export function loadBankInstrument(ctx, wave) {
  const entry = bankEntry(wave);
  if (!entry) return Promise.resolve();
  return Promise.all(entry.zones.map((zone) => loadZone(ctx, zone.file))).then(() => {});
}

// Baixa todos os instrumentos do banco que a música usa.
export function loadSongSamples(ctx, song) {
  const waves = new Set((song?.instruments ?? []).map((inst) => inst.wave).filter((wave) => bankIdOf(wave)));
  return Promise.all([...waves].map((wave) => loadBankInstrument(ctx, wave))).then(() => {});
}

// A zona carregada mais próxima da nota: { zone, buffer, entry } ou null.
export function zoneFor(ctx, wave, note) {
  const entry = bankEntry(wave);
  if (!entry) return null;
  const map = buffersOf(ctx);
  let best = null;
  for (const zone of entry.zones) {
    const buffer = map.get(zone.file);
    if (!buffer || typeof buffer.then === 'function') continue; // ainda baixando
    // na dúvida entre duas zonas, prefere a de cima: transpor para baixo
    // soa mais natural que esticar uma nota grave para cima
    const distance = Math.abs(note - zone.root) - (zone.root > note ? 0.01 : 0);
    if (!best || distance < best.distance) best = { zone, buffer, entry, distance };
  }
  return best;
}
