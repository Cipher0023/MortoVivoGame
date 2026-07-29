"use client";

interface LevelCompleteOverlayProps {
  levelName?: string;
  onNextLevel: () => void;
}

export default function LevelCompleteOverlay({
  levelName,
  onNextLevel,
}: LevelCompleteOverlayProps) {
  return (
    <div className="z-50 absolute inset-0 flex flex-col justify-center items-center bg-black/90 backdrop-blur-md">
      <div className="space-y-6 bg-linear-to-b from-green-900/80 to-blue-900/80 p-10 border-4 border-green-400 rounded-3xl max-w-2xl text-center">
        <div className="mb-4">
          <span className="text-8xl">🎉</span>
        </div>
        <h2 className="mb-4 font-extrabold text-white text-6xl">
          Fase Concluída!
        </h2>
        <p className="mb-6 text-white text-2xl">
          Parabéns! Você completou {levelName || "esta fase"}.
        </p>

        <div className="space-y-4 bg-black/50 backdrop-blur-sm mb-6 p-6 border-2 border-yellow-400 rounded-xl">
          <p className="flex justify-center items-center gap-3 text-white text-xl">
            <span className="font-bold text-yellow-400 text-3xl">📖</span>
            <span>
              Para continuar, volte ao modo AR e escaneie a próxima página do
              livro
            </span>
          </p>
        </div>

        <button
          onClick={onNextLevel}
          className="bg-white hover:bg-gray-50 shadow-2xl hover:shadow-green-400/50 px-10 py-5 border-4 border-green-400 rounded-2xl font-extrabold text-green-600 text-2xl hover:scale-105 transition-all transform"
        >
          📷 Ativar AR e Escanear Próxima Página
        </button>
      </div>
    </div>
  );
}
