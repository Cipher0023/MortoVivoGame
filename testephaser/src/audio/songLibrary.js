import { isValidSong, normalizeSong } from './music/song.js';

// Músicas do jogo: arquivos .json salvos pelo editor de música e colocados
// em src/audio/songs/ (ex.: fase1.json). O id da música é o nome do arquivo;
// em config/phases.js cada fase diz qual música toca (`music: 'fase1'`).
//
// A lista fica guardada fora do módulo (globalThis) e o módulo aceita a
// própria atualização: com `npm run dev`, salvar uma música pelo editor
// ("Salvar no jogo") grava o arquivo e o jogo já a conhece, sem recarregar
// a página e sem perder o que estava aberto.
const FILES = import.meta.glob('./songs/*.json', { eager: true, import: 'default' });

const library = (globalThis.__mortovivoSongs ??= new Map());

for (const [path, data] of Object.entries(FILES)) {
  const id = path.slice('./songs/'.length, -'.json'.length);
  if (isValidSong(data)) {
    library.set(id, normalizeSong(data));
  } else {
    console.error(`Música "${id}.json" com formato inválido — abra e salve de novo no editor de música.`);
  }
}

if (import.meta.hot) import.meta.hot.accept();

export function getSong(id) {
  return library.get(id) ?? null;
}

export function listSongIds() {
  return [...library.keys()].sort();
}

// O editor registra a música que acabou de salvar (vale até recarregar).
export function registerSong(id, song) {
  library.set(id, normalizeSong(song));
}
