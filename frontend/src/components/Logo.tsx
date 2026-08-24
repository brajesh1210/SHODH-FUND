import Image from "next/image";

interface LogoProps {
  /** Render the high-contrast wordmark intended for dark backgrounds. */
  light?: boolean;
  /** Use the standalone approved mark in compact spaces. */
  markOnly?: boolean;
  /** Display height in pixels. */
  size?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({
  light = false,
  markOnly = false,
  size = 28,
  className = "",
  priority = false,
}: LogoProps) {
  const src = markOnly
    ? light
      ? "/landing/shodhfund-mark-light.png"
      : "/landing/shodhfund-mark.png"
    : light
      ? "/landing/shodhfund-logo-light.png"
      : "/landing/shodhfund-logo-dark.png";
  const width = markOnly ? 161 : 785;
  const height = 220;

  return (
    <Image
      src={src}
      alt="ShodhFund"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{
        width: "auto",
        height: `${size}px`,
        maxWidth: "100%",
        objectFit: "contain",
      }}
    />
  );
}
