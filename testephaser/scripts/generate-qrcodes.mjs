// Gera os QR codes das fases (a partir de src/config/phases.js) em qrcodes/:
//   fase-N.svg  vetor — é este que vai pra gráfica/diagramação do livro
//   fase-N.png  1024px — pra conferir na tela ou testar com o celular
//
// Uso:
//   npm run qrcodes                                  QR com o código puro
//   npm run qrcodes -- --base-url https://site.com   QR com link pro site
//
// Com --base-url o QR vira um link (https://site.com/?fase=<código>): a
// câmera nativa do celular também abre o jogo direto na fase. Só use depois
// que o site tiver endereço definitivo — o link fica impresso no livro.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { PHASES } from '../src/config/phases.js';

const OUT_DIR = new URL('../qrcodes/', import.meta.url);

const baseUrlIndex = process.argv.indexOf('--base-url');
const baseUrl = baseUrlIndex !== -1 ? process.argv[baseUrlIndex + 1] : null;
if (baseUrlIndex !== -1 && !baseUrl) {
  console.error('Faltou o endereço depois de --base-url');
  process.exit(1);
}

// Correção de erro 'H' (~30%): o QR continua lendo mesmo com o papel
// amassado, sujo ou parcialmente coberto por um dedo.
const options = { errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } };

await mkdir(OUT_DIR, { recursive: true });

for (const phase of PHASES) {
  const content = baseUrl ? `${baseUrl.replace(/\/$/, '')}/?fase=${phase.code}` : phase.code;
  const name = `fase-${phase.number}`;
  await writeFile(new URL(`${name}.svg`, OUT_DIR), await QRCode.toString(content, { ...options, type: 'svg' }));
  await QRCode.toFile(fileURLToPath(new URL(`${name}.png`, OUT_DIR)), content, { ...options, width: 1024 });
  console.log(`${name}: ${content}`);
}
