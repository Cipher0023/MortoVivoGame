# MortoVivo 📖🎮

Jogo interativo de plataforma 2D com **Realidade Aumentada (AR)** que se integra com um livro físico. Cada página/capítulo do livro desbloqueia uma fase diferente do jogo quando detectada pela câmera.

## ✨ Características

- 🎮 **Jogo de Plataforma 2D** desenvolvido com Phaser 3
- 📱 **Realidade Aumentada** com detecção de páginas do livro
- 🕹️ **Controles Duplos**: Teclado (desktop) + Joystick virtual (mobile)
- 📖 **4 Capítulos/Fases** vinculados às páginas do livro
- 🎨 **UI Responsiva** com Tailwind CSS 4
- ⚡ **Next.js 16** com App Router e React 19

## 🎯 Como Funciona

1. Abra o jogo no navegador
2. Clique em "Ativar AR"
3. Aponte a câmera para uma página do livro
4. A fase correspondente é carregada automaticamente!

## 📋 Requisitos

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

- **Next.js 16** - Framework React com App Router
- **React 19** - Biblioteca para interfaces
- **Phaser 3.90** - Engine para desenvolvimento de jogos 2D
- **Tailwind CSS 4** - Framework CSS utility-first
- **TypeScript 5** - Superset JavaScript com tipagem estática
- **AR.js / Three.js** - Bibliotecas para Realidade Aumentada

## 📂 Estrutura do Projeto

```
frontend/
├── app/
│   ├── page.tsx          # Página principal
│   └── layout.tsx        # Layout raiz
├── components/
│   ├── game.tsx          # Componente principal do jogo
│   └── ARCamera.tsx      # Sistema de câmera AR
├── config/
│   └── levels.ts         # Configuração de fases/capítulos
├── game/
│   ├── Boy.ts           # Classe do personagem jogável
│   └── entities.ts      # Inimigos e power-ups
├── public/
│   ├── boy.png          # Sprite do personagem
│   ├── textura_fundo.png # Textura de fundo
│   └── yellowGrass.png  # Grama
├── README_AR.md         # Documentação completa do sistema AR
└── MARCADORES.md        # QR codes para teste
```

## 🎮 Controles

### Desktop (Teclado)

- **←/→** - Mover esquerda/direita
- **↑** - Pular

### Mobile (Joystick Virtual)

- **Arrastar círculo azul** - Mover
- **Empurrar para cima** - Pular

## 📖 Sistema AR - Fases do Livro

| Capítulo | Fase              | Dificuldade | Descrição          |
| -------- | ----------------- | ----------- | ------------------ |
| Cap. 1   | Início da Jornada | Fácil       | Tutorial básico    |
| Cap. 2   | Primeiro Encontro | Fácil       | Primeiros inimigos |
| Cap. 3   | Noite das Sombras | Média       | Desafios noturnos  |
| Cap. 4   | O Confronto Final | Difícil     | Boss final         |

**Veja [README_AR.md](README_AR.md) para documentação completa do sistema AR.**

**Veja [MARCADORES.md](MARCADORES.md) para QR codes de teste.**

## 🚀 Desenvolvimento

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
