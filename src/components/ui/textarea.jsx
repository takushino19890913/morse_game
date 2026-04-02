import React from "react";
import { cn } from "../../lib/cn.js";

export const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-500",
        className
      )}
      {...props}
    />
  );
});
