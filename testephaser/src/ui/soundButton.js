import { createSmallButton } from './Button.js';
import { isMuted, toggleMute } from '../audio/sfx.js';

// Botão "Som: ligado/desligado" (menu e HUD), ancorado pela direita como os
// outros botões pequenos.
export function addSoundButton(scene, rightX, y, fontSize) {
  const label = () => (isMuted() ? 'Som: desligado' : 'Som: ligado');
  const button = createSmallButton(scene, rightX, y, label(), fontSize, () => {
    toggleMute(scene);
    button.setText(label());
  });
  return button;
}
