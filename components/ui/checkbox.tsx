import * as React from "react"
import { cn } from "@/lib/utils"
import { OrderStatus } from "@/lib/types"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  status?: OrderStatus
  onCheckedChange?: (checked: boolean) => void
}

const getStatusColorClasses = (status?: OrderStatus) => {
  if (!status) {
    return "peer-checked:bg-primary peer-checked:text-primary-foreground"
  }
  
  switch (status) {
    case "Open":
      return "peer-checked:bg-blue-600 dark:peer-checked:bg-blue-400 peer-checked:text-white"
    case "Filled":
      return "peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-400 peer-checked:text-white"
    case "Closed":
      return "peer-checked:bg-red-600 dark:peer-checked:bg-red-400 peer-checked:text-white"
    case "Error":
      return "peer-checked:bg-rose-600 dark:peer-checked:bg-rose-400 peer-checked:text-white"
    case "Init":
      return "peer-checked:bg-amber-600 dark:peer-checked:bg-amber-400 peer-checked:text-white"
    case "Stopped":
      return "peer-checked:bg-slate-500 dark:peer-checked:bg-slate-400 peer-checked:text-white"
    default:
      return "peer-checked:bg-primary peer-checked:text-primary-foreground"
  }
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, status, onCheckedChange, checked, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked)
      }
    }

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            "w-4 h-4 rounded-sm bg-background cursor-pointer",
            "border-2 border-border",
            "peer-checked:border-0",
            "ring-0 focus-within:ring-0",
            getStatusColorClasses(status),
            "transition-all",
            "flex items-center justify-center",
            className
          )}
        >
          <span
            className={cn(
              "text-sm opacity-0 peer-checked:opacity-100 transition-opacity"
            )}
          >
            ✓
          </span>
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

