import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-white/8 bg-black/20 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/13 focus:border-primary/55 focus:bg-black/30 focus:ring-2 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}
