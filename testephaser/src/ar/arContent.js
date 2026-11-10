// O conteúdo da realidade aumentada, todo em testephaser/ar/ (ver o README de
// lá): as páginas compiladas, o que aparece sobre cada uma e os quadros das
// animações. O Vite empacota esses arquivos no build, então trocar uma
// animação ou acrescentar uma página não exige mexer em código.

import targetsUrl from '../../ar/alvos/targets.mind?url';
import targets from '../../ar/alvos/alvos.json';
import scenes from '../../ar/cenas.json';

// { 'guri-andando': [url01, url02, ...], ... } — quadros em ordem de nome
const FRAME_FILES = import.meta.glob('../../ar/animacoes/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const animations = {};
for (const path of Object.keys(FRAME_FILES).sort()) {
  const [, name] = path.match(/animacoes\/([^/]+)\//);
  (animations[name] ??= []).push(FRAME_FILES[path]);
}

export { targetsUrl, targets, scenes, animations };
