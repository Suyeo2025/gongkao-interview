export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="32" r="29" stroke="#1a1a1a" strokeWidth="2" opacity="0.15"
        strokeDasharray="5 2 8 1.5 12 2.5"
      />
      <circle cx="32" cy="32" r="26" stroke="#b91c1c" strokeWidth="3.2" strokeLinecap="round" opacity="0.88"
        strokeDasharray="3 0.6 10 0.4 7 0.8 14 0.5 9 0.7 6 0.3 16"
      />
      <circle cx="32" cy="32" r="22.5" stroke="#991b1b" strokeWidth="0.6" opacity="0.25"
        strokeDasharray="4 3 6 2"
      />
      <text x="32" y="41" textAnchor="middle" fontFamily="'Noto Serif SC', 'SimSun', 'KaiTi', serif" fontSize="26" fontWeight="800" fill="#1a1a1a">琦</text>
      <circle cx="51" cy="11" r="1" fill="#b91c1c" opacity="0.18"/>
      <circle cx="12" cy="50" r="0.7" fill="#1a1a1a" opacity="0.12"/>
    </svg>
  );
}
