import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// "Salvar no jogo" do editor de música (só no npm run dev): grava a música
// em src/audio/songs/<id>.json. Só aceita pedidos do próprio computador — o
// servidor fica aberto na rede local (host: true) para testar no celular.
const SONGS_DIR = 'src/audio/songs';
const MAX_SONG_BYTES = 4 * 1024 * 1024;
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function saveSongPlugin() {
  return {
    name: 'mortovivo-salvar-musica',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__mortovivo/musica', (req, res) => {
        const reply = (status, text) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(text);
        };
        if (!LOCAL_ADDRESSES.has(req.socket.remoteAddress)) return reply(403, 'só no próprio computador');
        if (req.method !== 'POST') return reply(405, 'use POST');
        const id = new URL(req.url, 'http://localhost').searchParams.get('id') ?? '';
        if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) return reply(400, 'nome inválido');

        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size <= MAX_SONG_BYTES) chunks.push(chunk);
        });
        req.on('end', async () => {
          if (size > MAX_SONG_BYTES) return reply(413, 'arquivo grande demais');
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            const song = JSON.parse(text);
            if (!Array.isArray(song?.patterns) || !Array.isArray(song?.order)) throw new Error();
          } catch {
            return reply(400, 'não é uma música válida');
          }
          try {
            const dir = path.join(server.config.root, SONGS_DIR);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, `${id}.json`), text);
            reply(200, 'ok');
          } catch (err) {
            reply(500, err.message);
          }
        });
      });
    },
  };
}

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
    plugins: phone ? [basicSsl(), saveSongPlugin()] : [saveSongPlugin()],
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
