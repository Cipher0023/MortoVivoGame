// Música do jogo: uma música por vez, tocada pelo MusicPlayer (formato de
// tracker, ver music/song.js). As cenas só chamam playMusic/stopMusic.
//
// A música sai pela mesma saída do Phaser que os efeitos: o botão de som
// (mudo) do jogo vale para os dois.

import MusicPlayer from './music/MusicPlayer.js';
import { getSong } from './songLibrary.js';

// volume da música em relação aos efeitos sonoros
const MUSIC_VOLUME = 0.55;
const DEFAULT_FADE = 0.6;

const players = new WeakMap(); // Phaser.Game -> { player, songId }

// O tocador único do jogo (null sem Web Audio: o jogo segue sem música).
export function getMusicPlayer(game) {
  const context = game.sound.context;
  if (!context) return null;
  let entry = players.get(game);
  if (!entry || entry.player.ctx !== context) {
    entry?.player.dispose();
    const player = new MusicPlayer(context, game.sound.destination);
    player.setVolume(MUSIC_VOLUME);
    entry = { player, songId: null };
    players.set(game, entry);
  }
  return entry.player;
}

// Toca a música `id` (de src/audio/songs/). Se ela já está tocando, continua
// de onde está (morrer e recomeçar a fase não reinicia a música). Trocar de
// música abaixa a anterior antes de começar a nova.
export function playMusic(scene, id, { fade = DEFAULT_FADE } = {}) {
  const game = scene.sys.game;
  const player = getMusicPlayer(game);
  if (!player) return;
  const entry = players.get(game);
  if (!id) {
    stopMusic(scene, { fade });
    return;
  }
  if (entry.songId === id && player.isPlaying) return;
  const song = getSong(id);
  if (!song) {
    // fase sem música composta ainda: silêncio
    stopMusic(scene, { fade });
    return;
  }
  const wasPlaying = player.isPlaying;
  if (wasPlaying) player.stop(fade);
  entry.songId = id;
  const token = (entry.token = (entry.token ?? 0) + 1);
  const startedAt = performance.now();
  // instrumentos gravados: baixa antes de começar (só na 1ª vez; depois
  // ficam guardados)
  player.prepare(song).then(() => {
    if (entry.token !== token || entry.songId !== id) return; // trocou de música no meio
    player.onEnd = () => {
      entry.songId = null;
    };
    player.load(song);
    // música nova começa com todas as camadas (canais) ligadas
    for (let ch = 0; ch < song.channels.length; ch++) player.setChannelMuted(ch, false, 0.01);
    const waited = (performance.now() - startedAt) / 1000;
    player.play({ delay: wasPlaying ? Math.max(0, fade - waited) : 0, fadeIn: 0.05 });
  });
}

export function stopMusic(scene, { fade = DEFAULT_FADE } = {}) {
  const game = scene.sys.game;
  const player = players.get(game)?.player;
  if (!player) return;
  const entry = players.get(game);
  entry.songId = null;
  entry.token = (entry.token ?? 0) + 1; // cancela uma música que ainda estava carregando
  player.stop(fade);
}

// Camadas da música: liga/desliga canais durante o jogo (ex.: bateria só
// quando um inimigo está perto). `on` = true toca o canal.
export function setMusicChannel(scene, channel, on, fade = 0.4) {
  players.get(scene.sys.game)?.player.setChannelMuted(channel, !on, fade);
}

// O editor de música usa o mesmo tocador: some com a música do jogo.
export function releaseMusicForEditor(game) {
  const entry = players.get(game);
  if (entry) {
    entry.songId = null;
    entry.token = (entry.token ?? 0) + 1;
  }
  return getMusicPlayer(game);
}
