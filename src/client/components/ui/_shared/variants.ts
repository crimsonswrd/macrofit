export type Variant = "solid" | "outline" | "ghost" | "link" | "soft";
export type Color = "neutral" | "primary" | "destructive";

export const DEFAULT_VARIANT: Variant = "solid";
export const DEFAULT_COLOR: Color = "neutral";

/**
 * Base classes shared by Button and IconButton.
 * Ring width/offset live here; ring *color* lives per variant×color cell below
 * so tailwind-merge resolves to a single ring color.
 */
export const CONTROL_BASE =
  "inline-flex items-center justify-center whitespace-nowrap font-medium cursor-pointer " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-mist " +
  "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0";

/**
 * variant (style treatment) × color (intent) → Tailwind classes.
 * `solid` + `neutral` is the default black button.
 * Uses the default Tailwind palette — edit freely per project.
 */
export const VARIANT_COLOR: Record<Variant, Record<Color, string>> = {
  solid: {
    neutral:
      "bg-ink text-mist shadow-sm hover:bg-white active:bg-ink-2 focus-visible:ring-ink",
    primary:
      "bg-flame-500 text-mist shadow-sm hover:bg-flame-600 active:bg-flame-700 active:text-white focus-visible:ring-flame-500",
    destructive:
      "bg-flame-700 text-white shadow-sm hover:bg-[#a92c28] active:bg-[#8f2522] focus-visible:ring-flame-500",
  },
  outline: {
    neutral:
      "border border-mist-2 bg-paper text-ink hover:bg-mist active:bg-mist-2 focus-visible:ring-ink",
    primary:
      "border border-flame-400 bg-paper text-flame-500 hover:bg-flame-50 active:bg-flame-100 focus-visible:ring-flame-500",
    destructive:
      "border border-flame-400 bg-paper text-flame-500 hover:bg-flame-50 active:bg-flame-100 focus-visible:ring-flame-500",
  },
  ghost: {
    neutral:
      "text-ink hover:bg-mist-2 active:bg-mist-2 focus-visible:ring-ink",
    primary:
      "text-flame-500 hover:bg-flame-50 active:bg-flame-100 focus-visible:ring-flame-500",
    destructive:
      "text-flame-500 hover:bg-flame-50 active:bg-flame-100 focus-visible:ring-flame-500",
  },
  link: {
    neutral:
      "text-ink underline-offset-4 hover:underline focus-visible:ring-ink",
    primary:
      "text-flame-500 underline-offset-4 hover:underline focus-visible:ring-flame-500",
    destructive:
      "text-flame-500 underline-offset-4 hover:underline focus-visible:ring-flame-500",
  },
  soft: {
    neutral:
      "bg-mist-2 text-ink hover:bg-[#3a403b] active:bg-[#252925] focus-visible:ring-ink",
    primary:
      "bg-flame-100 text-ink hover:bg-flame-200 active:bg-flame-300 focus-visible:ring-flame-500",
    destructive:
      "bg-flame-100 text-ink hover:bg-flame-200 active:bg-flame-300 focus-visible:ring-flame-500",
  },
};

export function variantColorClasses(variant: Variant, color: Color): string {
  return VARIANT_COLOR[variant][color];
}
