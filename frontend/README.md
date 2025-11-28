# MortoVivo

Projeto de jogo desenvolvido com Next.js, React, Phaser e Tailwind CSS.

## Requisitos

Antes de começar, você precisa ter instalado:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm (geralmente vem com o Node.js)

## Instalação

1. Clone o repositório (se ainda não tiver feito):

```bash
git clone <url-do-repositorio>
cd MortoVivo/frontend
```

2. Instale as dependências:

```bash
npm install
```

## Como Rodar o Projeto

### Modo de Desenvolvimento

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O projeto estará disponível em [http://localhost:3000](http://localhost:3000).

## Tecnologias Utilizadas

- **Next.js 16** - Framework React
- **React 19** - Biblioteca para interfaces
- **Phaser 3** - Engine para desenvolvimento de jogos
- **Tailwind CSS 4** - Framework CSS
- **TypeScript** - Superset JavaScript com tipagem estática

## Estrutura do Projeto

```
frontend/
├── app/              # Páginas e layouts do Next.js
├── components/       # Componentes React reutilizáveis
├── game/            # Lógica do jogo (classes Phaser)
├── public/          # Arquivos estáticos (imagens, sprites)
└── sprites/         # Sprites do jogo
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria a build de produção
- `npm start` - Inicia o servidor de produção
- `npm run lint` - Executa o linter para verificar o código
