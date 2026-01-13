# 📖 Sistema AR - Livro Interativo

## 🎯 Visão Geral

O jogo "MortoVivo" agora possui um sistema de Realidade Aumentada (AR) que vincula fases do jogo às páginas de um livro físico. Quando o leitor aponta a câmera do dispositivo para uma página específica, o jogo detecta qual capítulo está sendo lido e carrega a fase correspondente.

## 🎮 Como Funciona

### Para o Usuário

1. **Abra o jogo** no navegador
2. **Clique no botão "Ativar AR"** (canto superior direito)
3. **Permita o acesso à câmera** quando solicitado
4. **Aponte a câmera para uma página do livro** com marcador
5. **O jogo detecta a página** e carrega a fase correspondente
6. **Jogue a fase** sobre a imagem da câmera em tempo real

### Fases Configuradas

| Marcador | Capítulo | Fase              | Dificuldade | Inimigos |
| -------- | -------- | ----------------- | ----------- | -------- |
| marker1  | Cap. 1   | Início da Jornada | Fácil       | 0        |
| marker2  | Cap. 2   | Primeiro Encontro | Fácil       | 3        |
| marker3  | Cap. 3   | Noite das Sombras | Média       | 5        |
| marker4  | Cap. 4   | O Confronto Final | Difícil     | 8        |

## 🔧 Componentes do Sistema

### 1. ARCamera (`components/ARCamera.tsx`)

Componente responsável por:

- ✅ Solicitar e gerenciar permissões de câmera
- ✅ Exibir feed de vídeo em tempo real
- ✅ Detectar marcadores de páginas (atualmente simulado)
- ✅ Notificar quando marcadores são encontrados/perdidos
- ✅ Botões de teste para desenvolvimento

### 2. Level Config (`config/levels.ts`)

Arquivo de configuração com:

- Definição de todas as fases do jogo
- Mapeamento entre marcadores e fases
- Propriedades: nome, capítulo, descrição, dificuldade, cor de fundo

### 3. Game Component (`components/game.tsx`)

Componente principal que:

- Integra Phaser com o sistema AR
- Alterna entre modo normal e modo AR
- Exibe informações da fase detectada
- Ajusta propriedades do jogo baseado na fase

## 📝 Como Adicionar Novas Fases

### Passo 1: Editar configuração de fases

Abra [`config/levels.ts`](config/levels.ts) e adicione uma nova fase ao array `LEVELS`:

```typescript
{
  id: 5,
  name: "Nome da Nova Fase",
  chapter: "Capítulo 5",
  markerPattern: "marker5", // Nome do marcador
  description: "Descrição da fase",
  difficulty: "medium", // easy, medium ou hard
  enemyCount: 6,
  backgroundColor: "#4B0082",
}
```

### Passo 2: Criar marcador para a página

**Opção A: Usar QR Code (Recomendado para início)**

1. Acesse um gerador de QR Code (ex: https://www.qr-code-generator.com/)
2. Crie um QR code com o texto: `marker5`
3. Imprima o QR code
4. Cole na página do livro

**Opção B: Image Tracking Real (Produção)**

Para detecção de páginas reais do livro sem QR codes:

1. **Tire uma foto clara da página** (boa iluminação, sem reflexos)
2. **Use o MindAR Image Compiler:**
   ```bash
   npm install -g mind-ar-cli
   mind-ar-cli compile --input pagina5.jpg --output targets/pagina5.mind
   ```
3. **Coloque o arquivo `.mind` gerado** em `public/targets/`
4. **Atualize o ARCamera** para usar MindAR real

### Passo 3: Testar a nova fase

Use os botões de teste no modo AR ou implemente detecção real.

## 🚀 Próximos Passos

### Implementação de Image Tracking Real

O sistema atual usa **detecção simulada** para desenvolvimento. Para produção, você deve implementar detecção real de imagens:

#### Opção 1: MindAR (Recomendado)

```bash
npm install @hiukim/mind-ar
```

Benefícios:

- ✅ Image tracking preciso
- ✅ Funciona com páginas reais do livro
- ✅ Não requer marcadores impressos
- ✅ Treinamento de múltiplas imagens

#### Opção 2: AR.js + Barcode/QR

```javascript
// Adicionar detecção de QR code no ARCamera.tsx
import jsQR from "jsqr";

// No loop de detecção:
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const code = jsQR(imageData.data, imageData.width, imageData.height);
if (code) {
  onMarkerFound(code.data); // "marker1", "marker2", etc
}
```

#### Opção 3: TensorFlow.js + Custom Model

Para detecção avançada de páginas sem marcadores.

## 🎨 Personalização

### Alterar Cores de Fases

Edite o campo `backgroundColor` em [`config/levels.ts`](config/levels.ts):

```typescript
backgroundColor: "#87CEEB", // Azul céu
backgroundColor: "#2F4F4F", // Cinza escuro
backgroundColor: "#8B0000", // Vermelho escuro
```

### Adicionar Propriedades Customizadas

Você pode adicionar novos campos à interface `LevelConfig`:

```typescript
export interface LevelConfig {
  // ... campos existentes
  music?: string; // Música de fundo da fase
  powerUps?: string[]; // Power-ups disponíveis
  timeLimit?: number; // Limite de tempo em segundos
  boss?: string; // Nome do chefe da fase
}
```

## 🐛 Troubleshooting

### Câmera não funciona

1. Verifique se concedeu permissão de câmera
2. Teste em HTTPS (câmera não funciona em HTTP)
3. Verifique se outro app não está usando a câmera

### Marcador não é detectado

1. Certifique-se de ter boa iluminação
2. Mantenha a câmera estável
3. Aproxime/afaste a câmera
4. Use os botões de teste para verificar se o sistema básico funciona

### Performance ruim

1. Reduza a resolução da câmera em `ARCamera.tsx`
2. Desative o debug do Phaser
3. Otimize assets (comprima imagens)

## 📱 Compatibilidade

| Dispositivo | Navegador | Status                |
| ----------- | --------- | --------------------- |
| Android     | Chrome    | ✅ Funcional          |
| Android     | Firefox   | ✅ Funcional          |
| iOS         | Safari    | ✅ Funcional          |
| iOS         | Chrome    | ⚠️ Limitado           |
| Desktop     | Chrome    | ✅ Funcional (webcam) |
| Desktop     | Firefox   | ✅ Funcional (webcam) |

## 📚 Recursos Adicionais

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [MindAR Documentation](https://hiukim.github.io/mind-ar-js-doc/)
- [AR.js Documentation](https://ar-js-org.github.io/AR.js-Docs/)
- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)

## 🎯 Roadmap

- [ ] Implementar MindAR real para detecção de páginas
- [ ] Sistema de conquistas por capítulo lido
- [ ] Salvar progresso do leitor
- [ ] Multiplayer AR (múltiplos leitores)
- [ ] Efeitos visuais quando marcador é detectado
- [ ] Sistema de som ambiente por capítulo
- [ ] Tutorial interativo para primeiro uso
- [ ] Suporte offline com Service Workers
