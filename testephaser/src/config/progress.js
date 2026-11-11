import { isGameMode } from './mode.js';

// Progresso da criança no livro, salvo no próprio celular (localStorage),
// sem cadastro. As fases liberam em sequência: a 1 está sempre liberada e
// cada uma das outras libera quando a anterior é concluída (as fases 1 e 2
// são tutoriais e a dificuldade é progressiva — ver o Game Design).
//
// Escanear a página de uma fase ainda trancada marca a fase como
// "encontrada" (para uma futura tela de progresso) e avisa que falta
// terminar a anterior.
//
// No modo jogo (?modo=jogo) tudo fica liberado, para testar.
// ?progresso=zerar apaga o progresso deste aparelho.

const STORAGE_KEY = 'mortovivo-progresso';

let state = load();

function load() {
  try {
    if (new URLSearchParams(window.location.search).get('progresso') === 'zerar') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return { found: saved?.found ?? [], completed: saved?.completed ?? [] };
  } catch {
    // localStorage indisponível (aba anônima etc.): progresso só nesta visita
    return { found: [], completed: [] };
  }
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignora: segue com o progresso só na memória
  }
}

function add(list, number) {
  if (!list.includes(number)) {
    list.push(number);
    save();
  }
}

export function isCompleted(number) {
  return state.completed.includes(number);
}

// A fase pode ser jogada? A 1 sempre; as outras, com a anterior concluída.
export function isUnlocked(phase) {
  if (isGameMode() || phase.number <= 1) return true;
  return isCompleted(phase.number - 1);
}

export function markFound(number) {
  add(state.found, number);
}

export function markCompleted(number) {
  add(state.found, number);
  add(state.completed, number);
}
