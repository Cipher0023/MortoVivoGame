"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "../levels/types";
import { startPhaserGame } from "../engine/PhaserGame";
import { useAR } from "../hooks/useAR";
import ARCamera from "./ARCamera";
import TouchJoystick from "./TouchJoystick";
import GameMenu from "./GameMenu";
import LevelCompleteOverlay from "./LevelCompleteOverlay";

export default function Game() {
  const gameRef = useRef<HTMLDivElement>(null);
  const [currentLevel, setCurrentLevel] = useState<LevelDefinition | null>(
    null,
  );
  const [levelCompleted, setLevelCompleted] = useState(false);
  const joystickDirection = useRef({ x: 0, y: 0 });

  const {
    arEnabled,
    setArEnabled,
    isPreparingGame,
    handleMarkerFound,
    handleMarkerLost,
  } = useAR((level) => {
    setCurrentLevel(level);
    setLevelCompleted(false);
  });

  useEffect(() => {
    if (!gameRef.current || !currentLevel) return;

    let cleanup: (() => void) | null = null;
    let destroyed = false;

    startPhaserGame({
      container: gameRef.current,
      level: currentLevel,
      joystickDirection,
      onLevelComplete: () => setLevelCompleted(true),
    }).then((fn) => {
      if (destroyed) {
        fn(); // useEffect limpou antes da promise resolver
      } else {
        cleanup = fn;
      }
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [currentLevel]);

  if (!currentLevel) {
    return (
      <GameMenu
        arEnabled={arEnabled}
        isPreparingGame={isPreparingGame}
        onEnableAR={() => setArEnabled(true)}
        onMarkerFound={handleMarkerFound}
        onMarkerLost={handleMarkerLost}
      />
    );
  }

  return (
    <div ref={gameRef} className="relative w-full h-full">
      {arEnabled && !levelCompleted && (
        <div className="z-50 absolute inset-0">
          <ARCamera
            onMarkerFound={handleMarkerFound}
            onMarkerLost={handleMarkerLost}
            enabled={arEnabled}
          />
        </div>
      )}

      {levelCompleted && (
        <LevelCompleteOverlay
          levelName={currentLevel.name}
          onNextLevel={() => {
            setLevelCompleted(false);
            setArEnabled(true);
          }}
        />
      )}

      <div className="top-4 right-4 z-50 absolute">
        <button
          onClick={() => {
            setCurrentLevel(null);
            setArEnabled(false);
            setLevelCompleted(false);
          }}
          className="bg-red-600/90 hover:bg-red-700/90 shadow-lg backdrop-blur-sm px-4 py-2 rounded-lg font-semibold text-white transition-all"
        >
          ← Menu Principal
        </button>
      </div>

      <TouchJoystick
        onMove={(direction) => {
          joystickDirection.current = direction;
        }}
      />
    </div>
  );
}
