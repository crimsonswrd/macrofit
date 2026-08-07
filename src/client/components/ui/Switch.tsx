"use client";

import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/client/lib/utils";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof BaseSwitch.Root> {}

const Switch = React.forwardRef<
  React.ElementRef<typeof BaseSwitch.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <BaseSwitch.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-mist-2 outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-flame-500 focus-visible:ring-offset-2 focus-visible:ring-offset-mist",
      "data-[checked]:bg-steady-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <BaseSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-ink shadow transition-transform data-[checked]:translate-x-5 data-[checked]:bg-mist" />
  </BaseSwitch.Root>
));
Switch.displayName = "Switch";

export { Switch };
