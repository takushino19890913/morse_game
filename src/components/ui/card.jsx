import React from "react";
import { cn } from "../../lib/cn.js";

export function Card({ className, ...props }) {
  return <section className={cn("border border-slate-200 bg-white", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("p-6 pb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h1 className={cn("text-xl font-semibold text-slate-950", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
