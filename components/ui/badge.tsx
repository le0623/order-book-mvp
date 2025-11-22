import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-green-600 text-white",
        warning: "border-transparent bg-yellow-600 text-white",
        buy: "border-transparent bg-transparent text-green-600 dark:text-green-400 shadow-[0_1px_3px_rgba(34,197,94,0.3)] dark:shadow-[0_1px_3px_rgba(74,222,128,0.25)]",
        sell: "border-transparent bg-transparent text-red-600 dark:text-red-400 shadow-[0_1px_3px_rgba(239,68,68,0.3)] dark:shadow-[0_1px_3px_rgba(248,113,113,0.25)]",
        statusOpen: "border-transparent bg-transparent text-blue-600 dark:text-blue-400 shadow-[0_1px_3px_rgba(37,99,235,0.3)] dark:shadow-[0_1px_3px_rgba(96,165,250,0.25)]",
        statusCompleted: "border-transparent bg-transparent text-emerald-600 dark:text-emerald-400 shadow-[0_1px_3px_rgba(5,150,105,0.3)] dark:shadow-[0_1px_3px_rgba(52,211,153,0.25)]",
        statusCanceled: "border-transparent bg-transparent text-red-600 dark:text-red-400 shadow-[0_1px_3px_rgba(239,68,68,0.3)] dark:shadow-[0_1px_3px_rgba(248,113,113,0.25)]",
        statusFailed: "border-transparent bg-transparent text-rose-600 dark:text-rose-400 shadow-[0_1px_3px_rgba(225,29,72,0.3)] dark:shadow-[0_1px_3px_rgba(251,113,133,0.25)]",
        statusPending: "border-transparent bg-transparent text-amber-600 dark:text-amber-400 shadow-[0_1px_3px_rgba(217,119,6,0.3)] dark:shadow-[0_1px_3px_rgba(251,191,36,0.25)]",
        statusPartial: "border-transparent bg-transparent text-slate-500 dark:text-slate-400 shadow-[0_1px_3px_rgba(100,116,139,0.3)] dark:shadow-[0_1px_3px_rgba(148,163,184,0.25)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

