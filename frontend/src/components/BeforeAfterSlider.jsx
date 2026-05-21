import { useState } from 'react';

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  height = '320px',
}) {
  const [position, setPosition] = useState(50);

  if (!beforeImage || !afterImage) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-3xl border border-border-primary bg-bg-secondary"
        style={{ height }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={afterImage}
            alt={afterLabel}
            className="h-full w-full object-cover"
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.45)]"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
          {beforeLabel}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
          {afterLabel}
        </div>
      </div>

      <div className="rounded-2xl border border-border-primary bg-surface-primary/60 px-4 py-3">
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="w-full accent-secondary-500"
          aria-label="Before and after comparison"
        />
      </div>
    </div>
  );
}
