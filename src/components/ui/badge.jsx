import React from "react";
import { cn } from "../../lib/cn.js";

const variants = {
  default: "border border-slate-900 bg-slate-900 text-white",
  secondary: "border border-slate-200 bg-slate-100 text-slate-900",
  outline: "border border-slate-300 bg-white text-slate-900",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}
