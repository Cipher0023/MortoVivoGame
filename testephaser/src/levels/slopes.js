import { OBJECT_MANIFEST } from '../config/assetManifest.js';
import { SLOPE } from '../config/constants.js';

// Rampas: objetos do manifesto com `slope: true`. A física Arcade só tem
// caixas, então a rampa não é um corpo: a cada quadro a PlayScene "apoia"
// quem está em cima na superfície inclinada (ver PlayScene.updateSlopes).
// A inclinação sai da área da peça na grade (largura x altura), então mudar
// o tamanho no editor muda o ângulo e o efeito. Desenho padrão: sobe pra
// direita; espelhada (H no editor) sobe pra esquerda.

const SLOPE_KEYS = new Set(OBJECT_MANIFEST.filter((o) => o.slope).map((o) => o.key));

export function isSlopeKey(key) {
  return SLOPE_KEYS.has(key);
}

// area: { c0, c1, r0, r1 } em células.
export function slopeFromArea(area, tileSize, flipX) {
  const x0 = area.c0 * tileSize;
  const x1 = (area.c1 + 1) * tileSize;
  const yTop = area.r0 * tileSize;
  const yBottom = (area.r1 + 1) * tileSize;
  const deg = (Math.atan2(yBottom - yTop, x1 - x0) * 180) / Math.PI;
  let kind = 'medium';
  if (deg <= SLOPE.EASY_MAX_DEG) kind = 'easy';
  else if (deg >= SLOPE.STEEP_MIN_DEG) kind = 'steep';
  // up: pra que lado se sobe (1 = direita)
  return { x0, x1, yTop, yBottom, up: flipX ? -1 : 1, deg, kind };
}

// y da superfície no x (preso às pontas da rampa).
export function surfaceY(slope, x) {
  const t = Math.min(Math.max((x - slope.x0) / (slope.x1 - slope.x0), 0), 1);
  const rise = slope.up > 0 ? t : 1 - t;
  return slope.yBottom - rise * (slope.yBottom - slope.yTop);
}

// Onde o corpo se apoia: a quina do lado de subida (senão, no topo, a quina
// da frente ficaria abaixo do nível do chão seguinte e travaria nele).
export function supportY(slope, body) {
  const x = slope.up > 0 ? Math.min(body.right, slope.x1) : Math.max(body.left, slope.x0);
  return surfaceY(slope, x);
}

// 0 no pé da rampa, 1 no topo.
export function slopeProgress(slope, body) {
  return (slope.yBottom - body.bottom) / (slope.yBottom - slope.yTop);
}

// Velocidade horizontal na rampa, a partir da que o personagem quer (vx).
// wasSliding: já estava escorregando nesta rampa (escorrega até o pé dela,
// sem retomar a subida no meio). Retorna { vx, sliding }: sliding =
// escorregando (sem apoio pra pular, e o controle não vale).
export function slopeVelocity(slope, body, vx, wasSliding = false) {
  const uphill = vx !== 0 && Math.sign(vx) === slope.up;
  if (slope.kind === 'easy') return { vx, sliding: false };
  if (slope.kind === 'medium') return { vx: uphill ? vx * SLOPE.MEDIUM_FACTOR : vx, sliding: false };

  // íngreme: subindo, perde velocidade conforme sobe até parar; parado, sem
  // força pra subir ou depois de parar uma vez, escorrega até lá embaixo
  if (uphill && !wasSliding) {
    const left = 1 - slopeProgress(slope, body) / SLOPE.STEEP_STALL_AT;
    const factor = SLOPE.STEEP_START_FACTOR * left;
    if (factor > SLOPE.STEEP_MIN_FACTOR) return { vx: vx * factor, sliding: false };
  }
  return { vx: -slope.up * SLOPE.SLIDE_SPEED, sliding: true };
}
