import * as THREE from 'three';

// Os personagens animados que aparecem sobre a página reconhecida. O que
// aparece em cada página vem do ar/cenas.json (opções explicadas em
// ar/animacoes/README.md). Medidas em "larguras de página": o MindAR põe a
// página com largura 1, centro na origem, x pra direita, y pra cima e z
// saindo do papel.

export const ACTOR_DEFAULTS = {
  movimento: 'parado',
  altura: 0.36,
  x: 0,
  y: -0.28,
  fps: 12,
  distancia: 0.3,
  velocidade: 0.16,
  espelhar: false,
  sombra: true,
};
const POP_MS = 450;
const MAX_TILT = THREE.MathUtils.degToRad(80);

// Carrega os quadros das animações citadas em `scenes`, cada uma uma vez.
// Rejeita se faltar um quadro: quem chama mostra o erro.
export async function loadAnimations(scenes, animations) {
  const loader = new THREE.TextureLoader();
  const names = new Set(Object.values(scenes).flat().map((config) => config.animacao));
  const loaded = {};
  await Promise.all(
    [...names].map(async (name) => {
      const urls = animations[name];
      if (!urls?.length) {
        console.warn(`Animação "${name}" não encontrada em ar/animacoes/.`);
        return;
      }
      loaded[name] = await Promise.all(
        urls.map(async (url) => {
          const texture = await loader.loadAsync(url);
          texture.colorSpace = THREE.SRGBColorSpace;
          return texture;
        })
      );
    })
  );
  return loaded;
}

// Um personagem: quadros em sequência num plano apoiado nos pés, que gira em
// torno deles pra ficar de frente pra câmera. Com o celular inclinado ele fica
// em pé; de frente pra página, deita sobre ela em vez de virar um risco.
// `appear.at`: quando a página foi achada (o personagem "salta" do papel).
export function buildActor(rawConfig, frames, anchor, camera, appear) {
  const config = { ...ACTOR_DEFAULTS, ...rawConfig };
  const { image } = frames[0];
  const height = config.altura;
  const width = height * (image.width / image.height);
  const flip = config.espelhar ? -1 : 1;

  const stage = new THREE.Group();
  anchor.group.add(stage);

  if (config.sombra) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
    );
    shadow.scale.set(width * 0.9, height * 0.12, 1);
    shadow.position.z = 0.002;
    stage.add(shadow);
  }

  const material = new THREE.MeshBasicMaterial({
    map: frames[0],
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(0, height / 2, 0);
  const sprite = new THREE.Mesh(geometry, material);
  sprite.position.z = 0.003;
  stage.add(sprite);

  const walks = config.movimento === 'andar';
  const cameraLocal = new THREE.Vector3();
  let offset = walks ? -config.distancia : 0;
  let dir = 1;
  let frameTime = 0;

  return {
    update(dt) {
      if (!anchor.visible) return;

      if (walks) {
        offset += dir * config.velocidade * dt;
        if (Math.abs(offset) > config.distancia) {
          offset = Math.sign(offset) * config.distancia;
          dir = -dir;
        }
      }
      stage.position.set(config.x + offset, config.y, 0);

      frameTime += dt;
      material.map = frames[Math.floor(frameTime * config.fps) % frames.length];
      // os quadros olham pra direita; andando pra esquerda, espelha
      sprite.scale.x = dir * flip;

      // inclinação: 0 = deitado na página, 90° = em pé. Segue a direção da
      // câmera vista de lado (plano y-z da página), suavizada contra tremor.
      // Ângulo negativo (câmera além do topo da página) fica em 0: girar
      // pro outro lado enfiaria o personagem dentro do papel.
      cameraLocal.copy(camera.position);
      anchor.group.worldToLocal(cameraLocal);
      const tilt = Math.atan2(-(cameraLocal.y - config.y), cameraLocal.z);
      const target = THREE.MathUtils.clamp(tilt, 0, MAX_TILT);
      sprite.rotation.x += (target - sprite.rotation.x) * Math.min(1, dt * 8);

      const t = Math.min(1, (performance.now() - appear.at) / POP_MS);
      stage.scale.setScalar(Math.max(0.001, t < 1 ? easeOutBack(t) : 1));
    },
  };
}

// borda rosa da página reconhecida (?debug=1)
export function pageBorder(pageHeight) {
  const top = pageHeight / 2;
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -top, 0),
      new THREE.Vector3(0.5, -top, 0),
      new THREE.Vector3(0.5, top, 0),
      new THREE.Vector3(-0.5, top, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0xe0006a })
  );
}

function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
