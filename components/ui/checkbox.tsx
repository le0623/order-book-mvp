import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { OrderStatus } from "@/lib/mock-data"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  status?: OrderStatus
}

const getStatusColorClasses = (status?: OrderStatus) => {
  if (!status) {
    return "peer-checked:bg-primary peer-checked:text-primary-foreground"
  }
  
  switch (status) {
    case "Open":
      return "peer-checked:bg-blue-600 dark:peer-checked:bg-blue-400 peer-checked:text-white"
    case "Completed":
      return "peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-400 peer-checked:text-white"
    case "Canceled":
      return "peer-checked:bg-red-600 dark:peer-checked:bg-red-400 peer-checked:text-white"
    case "Failed":
      return "peer-checked:bg-rose-600 dark:peer-checked:bg-rose-400 peer-checked:text-white"
    case "Pending":
      return "peer-checked:bg-amber-600 dark:peer-checked:bg-amber-400 peer-checked:text-white"
    case "Partial":
      return "peer-checked:bg-slate-500 dark:peer-checked:bg-slate-400 peer-checked:text-white"
    default:
      return "peer-checked:bg-primary peer-checked:text-primary-foreground"
  }
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, status, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="border-none active:border-none focus:border-none focus-visible:border-none active:outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 sr-only peer outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"          ref={ref}
          {...props}
        />
        <div
          className={cn(
            "w-4 h-4 rounded-sm bg-background",
            "border-2 border-border",
            "peer-checked:border-0",
            "peer-focus:border-0 peer-focus-visible:border-0",
            "peer-active:border-0 peer-hover:border-0",
            "ring-0 focus-within:ring-0",
            getStatusColorClasses(status),
            "peer-focus-visible:outline-none peer-focus:outline-none",
            "transition-all",
            "flex items-center justify-center",
            className
          )}
        >
          <Check
            className={cn(
              "h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
            )}
          />
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

