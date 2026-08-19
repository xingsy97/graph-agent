interface GraphGlyphProps {
  size?: number;
  className?: string;
}

export function GraphGlyph({ size = 20, className }: GraphGlyphProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M5 7.5 12 4l7 4.5M5 7.5l2 9M19 8.5l-2 8M7 16.5l5 3 5-3M5 7.5l7 5 7-4M12 4v8.5M7 16.5l5-4 5 4" />
      </g>
      <g fill="currentColor">
        <circle cx="12" cy="4" r="2.2" />
        <circle cx="5" cy="7.5" r="2.2" />
        <circle cx="19" cy="8.5" r="2.2" />
        <circle cx="12" cy="12.5" r="2.2" />
        <circle cx="7" cy="16.5" r="2.2" />
        <circle cx="17" cy="16.5" r="2.2" />
        <circle cx="12" cy="20" r="2.2" />
      </g>
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <GraphGlyph size={21} />
    </span>
  );
}
