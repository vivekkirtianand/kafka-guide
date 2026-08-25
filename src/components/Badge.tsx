const TONE_STYLES: Record<string, string> = {
  neutral: "bg-bg-elevated text-text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent/30",
  stream: "bg-stream-soft text-stream border-stream/30",
  success: "bg-success-soft text-success border-success/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

export default function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_STYLES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
