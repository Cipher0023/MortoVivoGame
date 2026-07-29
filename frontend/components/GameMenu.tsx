"use client";

import ARCamera from "./ARCamera";

interface GameMenuProps {
  arEnabled: boolean;
  isPreparingGame: boolean;
  onEnableAR: () => void;
  onMarkerFound: (markerPattern: string) => void;
  onMarkerLost: () => void;
}

export default function GameMenu({
  arEnabled,
  isPreparingGame,
  onEnableAR,
  onMarkerFound,
  onMarkerLost,
}: GameMenuProps) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {arEnabled ? (
        <div className="z-50 absolute inset-0">
          <ARCamera
            onMarkerFound={onMarkerFound}
            onMarkerLost={onMarkerLost}
            enabled={arEnabled}
          />
        </div>
      ) : (
        <>
          {/* Background com imagem */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/backgroundMenu.png)" }}
          />

          {/* Overlay com degradê */}
          <div className="absolute inset-0 bg-linear-to-b from-yellow-400/80 via-green-400/70 to-blue-300/80" />

          {/* Conteúdo do menu */}
          <div className="z-10 relative flex flex-col justify-center items-center h-full">
            {/* Título do jogo */}
            <div className="mb-8 text-center">
              <h1 className="mb-4 font-bold text-white text-8xl">Morto Vivo</h1>
              <p className="opacity-80 text-white text-xl">
                Aventura em Realidade Aumentada
              </p>
            </div>

            {/* Instruções */}
            <div className="space-y-4 bg-black/50 backdrop-blur-md mb-8 p-8 border-2 border-yellow-400 rounded-2xl max-w-lg">
              <h2 className="mb-4 font-bold text-white text-2xl">
                📖 Como Jogar
              </h2>
              <div className="space-y-3 text-white">
                <p className="flex items-start gap-3">
                  <span className="font-bold text-yellow-400">1.</span>
                  <span>
                    Clique no botão <strong>&ldquo;Ativar AR&rdquo;</strong>{" "}
                    abaixo
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="font-bold text-yellow-400">2.</span>
                  <span>
                    Aponte a câmera para o <strong>livro físico</strong>
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="font-bold text-yellow-400">3.</span>
                  <span>
                    Quando a página for detectada, o jogo iniciará
                    automaticamente
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="font-bold text-yellow-400">4.</span>
                  <span>
                    Use o joystick virtual para controlar o personagem
                  </span>
                </p>
              </div>
            </div>

            {/* Botão de AR */}
            <button
              onClick={onEnableAR}
              className="flex items-center gap-4 bg-white hover:bg-gray-50 shadow-2xl hover:shadow-green-400/50 px-10 py-5 border-4 border-green-400 rounded-2xl font-extrabold text-green-600 text-3xl hover:scale-110 transition-all animate-pulse transform"
              style={{
                boxShadow:
                  "0 0 30px rgba(74, 222, 128, 0.6), 0 10px 40px rgba(0, 0, 0, 0.3)",
              }}
            >
              <span className="text-4xl">📷</span>
              <span>Ativar AR e Começar</span>
            </button>
          </div>
        </>
      )}

      {isPreparingGame && (
        <div className="z-60 absolute inset-0 flex justify-center items-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/60 p-6 border border-white/20 rounded-xl text-center">
            <p className="font-semibold text-white text-xl">
              Preparando fase...
            </p>
            <p className="opacity-80 mt-2 text-white text-sm">
              Carregando imagens no cache para evitar travamentos iniciais.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
