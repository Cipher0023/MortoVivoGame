// Compila as páginas de ar/paginas/ no arquivo de alvos do MindAR
// (ar/prototipo/targets.mind) e desenha, para cada página, o mapa dos pontos
// que o celular usa para reconhecê-la (rosa) e acompanhá-la (azul).
// Rode pelo compilar-alvos.sh, que monta o Node com as dependências.

import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';
import { loadImage, createCanvas } from 'canvas';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';

const PAGES_DIR = 'ar/paginas';
const TARGETS_FILE = 'ar/prototipo/targets.mind';
const LIST_FILE = 'ar/prototipo/alvos.json';
const MAPS_DIR = 'ar/ferramentas/.cache/mapas';
// O MindAR reduz a imagem por dentro de qualquer jeito; acima disso só deixa
// a compilação lenta e o arquivo maior.
const MAX_SIDE = 1024;

// fase1.png, fase-1.jpg, Fase_2.PNG... → número da fase
const PAGE_NAME = /^fase[-_ ]?(\d+)\.(png|jpe?g)$/i;

const pages = readdirSync(PAGES_DIR)
  .map((file) => ({ file, match: file.match(PAGE_NAME) }))
  .filter(({ match }) => match)
  .map(({ file, match }) => ({ file, phase: Number(match[1]) }))
  .sort((a, b) => a.phase - b.phase);

if (pages.length === 0) {
  console.error(`Nenhuma página em ${PAGES_DIR}/ (nomes como fase1.png ou fase-1.jpg).`);
  process.exit(1);
}

const images = [];
for (const page of pages) {
  const original = await loadImage(`${PAGES_DIR}/${page.file}`);
  const scale = Math.min(1, MAX_SIDE / Math.max(original.width, original.height));
  const canvas = createCanvas(Math.round(original.width * scale), Math.round(original.height * scale));
  canvas.getContext('2d').drawImage(original, 0, 0, canvas.width, canvas.height);
  images.push(canvas);
}

const compiler = new OfflineCompiler();
let lastShown = -10;
await compiler.compileImageTargets(images, (percent) => {
  if (percent - lastShown >= 10) {
    lastShown = percent;
    process.stdout.write(`\rcompilando... ${percent.toFixed(0)}%`);
  }
});
process.stdout.write('\n\n');

writeFileSync(TARGETS_FILE, Buffer.from(compiler.exportData()));
// a ordem das páginas no targets.mind é o índice do alvo no MindAR;
// height: altura da página em larguras (o MindAR usa largura 1)
const list = pages.map(({ phase }, i) => ({ phase, height: +(images[i].height / images[i].width).toFixed(4) }));
writeFileSync(LIST_FILE, JSON.stringify(list, null, 2) + '\n');
mkdirSync(MAPS_DIR, { recursive: true });

pages.forEach((page, i) => {
  const data = compiler.data[i];
  const image = images[i];
  const matching = data.matchingData[0];
  const tracking = data.trackingData[0];
  const smallest = data.matchingData.at(-1);

  const map = createCanvas(image.width, image.height);
  const ctx = map.getContext('2d');
  ctx.drawImage(image, 0, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(0, 0, map.width, map.height);
  const matchingScale = image.width / matching.width;
  ctx.fillStyle = '#e0006a';
  for (const p of [...matching.maximaPoints, ...matching.minimaPoints]) {
    ctx.beginPath();
    ctx.arc(p.x * matchingScale, p.y * matchingScale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const trackingScale = image.width / tracking.width;
  ctx.strokeStyle = '#0050ff';
  ctx.lineWidth = 3;
  for (const p of tracking.points) {
    ctx.beginPath();
    ctx.arc(p.x * trackingScale, p.y * trackingScale, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  const mapFile = `${MAPS_DIR}/fase${page.phase}-pontos.png`;
  writeFileSync(mapFile, map.toBuffer('image/png'));

  const count = (m) => m.maximaPoints.length + m.minimaPoints.length;
  console.log(`Fase ${page.phase} (${page.file}, alvo ${i})`);
  console.log(`  reconhecer:   ${count(matching)} pontos (${count(smallest)} com a página pequena na tela)`);
  console.log(`  acompanhar:   ${tracking.points.length} pontos`);
  console.log(`  mapa:         ${mapFile}`);
});

console.log(`\nGerados ${TARGETS_FILE} e ${LIST_FILE}.`);
