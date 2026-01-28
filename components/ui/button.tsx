import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[7px] text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.18)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[0_1px_4px_rgba(0,0,0,0.1)]",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-[0_2px_8px_rgba(220,38,38,0.2)] hover:shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:-translate-y-[1px] active:translate-y-0",
        outline:
          "border border-slate-200 dark:border-input bg-white dark:bg-background/80 backdrop-blur-sm dark:shadow-sm hover:bg-slate-50 dark:hover:bg-accent dark:hover:shadow-md hover:text-slate-900 dark:hover:text-accent-foreground hover:-translate-y-[1px] active:translate-y-0",
        secondary:
          "bg-slate-100 dark:bg-secondary text-slate-900 dark:text-secondary-foreground shadow-sm hover:shadow-md hover:bg-slate-200 dark:hover:bg-secondary/80 hover:-translate-y-[1px] active:translate-y-0",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-3",
        sm: "h-9 rounded-[6px] px-4 py-2",
        lg: "h-12 rounded-[8px] px-8 py-3",
        icon: "h-10 w-10 rounded-[7px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

