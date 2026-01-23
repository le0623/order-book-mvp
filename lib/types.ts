export type OrderType = "Sell" | "Buy"
export type OrderStatus = "Init" | "Open" | "Filled" | "Error" | "Closed" | "Stopped" | "Expired"

export interface Order {
  uuid: string // Order UUID from backend (unique identifier)
  date: string // datetime UTC (ISO format)
  origin: string // ss58 address (order creator)
  escrow: string // ss58 address (escrow wallet for funds)
  wallet: string // ss58 address (user's wallet)
  asset: number // +n: netuid, -n: ts index
  type: number // 1: sell, 2: buy
  ask: number // ask price
  bid: number // bid price
  stp: number // stop price
  lmt: number // limit price
  gtd: string // good till datetime UTC
  partial: boolean // allow partial fills
  public: boolean // public order
  status: number // -1: init, 1: open, 2: filled, 3: closed, 4: error, 5: stopped, 6: expired
}

export interface NewOrderFormData {
  type: number // 1: sell, 2: buy
  asset: number // subnet ID
  gtd: string // good till date (ISO string or "gtc")
  stp: number // stop price
  partial: boolean // allow partial fills
  public: boolean // public order visibility
}

export const formatWalletAddress = (address: string) => {
  if (!address) return '—';
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export const getOrderType = (type: number): OrderType => {
  return type === 1 ? "Sell" : "Buy"
}

export const getOrderStatus = (status: number): OrderStatus => {
  switch (status) {
    case -1:
    case 0: return "Init"
    case 1: return "Open"
    case 2: return "Filled"
    case 3: return "Closed"
    case 4: return "Error"
    case 5: return "Stopped"
    case 6: return "Expired"
    default: return "Init"
  }
}
