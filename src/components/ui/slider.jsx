import React from "react";
import { cn } from "../../lib/cn.js";

export function Slider({ className, value, min = 0, max = 100, step = 1, onValueChange, ...props }) {
  const currentValue = Array.isArray(value) ? value[0] : value;

  return (
    <input
      type="range"
      className={cn("ui-slider", className)}
      value={currentValue}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      {...props}
    />
  );
}
