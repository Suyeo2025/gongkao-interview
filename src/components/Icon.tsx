"use client";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  fill?: boolean;
}

export function Icon({ name, size = 20, className = "", fill = false }: IconProps) {
  return (
    <span
      className={`material-symbols-rounded leading-none select-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" : undefined,
      }}
    >
      {name}
    </span>
  );
}
