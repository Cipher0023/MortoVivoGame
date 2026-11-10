// Gera, para o ilustrador, os materiais impressos do modo livro em impressos/:
//
//   simbolos-fase-N.svg  os 3 desenhos do código da página (ver `symbols` em
//                        src/config/phases.js). Vão num canto da página da
//                        fase: são a entrada de quem não consegue usar a câmera.
//   qr-livro.svg/.png    o QR code único do livro (contracapa ou guarda). Abre
//                        o endereço fixo /livro, que inicia a câmera.
//
// Uso:   npm run simbolos
//        npm run simbolos -- --url https://outro-endereco/livro
//
// Tamanho de impressão sugerido para os desenhos: pelo menos 1,5 cm de altura
// cada, sobre fundo claro, fora da ilustração principal (para não atrapalhar
// o reconhecimento da página pela câmera).

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { PHASES } from '../src/config/phases.js';
import { SYMBOLS } from '../src/config/symbols.js';

const OUT_DIR = new URL('../impressos/', import.meta.url);
const DEFAULT_URL = 'https://mortovivo.cristiancobra.com.br/livro';

const urlIndex = process.argv.indexOf('--url');
const bookUrl = urlIndex !== -1 ? process.argv[urlIndex + 1] : DEFAULT_URL;
if (!bookUrl) {
  console.error('Faltou o endereço depois de --url');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

// 3 desenhos lado a lado, cada um num quadrado branco com borda
const CELL = 120;
const GAP = 16;
for (const phase of PHASES.filter((p) => p.symbols)) {
  const width = phase.symbols.length * CELL + (phase.symbols.length - 1) * GAP;
  const cells = phase.symbols
    .map((id, i) => {
      const x = i * (CELL + GAP);
      return (
        `<g transform="translate(${x} 0)">` +
        `<rect x="2" y="2" width="${CELL - 4}" height="${CELL - 4}" rx="18" fill="#ffffff" stroke="#1a1a2e" stroke-width="4"/>` +
        `<g transform="translate(14 14) scale(${(CELL - 28) / 100})">${SYMBOLS[id].svg}</g></g>`
      );
    })
    .join('');
  const names = phase.symbols.map((id) => SYMBOLS[id].name).join(', ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CELL}" width="${width}" height="${CELL}">` +
    `<title>${phase.title}: ${names}</title>${cells}</svg>\n`;
  await writeFile(new URL(`simbolos-fase-${phase.number}.svg`, OUT_DIR), svg);
  console.log(`simbolos-fase-${phase.number}.svg: ${names}`);
}

// Correção de erro 'H' (~30%): lê mesmo com o papel amassado ou um dedo em cima.
const qrOptions = { errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
await writeFile(new URL('qr-livro.svg', OUT_DIR), await QRCode.toString(bookUrl, { ...qrOptions, type: 'svg' }));
await QRCode.toFile(fileURLToPath(new URL('qr-livro.png', OUT_DIR)), bookUrl, { ...qrOptions, width: 1024 });
console.log(`qr-livro.svg/.png: ${bookUrl}`);
