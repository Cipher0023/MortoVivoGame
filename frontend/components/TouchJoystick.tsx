"use client";

import { useEffect, useRef, useState } from "react";

interface TouchJoystickProps {
  onMove: (direction: { x: number; y: number }) => void;
}

export default function TouchJoystick({ onMove }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [thumbPosition, setThumbPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isActive || !baseRef.current) return;

      const baseRect = baseRef.current.getBoundingClientRect();
      const baseCenterX = baseRect.left + baseRect.width / 2;
      const baseCenterY = baseRect.top + baseRect.height / 2;

      const dx = e.clientX - baseCenterX;
      const dy = e.clientY - baseCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const maxDistance = 50;
      let finalX = dx;
      let finalY = dy;

      if (distance > maxDistance) {
        const angle = Math.atan2(dy, dx);
        finalX = Math.cos(angle) * maxDistance;
        finalY = Math.sin(angle) * maxDistance;
      }

      setThumbPosition({ x: finalX, y: finalY });

      // Normalizar direção
      onMove({
        x: finalX / maxDistance,
        y: finalY / maxDistance,
      });
    };

    const handlePointerUp = () => {
      setIsActive(false);
      setThumbPosition({ x: 0, y: 0 });
      onMove({ x: 0, y: 0 });
    };

    if (isActive) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isActive, onMove]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsActive(true);
  };

  return (
    <div className="z-9999 fixed inset-0 pointer-events-none">
      {/* Base do joystick */}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        className="bottom-8 left-8 absolute flex justify-center items-center bg-gray-800/50 rounded-full w-[120px] h-[120px] touch-none pointer-events-auto"
        style={{
          backdropFilter: "blur(4px)",
        }}
      >
        {/* Thumb do joystick */}
        <div
          ref={thumbRef}
          className="absolute bg-blue-500/80 rounded-full w-[60px] h-[60px] transition-transform"
          style={{
            transform: `translate(${thumbPosition.x}px, ${thumbPosition.y}px)`,
            backdropFilter: "blur(2px)",
          }}
        />
      </div>
    </div>
  );
}
