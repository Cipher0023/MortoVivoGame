import { useRef, useState } from "react";
import { getLevelByMarker } from "../levels";
import type { LevelDefinition } from "../levels/types";
import { useAssetWarmer } from "./useAssetWarmer";

// Hook que encapsula toda a lógica de detecção AR e preparação de fase.
// Chama onLevelDetected quando um marcador válido é identificado e os
// assets da fase estão prontos para uso.
export function useAR(onLevelDetected: (level: LevelDefinition) => void) {
  const [arEnabled, setArEnabled] = useState(false);
  const [isPreparingGame, setIsPreparingGame] = useState(false);
  const markerHandlingInProgress = useRef(false);

  const { warmAssets } = useAssetWarmer();

  const handleMarkerFound = async (markerPattern: string) => {
    if (markerHandlingInProgress.current) return;

    const level = getLevelByMarker(markerPattern);
    if (!level) return;

    markerHandlingInProgress.current = true;
    setIsPreparingGame(true);
    setArEnabled(false);

    try {
      // Aquece apenas os assets da fase detectada (+ assets do Boy, sempre necessários)
      const levelAssetUrls = level.assets.map((a) => a.path);
      await warmAssets(levelAssetUrls);

      console.log(`Página detectada: ${level.chapter} - ${level.name}`);
      onLevelDetected(level);
    } finally {
      setIsPreparingGame(false);
      markerHandlingInProgress.current = false;
    }
  };

  const handleMarkerLost = () => {
    console.log("Página perdida");
  };

  return {
    arEnabled,
    setArEnabled,
    isPreparingGame,
    handleMarkerFound,
    handleMarkerLost,
  };
}
