import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-white/8 bg-black/20 px-3.5 text-sm text-zinc-100 outline-none transition hover:border-white/13 focus:border-primary/55 focus:ring-2 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}
