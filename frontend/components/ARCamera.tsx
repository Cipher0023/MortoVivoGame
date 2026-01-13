"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ARCameraProps {
  onMarkerFound: (markerPattern: string) => void;
  onMarkerLost: () => void;
  enabled: boolean;
}

export default function ARCamera({
  onMarkerFound,
  onMarkerLost,
  enabled,
}: ARCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startMarkerDetection = useCallback(() => {
    // Aqui seria implementada a detecção real de marcadores
    // Por enquanto, criamos um sistema de detecção simulado
    // que pode ser substituído por AR.js ou outra biblioteca

    console.log("Sistema de detecção AR iniciado");

    // Para demonstração: simular detecção quando usuário clica na tela
    // Em produção, isso seria substituído por detecção real de imagem/QR
  }, []);

  const simulateMarkerDetection = useCallback(
    (markerPattern: string) => {
      // Função auxiliar para testes - simula detecção de marcador
      onMarkerFound(markerPattern);

      // Simular perda do marcador após 5 segundos
      setTimeout(() => {
        onMarkerLost();
      }, 5000);
    },
    [onMarkerFound, onMarkerLost]
  );

  useEffect(() => {
    if (!enabled) {
      // Parar stream se AR estiver desabilitado
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    const initCamera = async () => {
      try {
        // Solicitar permissão de câmera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Câmera traseira em dispositivos móveis
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
          setCameraError(null);

          // Quando o vídeo estiver pronto, iniciar detecção
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            startMarkerDetection();
          };
        }
      } catch (error) {
        console.error("Erro ao acessar câmera:", error);
        setCameraError(
          "Não foi possível acessar a câmera. Verifique as permissões."
        );
      }
    };

    initCamera();

    // Cleanup ao desmontar
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled, startMarkerDetection]);

  if (cameraError) {
    return (
      <div className="z-10 absolute inset-0 flex justify-center items-center bg-black text-white">
        <div className="p-6 text-center">
          <h2 className="mb-4 font-bold text-xl">Erro de Câmera</h2>
          <p>{cameraError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 mt-4 px-6 py-2 rounded-lg"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Vídeo da câmera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Canvas para detecção (oculto) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay de instruções */}
      {hasPermission && (
        <div className="top-0 right-0 left-0 z-20 absolute bg-linear-to-b from-black/70 to-transparent p-4 text-white">
          <div className="mx-auto max-w-md text-center">
            <h3 className="mb-2 font-bold text-lg">
              📖 Aponte para uma página do livro
            </h3>
            <p className="opacity-90 text-sm">
              Posicione a câmera sobre uma página marcada para iniciar a fase
            </p>
          </div>
        </div>
      )}

      {/* Botões de teste (remover em produção) */}
      <div className="right-0 bottom-20 left-0 z-30 absolute p-4">
        <div className="gap-2 grid grid-cols-2 mx-auto max-w-md">
          <button
            onClick={() => simulateMarkerDetection("marker1")}
            className="bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm px-4 py-2 rounded-lg text-white"
          >
            📄 Testar Cap. 1
          </button>
          <button
            onClick={() => simulateMarkerDetection("marker2")}
            className="bg-blue-600/80 hover:bg-blue-700/80 backdrop-blur-sm px-4 py-2 rounded-lg text-white"
          >
            📄 Testar Cap. 2
          </button>
          <button
            onClick={() => simulateMarkerDetection("marker3")}
            className="bg-purple-600/80 hover:bg-purple-700/80 backdrop-blur-sm px-4 py-2 rounded-lg text-white"
          >
            📄 Testar Cap. 3
          </button>
          <button
            onClick={() => simulateMarkerDetection("marker4")}
            className="bg-red-600/80 hover:bg-red-700/80 backdrop-blur-sm px-4 py-2 rounded-lg text-white"
          >
            📄 Testar Cap. 4
          </button>
        </div>
      </div>
    </div>
  );
}
