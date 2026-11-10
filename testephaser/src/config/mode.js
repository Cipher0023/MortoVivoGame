// Dois modos de abrir o mesmo app:
//
// MODO LIVRO (padrão, o que o leitor vê): o livro é a porta de entrada. Não há
// menu nem escolha de fase: a criança toca em Começar, aponta a câmera para
// uma página (realidade aumentada) e joga a fase daquela página. Quem não
// consegue usar a câmera digita os desenhos impressos na página. Sem o livro,
// não dá para jogar.
//
// MODO JOGO (oculto, para quem desenvolve): menu principal, tutorial, leitor
// de QR, links ?fase=<código> e editor. É a base para uma versão "jogo" do
// projeto no futuro. Liga de dois jeitos:
//   - no navegador: abra o site com ?modo=jogo (fica lembrado neste aparelho;
//     ?modo=livro desliga);
//   - no build: VITE_MODO=jogo npx vite build (publica o jogo como padrão).
// O editor continua abrindo direto por ?scene=editor.

const STORAGE_KEY = 'mortovivo-modo';

let gameMode = import.meta.env.VITE_MODO === 'jogo';

// Lê ?modo= da URL e o que ficou lembrado. Chamar uma vez, antes da 1ª cena.
export function initMode() {
  const fromUrl = new URLSearchParams(window.location.search).get('modo');
  try {
    if (fromUrl === 'jogo' || fromUrl === 'livro') window.localStorage.setItem(STORAGE_KEY, fromUrl);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) gameMode = saved === 'jogo';
  } catch {
    // localStorage indisponível (aba anônima etc.): vale só a URL
    if (fromUrl) gameMode = fromUrl === 'jogo';
  }
}

export function isGameMode() {
  return gameMode;
}

// Primeira tela: o menu do jogo ou a tela "Começar" do livro.
export function homeSceneKey() {
  return gameMode ? 'MainMenu' : 'Inicio';
}

// Onde se escolhe a próxima fase: leitor de QR (jogo) ou câmera de AR (livro).
export function scanSceneKey() {
  return gameMode ? 'Scan' : 'ArScan';
}
