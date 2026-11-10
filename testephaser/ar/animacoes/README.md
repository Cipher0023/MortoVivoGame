# Animações da realidade aumentada

Cada animação é uma pasta com os quadros em sequência, por exemplo
`guri-andando/01.png`, `02.png`, `03.png`...

## Como entregar os quadros

- **PNG com fundo transparente.**
- **Numerados na ordem** (`01.png`, `02.png`...). Use sempre dois dígitos, ou
  três se passar de 99 quadros.
- **Todos do mesmo tamanho**, com o personagem na mesma posição dentro do quadro.
- **Pés encostados na borda de baixo da imagem.** É por ali que o personagem
  fica apoiado na página.
- **Virado para a direita**, se ele for andar. O protótipo espelha o desenho
  quando o personagem anda para a esquerda.
- Por volta de **300 px de altura** bastam. Na tela do celular, o personagem
  ocupa só uma parte da página.

O nome da pasta é o nome da animação: use letras minúsculas, sem acento e com
hífen (`caveirinha-acenando`).

## Colocar uma animação numa página

A lista fica em [`../cenas.json`](../cenas.json). Para cada página (`fase1`,
`fase2`...), indique as animações que aparecem sobre ela:

```json
{
  "fase1": [
    { "animacao": "guri-andando", "movimento": "andar", "y": -0.28 },
    { "animacao": "caveirinha-acenando", "x": 0.3, "y": 0.1, "altura": 0.25 }
  ]
}
```

Só `animacao` é obrigatório. As outras opções têm valor padrão:

| Opção | O que faz | Padrão |
|---|---|---|
| `movimento` | `"parado"` (fica no lugar) ou `"andar"` (vai e volta) | `"parado"` |
| `altura` | altura do personagem, em larguras de página (`0.5` = metade da largura) | `0.36` |
| `x` | posição na horizontal: `-0.5` é a borda esquerda, `0` o centro, `0.5` a direita | `0` |
| `y` | posição na vertical: `-0.5` é a borda de baixo, `0` o centro, `0.5` a de cima | `-0.28` |
| `fps` | quadros por segundo | `12` |
| `distancia` | no `"andar"`, quanto ele anda para cada lado a partir do `x` | `0.3` |
| `velocidade` | no `"andar"`, larguras de página por segundo | `0.16` |
| `espelhar` | `true` vira o desenho (para quadros virados para a esquerda) | `false` |
| `sombra` | `false` tira a sombra embaixo do personagem | `true` |

Depois, publique com `sh ar/publicar-teste.sh` (a partir de `testephaser/`).
O script avisa se o `cenas.json` citar uma pasta que não existe.
