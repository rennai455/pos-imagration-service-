import { ButtonHTMLAttributes, CSSProperties } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  paddingInline: 16,
  paddingBlock: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  transition: "all 0.2s ease",
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "#e2e8f0",
    color: "#0f172a",
  },
};

export function Button({ variant = "primary", style, ...props }: ButtonProps) {
  return (
    <button
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...(props.disabled
          ? { opacity: 0.6, cursor: "not-allowed" }
          : { boxShadow: "0 10px 15px -3px rgba(15,23,42,0.2)" }),
        ...style,
      }}
      {...props}
    />
  );
}
