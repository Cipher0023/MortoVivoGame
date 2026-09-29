# Deploy para produção — Morto Vivo game

Como publicar uma nova versão do jogo (`testephaser/`) no site de produção.

**Endereço de produção:** https://cubic-dev.com/gamemortovivo/

## Visão geral

O jogo é um **site estático**: o Vite gera HTML, JS, imagens e sons na pasta
`testephaser/dist/`, e essa pasta é copiada para a VPS. Lá, o nginx serve os
arquivos. Não há servidor Node, banco de dados nem processo rodando para o jogo.

```
máquina local                          VPS (Hostinger, Ubuntu 24.04)
─────────────                          ─────────────────────────────
npx vite build --base=/gamemortovivo/
        │
        ▼
testephaser/dist/  ── rsync (SSH) ──▶  /var/www/gamemortovivo/
                                               │
                                               ▼
                                   nginx: cubic-dev.com/gamemortovivo/
```

| Item | Valor |
|------|-------|
| Servidor | VPS Hostinger `srv1778622.hstgr.cloud`, IP `187.127.13.244` |
| Acesso | SSH como `root`, com chave (sem senha) |
| Apelido SSH | `cubic-vps` (em `~/.ssh/config`, chave `~/.ssh/hostinger_cubicdev`) |
| Pasta no servidor | `/var/www/gamemortovivo/` |
| Config do nginx | `/etc/nginx/sites-enabled/cubic-dev.com` (bloco `location /gamemortovivo/`) |
| Subcaminho (base) | `/gamemortovivo/` |

> A mesma VPS hospeda outros sites (cubic-dev.com, testeloja, agenda-admin).
> O deploy do jogo **só mexe em `/var/www/gamemortovivo/`**. Não altere a
> config do nginx num deploy normal.

## Pré-requisitos (uma vez só, na máquina que vai publicar)

1. **Node e dependências:** `cd testephaser && npm install`
2. **rsync** instalado (`sudo apt install rsync` no Linux).
3. **Acesso SSH à VPS com chave.** Em `~/.ssh/config`:

   ```
   Host cubic-vps
       HostName 187.127.13.244
       User root
       IdentityFile ~/.ssh/hostinger_cubicdev
   ```

   Teste com `ssh cubic-vps "echo ok"`. Deve responder `ok` sem pedir senha.
   Numa máquina nova, gere uma chave (`ssh-keygen`) e cadastre a pública no
   painel da Hostinger (VPS → Chave SSH → Gerenciar).

## Passo a passo do deploy

Rode tudo a partir da pasta `testephaser/`.

### 1. Commit do que vai subir

```bash
git status          # deve estar limpo
git log --oneline -1
```

Publique sempre a partir de um commit. Assim, o que está no ar corresponde a
algo que existe no GitHub, e dá para voltar atrás (ver "Voltar uma versão").

### 2. Build de produção

```bash
npx vite build --base=/gamemortovivo/
```

**O `--base=/gamemortovivo/` é obrigatório.** O jogo não fica na raiz do domínio.
Sem ele, o navegador procura os arquivos em `cubic-dev.com/assets/...` (que é
outro site) e o jogo abre com tela preta ou sem imagens e sons.

Confira se o build saiu com o caminho certo:

```bash
grep -o 'src="[^"]*"' dist/index.html
# esperado: src="/gamemortovivo/assets/index-XXXX.js"
```

### 3. Enviar para a VPS

```bash
rsync -az --delete dist/ cubic-vps:/var/www/gamemortovivo/
```

- A **barra no fim de `dist/`** importa: ela copia o *conteúdo* da pasta. Sem
  ela, o rsync criaria `/var/www/gamemortovivo/dist/` e o site quebraria.
- O `--delete` apaga do servidor os arquivos que não existem mais no build (por
  exemplo, o `.js` da versão anterior). Assim, a pasta fica igual ao `dist/`.
- Para ver o que vai mudar antes de enviar, rode o mesmo comando com `-n`
  (simulação): `rsync -azn --delete --itemize-changes dist/ cubic-vps:/var/www/gamemortovivo/`

Não é preciso reiniciar nem recarregar o nginx: os arquivos novos já valem na
próxima visita.

### 4. Conferir

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://cubic-dev.com/gamemortovivo/
# esperado: 200

curl -sI https://cubic-dev.com/gamemortovivo/assets/sounds/jump-1.mp3 | grep -i content-type
# esperado: audio/mpeg
```

No navegador (de preferência numa aba anônima, para não pegar cache):

- https://cubic-dev.com/gamemortovivo/: menu abre, botões fazem som.
- https://cubic-dev.com/gamemortovivo/?fase=MORTOVIVO-FASE1-R7K2: a Fase 1 abre
  direto. Ande, pule e veja se os passos e o pulo fazem som.
- Abra o console do navegador (F12) e confira se não há erros nem arquivos 404.
- No celular: teste o leitor de QR com um QR code impresso.

## Resumo (cola rápida)

```bash
cd testephaser
git status                                           # limpo?
npx vite build --base=/gamemortovivo/
rsync -az --delete dist/ cubic-vps:/var/www/gamemortovivo/
curl -s -o /dev/null -w "%{http_code}\n" https://cubic-dev.com/gamemortovivo/
```

## Voltar uma versão (rollback)

O servidor não guarda versões antigas: o `--delete` substitui tudo. Para
voltar, publique de novo um commit anterior:

```bash
git log --oneline                     # achar o commit que funcionava
git checkout <commit>
cd testephaser
npx vite build --base=/gamemortovivo/
rsync -az --delete dist/ cubic-vps:/var/www/gamemortovivo/
git checkout main                     # voltar ao normal depois
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Tela preta, 404 no `index-XXXX.js` | Build sem `--base=/gamemortovivo/` | Refazer o build com o `--base` e enviar de novo |
| Imagens ou sons não carregam (404) | Idem, ou caminho de asset fixo no código | Assets devem usar `import.meta.env.BASE_URL` (ver `src/config/assetManifest.js`) |
| Jogo abre em `/gamemortovivo/dist/` | Faltou a barra em `dist/` no rsync | Rodar de novo com `dist/`; apagar a pasta `dist` extra no servidor |
| Versão antiga continua aparecendo | Cache do navegador | Recarregar forçado (Ctrl+Shift+R) ou aba anônima |
| Sem som | Navegador bloqueia áudio até o 1º toque, ou som desligado no botão "Som" | Tocar na tela; conferir o botão "Som: ligado" |
| Câmera do QR não abre | Página fora de HTTPS | Usar sempre o endereço `https://` |
| `Permission denied (publickey)` | Chave SSH não configurada nesta máquina | Ver "Pré-requisitos", item 3 |

## Se um dia precisar mexer no nginx

Num deploy normal, isso não é necessário. O bloco que serve o jogo, dentro do
`server` de `cubic-dev.com`, é este:

```nginx
# Game MortoVivo (Vite+Phaser build estático)
location /gamemortovivo/ {
    alias /var/www/gamemortovivo/;
    try_files $uri $uri/ /gamemortovivo/index.html;
}
```

Cuidados, aprendidos na primeira configuração:

- `/etc/nginx/sites-enabled/cubic-dev.com` é um **arquivo próprio**, não um
  atalho para o de `sites-available`. O que vale é o de `sites-enabled`.
- **Nunca deixe backups dentro de `sites-enabled/`.** O nginx carrega todo
  arquivo dessa pasta, e uma cópia `.bak` duplica o site e derruba o `nginx -t`.
  Guarde backups em `/root/nginx-backups/`.
- Sempre teste antes de aplicar: `nginx -t && systemctl reload nginx`.

## Pendência conhecida: instalar na Tela de Início

O arquivo `testephaser/public/manifest.webmanifest` tem `"start_url": "/"`. Em
produção, quem instala o jogo pela Tela de Início (o caminho que o jogo ensina
para ter tela cheia no iPhone) abre **cubic-dev.com** em vez do jogo. Para
corrigir, o `start_url` (e um `scope`) devem apontar para `/gamemortovivo/`, ou
ser relativos (`"./"`), e o jogo deve ser publicado de novo.
