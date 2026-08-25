"use client";

import { useEffect, useState } from "react";

const SEGMENT_COUNT = 28;

export default function LogStrip({ label = "partition-0" }: { label?: string }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setOffset((o) => o + 1);
    }, 850);
    return () => clearInterval(id);
  }, []);

  const head = offset % SEGMENT_COUNT;

  return (
    <div className="flex items-center gap-3 font-mono text-xs text-text-faint" aria-hidden="true">
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
          const isHead = i === head;
          const isTrail = i === (head - 1 + SEGMENT_COUNT) % SEGMENT_COUNT;
          const isTrail2 = i === (head - 2 + SEGMENT_COUNT) % SEGMENT_COUNT;
          return (
            <span
              key={i}
              className="block h-3 w-[5px] rounded-[1px] transition-colors duration-500"
              style={{
                background: isHead
                  ? "var(--accent)"
                  : isTrail
                  ? "var(--accent-soft)"
                  : isTrail2
                  ? "var(--border)"
                  : "var(--border-soft)",
              }}
            />
          );
        })}
      </div>
      <span className="whitespace-nowrap tabular-nums">offset {offset}</span>
    </div>
  );
}
