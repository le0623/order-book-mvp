import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-slate-100 dark:bg-secondary text-slate-700 dark:text-secondary-foreground hover:bg-slate-200 dark:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-slate-700 dark:text-foreground border-slate-200 dark:border-border",
        success: "border-transparent bg-green-600 text-white",
        warning: "border-transparent bg-yellow-600 text-white",
        buy: "border-emerald-200 dark:border-transparent bg-emerald-50 dark:bg-transparent text-emerald-600 dark:text-green-400",
        sell: "border-rose-200 dark:border-transparent bg-rose-50 dark:bg-transparent text-rose-600 dark:text-red-400",
        statusOpen: "border-blue-200 dark:border-transparent bg-blue-50 dark:bg-transparent text-blue-600 dark:text-blue-400",
        statusCompleted: "border-emerald-200 dark:border-transparent bg-emerald-50 dark:bg-transparent text-emerald-600 dark:text-emerald-400",
        statusCanceled: "border-rose-200 dark:border-transparent bg-rose-50 dark:bg-transparent text-rose-600 dark:text-red-400",
        statusFailed: "border-rose-200 dark:border-transparent bg-rose-50 dark:bg-transparent text-rose-600 dark:text-rose-400",
        statusPending: "border-amber-200 dark:border-transparent bg-amber-50 dark:bg-transparent text-amber-600 dark:text-amber-400",
        statusPartial: "border-slate-200 dark:border-transparent bg-slate-50 dark:bg-transparent text-slate-600 dark:text-slate-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

