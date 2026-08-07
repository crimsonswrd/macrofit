"use client";

import * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/client/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof BaseCheckbox.Root> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof BaseCheckbox.Root>,
  CheckboxProps
>(({ className, indeterminate, ...props }, ref) => (
  <BaseCheckbox.Root
    ref={ref}
    indeterminate={indeterminate}
    className={cn(
      "mt-0.5 flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded border border-mist-2 bg-paper text-white outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-flame-500 focus-visible:ring-offset-2",
      "data-[checked]:border-flame-500 data-[checked]:bg-flame-500",
      "data-[indeterminate]:border-flame-500 data-[indeterminate]:bg-flame-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <BaseCheckbox.Indicator className="flex items-center justify-center text-current data-[unchecked]:hidden">
      {indeterminate ? (
        <Minus className="size-3" aria-hidden="true" />
      ) : (
        <Check className="size-3" aria-hidden="true" />
      )}
    </BaseCheckbox.Indicator>
  </BaseCheckbox.Root>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
