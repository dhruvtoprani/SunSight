import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(245,213,71,0.14)] hover:bg-[#ffe66b]",
  secondary: "bg-zinc-100 text-zinc-950 hover:bg-white",
  ghost: "border border-white/8 bg-white/[0.035] text-zinc-300 hover:border-white/14 hover:bg-white/[0.07] hover:text-white",
  danger: "border border-rose-400/25 bg-rose-500/8 text-rose-200 hover:bg-rose-500/14",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
