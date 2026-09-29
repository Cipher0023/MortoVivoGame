import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Dois jeitos de rodar:
//   npm run dev          HTTP em http://localhost:5173 — o normal no computador
//                        (a câmera funciona em localhost mesmo sem HTTPS)
//   npm run dev:celular  HTTPS em https://<ip-da-rede>:5174 — pra testar o
//                        leitor de QR no celular: fora do localhost o navegador
//                        só libera a câmera em HTTPS. O certificado é
//                        autoassinado: na 1ª visita, "Avançado" → "Continuar".
export default defineConfig(({ mode }) => {
  const phone = mode === 'celular';
  return {
    plugins: phone ? [basicSsl()] : [],
    // cache separado: os dois servidores rodando juntos não brigam pelo mesmo
    // cache de dependências (senão um recarrega a página do outro)
    cacheDir: phone ? 'node_modules/.vite-celular' : 'node_modules/.vite',
    server: {
      port: phone ? 5174 : 5173,
      host: true, // expõe na rede local, pra abrir no celular
      open: false,
    },
  };
});
