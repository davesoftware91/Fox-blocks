import React, { useRef, useState, useEffect } from "react";

interface JoystickProps {
  onChange: (input: { x: number; y: number }) => void;
}

export default function Joystick({ onChange }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touching, setTouching] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    setTouching(true);
    handleMove(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp distance to the radius
    let moveX = dx;
    let moveY = dy;
    if (dist > radius) {
      moveX = (dx / dist) * radius;
      moveY = (dy / dist) * radius;
    }

    setKnobPos({ x: moveX, y: moveY });

    // Normalize inputs to -1 to 1 range
    onChange({
      x: moveX / radius,
      y: -moveY / radius // invert Y so up is positive
    });
  };

  const handleEnd = () => {
    setTouching(false);
    setKnobPos({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleGlobalMove = (e: TouchEvent | MouseEvent) => {
      if (!touching) return;
      if ("touches" in e) {
        if (e.touches.length > 0) {
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      } else {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalEnd = () => {
      if (touching) {
        handleEnd();
      }
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalEnd);
    window.addEventListener("touchmove", handleGlobalMove, { passive: false });
    window.addEventListener("touchend", handleGlobalEnd);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalEnd);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("touchend", handleGlobalEnd);
    };
  }, [touching]);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div
        id="virtual-joystick-container"
        ref={containerRef}
        className="relative w-28 h-28 rounded-full bg-slate-900/60 border border-orange-500/40 backdrop-blur-md flex items-center justify-center cursor-pointer shadow-lg active:scale-98 transition-transform"
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        style={{ touchAction: "none" }}
      >
        {/* Joystick outer ticks */}
        <div className="absolute inset-2 rounded-full border border-dashed border-white/10 pointer-events-none" />

        {/* Inner Knob */}
        <div
          id="virtual-joystick-knob"
          className={`absolute w-12 h-12 rounded-full bg-linear-to-br from-orange-400 to-amber-600 shadow-md flex items-center justify-center transition-shadow duration-150 ${
            touching ? "shadow-orange-500/50 scale-105" : ""
          }`}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            willChange: "transform",
            touchAction: "none"
          }}
        >
          {/* Paw/logo print center detail */}
          <div className="w-3 h-3 rounded-full bg-white/30" />
        </div>
      </div>
      <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">Move</span>
    </div>
  );
}
