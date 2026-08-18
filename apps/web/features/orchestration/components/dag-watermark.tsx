export function DagWatermark() {
  return (
    <svg
      className="dag-watermark"
      viewBox="0 0 1000 620"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="dag-fade"
          x1="80"
          y1="100"
          x2="920"
          y2="540"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity=".7" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".16" />
        </linearGradient>
        <marker
          id="dag-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M1 1l5 3-5 3" stroke="currentColor" strokeWidth="1.2" />
        </marker>
      </defs>
      <g stroke="url(#dag-fade)" strokeWidth="2" markerEnd="url(#dag-arrow)">
        <path d="M145 309C220 309 222 160 315 160" />
        <path d="M145 309C220 309 222 310 315 310" />
        <path d="M145 309C220 309 222 460 315 460" />
        <path d="M375 160C455 160 445 235 535 235" />
        <path d="M375 310C455 310 445 235 535 235" />
        <path d="M375 310C455 310 445 385 535 385" />
        <path d="M375 460C455 460 445 385 535 385" />
        <path d="M595 235C680 235 672 310 755 310" />
        <path d="M595 385C680 385 672 310 755 310" />
        <path d="M815 310C855 310 862 310 902 310" />
      </g>
      <g fill="var(--canvas)" stroke="currentColor" strokeWidth="2.2">
        <rect x="84" y="277" width="62" height="62" rx="18" />
        <rect x="314" y="129" width="62" height="62" rx="18" />
        <rect x="314" y="279" width="62" height="62" rx="18" />
        <rect x="314" y="429" width="62" height="62" rx="18" />
        <rect x="534" y="204" width="62" height="62" rx="18" />
        <rect x="534" y="354" width="62" height="62" rx="18" />
        <rect x="754" y="279" width="62" height="62" rx="18" />
        <rect x="901" y="284" width="52" height="52" rx="16" />
      </g>
    </svg>
  );
}
