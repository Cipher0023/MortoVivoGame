# Deploy no COBRA Server — mortovivo.cristiancobra.com.br

Como publicar o jogo (`testephaser/`) em https://mortovivo.cristiancobra.com.br,
no servidor do Cristian. O deploy em `cubic-dev.com/gamemortovivo/` (VPS
Hostinger) está em `deploy-producao.md` e é independente deste.

**Endereço de produção:** https://mortovivo.cristiancobra.com.br

## Visão geral

O jogo é um **site estático**: o Vite gera HTML, JS, imagens e sons na pasta
`testephaser/dist/`, e essa pasta é copiada para o servidor. Lá, o nginx serve
os arquivos. Não há servidor Node, banco de dados nem processo rodando para o
jogo.

```
máquina local                          COBRA Server (VPS do Cristian)
─────────────                          ──────────────────────────────
npx vite build
        │
        ▼
testephaser/dist/  ── rsync (SSH) ──▶  ~/deploy/mortovivo/   (staging)
                                               │ sudo rsync
                                               ▼
                                       /var/www/mortovivo/
                                               │
                                               ▼
                               nginx: mortovivo.cristiancobra.com.br
```

| Item | Valor |
|------|-------|
| Servidor | COBRA Server, acessado pelo apelido SSH `cobra` |
| Pasta publicada | `/var/www/mortovivo/` |
| Config do nginx | `/etc/nginx/sites-available/mortovivo.cristiancobra.com.br` |
| HTTPS | Let's Encrypt (certbot, renovação automática) |
| Subcaminho (base) | `/` (o jogo fica na raiz do subdomínio) |

Os dados de acesso ao servidor (IP, usuário, chave) **não ficam neste
repositório**, que é público. Quem publica precisa ter o apelido `cobra`
configurado no `~/.ssh/config` e permissão de `sudo` no servidor.

## Pré-requisitos (uma vez só, na máquina que vai publicar)

1. **Node e dependências:** `cd testephaser && npm install`. Sem Node
  instalado, dá para rodar tudo pelo Docker:

   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app node:22-alpine \
     sh -c 'npm ci && npx vite build'
   ```

2. **rsync** instalado (`sudo apt install rsync` no Linux).
3. **Acesso SSH ao servidor** pelo apelido `cobra`. Teste com
  `ssh cobra "echo ok"`.

## Passo a passo do deploy

Rode tudo a partir da pasta `testephaser/`.

### 1. Commit do que vai subir

```bash
git status          # deve estar limpo
git log --oneline -1
```

Publique sempre a partir de um commit que já esteja no GitHub
(`Cipher0023/MortoVivoGame`). Assim, o que está no ar corresponde a algo que
existe no repositório, e dá para voltar atrás (ver "Voltar uma versão").

### 2. Build de produção

```bash
npx vite build
```

Confira se o build saiu com o caminho na raiz:

```bash
grep -o 'src="[^"]*"' dist/index.html
# esperado: src="/assets/index-XXXX.js"
```

Os assets usam `import.meta.env.BASE_URL` (ver `src/config/assetManifest.js`).
Por isso, se um dia o jogo for publicado num subcaminho (por exemplo,
`dominio.com/jogo/`), basta fazer o build com `--base=/jogo/`.

### 3. Enviar para o servidor

O acesso SSH não é como root. Por isso, primeiro envie para uma pasta de
staging no home e depois copie para a pasta publicada com `sudo`:

```bash
ssh cobra 'mkdir -p ~/deploy/mortovivo'
rsync -az --delete dist/ cobra:~/deploy/mortovivo/
ssh -t cobra 'sudo rsync -a --delete --chown=www-data:www-data ~/deploy/mortovivo/ /var/www/mortovivo/'
```

- A **barra no fim de `dist/`** importa: ela copia o *conteúdo* da pasta. Sem
  ela, o conteúdo ficaria dentro de uma subpasta `dist/` e o site quebraria.
- O `--delete` apaga do servidor os arquivos que não existem mais no build (por
  exemplo, o `.js` da versão anterior). Assim, a pasta fica igual ao `dist/`.
- Para simular antes de enviar, acrescente `-n --itemize-changes` ao rsync.

Não é preciso reiniciar nem recarregar o nginx: os arquivos novos já valem na
próxima visita. O `index.html` é servido sem cache, então a versão nova
aparece logo.

### 4. Conferir

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mortovivo.cristiancobra.com.br/
# esperado: 200

curl -sI https://mortovivo.cristiancobra.com.br/assets/sounds/jump-1.mp3 | grep -i content-type
# esperado: audio/mpeg
```

No navegador (de preferência numa aba anônima, para não pegar cache):

- https://mortovivo.cristiancobra.com.br: menu abre, botões fazem som.
- https://mortovivo.cristiancobra.com.br/?fase=MORTOVIVO-FASE1-R7K2: a Fase 1
  abre direto. Ande, pule e veja se os passos e o pulo fazem som.
- Abra o console do navegador (F12) e confira se não há erros nem arquivos 404.
- No celular: teste o leitor de QR com um QR code impresso.

## Resumo (cola rápida)

```bash
cd testephaser
git status                                           # limpo?
npx vite build
ssh cobra 'mkdir -p ~/deploy/mortovivo'
rsync -az --delete dist/ cobra:~/deploy/mortovivo/
ssh -t cobra 'sudo rsync -a --delete --chown=www-data:www-data ~/deploy/mortovivo/ /var/www/mortovivo/'
curl -s -o /dev/null -w "%{http_code}\n" https://mortovivo.cristiancobra.com.br/
```

## Voltar uma versão (rollback)

O servidor não guarda versões antigas: o `--delete` substitui tudo. Para
voltar, publique de novo um commit anterior:

```bash
git log --oneline                     # achar o commit que funcionava
git checkout <commit>
cd testephaser
npx vite build
rsync -az --delete dist/ cobra:~/deploy/mortovivo/
ssh -t cobra 'sudo rsync -a --delete --chown=www-data:www-data ~/deploy/mortovivo/ /var/www/mortovivo/'
git checkout main                     # voltar ao normal depois
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Tela preta, 404 no `index-XXXX.js` | Build com `--base` errado | Refazer o build sem `--base` e enviar de novo |
| Imagens ou sons não carregam (404) | Caminho de asset fixo no código | Assets devem usar `import.meta.env.BASE_URL` (ver `src/config/assetManifest.js`) |
| Jogo abre só em `/dist/` | Faltou a barra em `dist/` no rsync | Rodar de novo com `dist/`; apagar a pasta `dist` extra no servidor |
| Versão antiga continua aparecendo | Cache do navegador | Recarregar forçado (Ctrl+Shift+R) ou aba anônima |
| Sem som | Navegador bloqueia áudio até o 1º toque, ou som desligado no botão "Som" | Tocar na tela; conferir o botão "Som: ligado" |
| Câmera do QR não abre | Página fora de HTTPS | Usar sempre o endereço `https://` |
| `Permission denied (publickey)` | Chave SSH não configurada nesta máquina | Ver "Pré-requisitos", item 3 |

## Configuração do nginx no servidor

Já está feita (26/10/2026). Para referência, o bloco principal é:

```nginx
server {
    server_name mortovivo.cristiancobra.com.br;
    root /var/www/mortovivo;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location /assets/ { expires 7d; log_not_found off; }
    # + listen 443 ssl e certificados, gerenciados pelo certbot
}
```

Mudanças no nginx seguem o procedimento de backup e validação do servidor
(`nginx -t` antes de `systemctl reload nginx`).
