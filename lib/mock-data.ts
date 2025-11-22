export type OrderType = "Sell" | "Buy"
export type OrderStatus = "Open" | "Pending" | "Canceled" | "Failed" | "Partial" | "Completed"

export interface OrderHistory {
  timestamp: Date
  ask?: number
  bid?: number
  status: OrderStatus
}

export interface Order {
  id: string
  date: Date
  order: OrderType
  sn: number
  wallet: string
  size: number
  ask: number
  bid: number
  partial: boolean
  status: OrderStatus
  history: OrderHistory[]
}

const formatWalletAddress = (address: string) => {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

const generateOrder = (
  id: string,
  date: Date,
  orderType: OrderType,
  sn: number,
  wallet: string,
  size: number,
  ask: number,
  bid: number,
  partial: boolean,
  status: OrderStatus,
  history: OrderHistory[]
): Order => ({
  id,
  date,
  order: orderType,
  sn,
  wallet,
  size,
  ask,
  bid,
  partial,
  status,
  history,
})

export const mockOrders: Order[] = [
  // Original 8 orders
  generateOrder("1", new Date("2024-01-15T10:30:00Z"), "Sell", 3, "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 1250.5, 42.5, 38.0, false, "Open", [
    { timestamp: new Date("2024-01-15T10:30:00Z"), ask: 42.5, bid: 38.0, status: "Open" },
  ]),
  generateOrder("2", new Date("2024-01-15T09:15:00Z"), "Buy", 2, "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", 890.25, 45.0, 40.5, true, "Partial", [
    { timestamp: new Date("2024-01-15T09:15:00Z"), ask: 45.0, bid: 40.5, status: "Open" },
    { timestamp: new Date("2024-01-15T09:45:00Z"), ask: 45.0, bid: 40.5, status: "Partial" },
  ]),
  generateOrder("3", new Date("2024-01-15T08:00:00Z"), "Sell", 5, "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", 2100.75, 48.75, 44.0, false, "Completed", [
    { timestamp: new Date("2024-01-15T08:00:00Z"), ask: 48.75, bid: 44.0, status: "Open" },
    { timestamp: new Date("2024-01-15T08:30:00Z"), ask: 48.75, bid: 44.0, status: "Pending" },
    { timestamp: new Date("2024-01-15T09:00:00Z"), ask: 48.75, bid: 44.0, status: "Completed" },
  ]),
  generateOrder("4", new Date("2024-01-15T07:30:00Z"), "Buy", 1, "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3vBXBu", 550.0, 50.0, 46.5, false, "Canceled", [
    { timestamp: new Date("2024-01-15T07:30:00Z"), ask: 50.0, bid: 46.5, status: "Open" },
    { timestamp: new Date("2024-01-15T08:00:00Z"), ask: 50.0, bid: 46.5, status: "Canceled" },
  ]),
  generateOrder("5", new Date("2024-01-15T06:45:00Z"), "Sell", 4, "5D4zctgvtF8gcBCY3G4wrW6N9cMmYy6Lb8L8HqX8qQjJNxZD", 1750.25, 39.5, 35.0, false, "Pending", [
    { timestamp: new Date("2024-01-15T06:45:00Z"), ask: 39.5, bid: 35.0, status: "Open" },
    { timestamp: new Date("2024-01-15T07:15:00Z"), ask: 39.5, bid: 35.0, status: "Pending" },
  ]),
  generateOrder("6", new Date("2024-01-15T05:20:00Z"), "Buy", 6, "5CqWyPjqhXqJ6qJ6qJ6qJ6qJ6qJ6qJ6qJ6qJ6qJ6qJ6qJ6q", 3200.0, 52.25, 48.0, true, "Partial", [
    { timestamp: new Date("2024-01-15T05:20:00Z"), ask: 52.25, bid: 48.0, status: "Open" },
    { timestamp: new Date("2024-01-15T06:00:00Z"), ask: 52.25, bid: 48.0, status: "Partial" },
  ]),
  generateOrder("7", new Date("2024-01-15T04:10:00Z"), "Sell", 2, "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMxvg6ARvwkf6UNwqG8Q", 980.5, 41.0, 37.5, false, "Failed", [
    { timestamp: new Date("2024-01-15T04:10:00Z"), ask: 41.0, bid: 37.5, status: "Open" },
    { timestamp: new Date("2024-01-15T04:40:00Z"), ask: 41.0, bid: 37.5, status: "Failed" },
  ]),
  generateOrder("8", new Date("2024-01-15T03:00:00Z"), "Buy", 3, "5CVZqRxCCPBq8vXhQVrFQJqzJz9vWjJv9Jv9Jv9Jv9Jv9J", 1450.75, 43.75, 39.25, false, "Open", [
    { timestamp: new Date("2024-01-15T03:00:00Z"), ask: 43.75, bid: 39.25, status: "Open" },
  ]),
  
  // Additional 16 orders (total 24)
  generateOrder("9", new Date("2024-01-15T02:30:00Z"), "Sell", 7, "5D8LxRqN2vXz9pK7mW4tY3nC6bJ1hG5fE8aS2dF9gH4jK7l", 2100.0, 44.5, 40.0, false, "Open", [
    { timestamp: new Date("2024-01-15T02:30:00Z"), ask: 44.5, bid: 40.0, status: "Open" },
  ]),
  generateOrder("10", new Date("2024-01-15T01:45:00Z"), "Buy", 4, "5E9MySrO3wYa0qL8nX5uZ4oD7cK2iH6gF9bT3eG0hI5kL8m", 1650.5, 47.25, 43.0, true, "Partial", [
    { timestamp: new Date("2024-01-15T01:45:00Z"), ask: 47.25, bid: 43.0, status: "Open" },
    { timestamp: new Date("2024-01-15T02:15:00Z"), ask: 47.25, bid: 43.0, status: "Partial" },
  ]),
  generateOrder("11", new Date("2024-01-15T00:20:00Z"), "Sell", 8, "5F0NzTsP4xZb1rM9oY6vA5pE8dL3jI7hG0cU4fH1iJ6lM9n", 3200.25, 49.0, 45.5, false, "Completed", [
    { timestamp: new Date("2024-01-15T00:20:00Z"), ask: 49.0, bid: 45.5, status: "Open" },
    { timestamp: new Date("2024-01-15T00:50:00Z"), ask: 49.0, bid: 45.5, status: "Pending" },
    { timestamp: new Date("2024-01-15T01:20:00Z"), ask: 49.0, bid: 45.5, status: "Completed" },
  ]),
  generateOrder("12", new Date("2024-01-14T23:30:00Z"), "Buy", 5, "5G1OaUtQ5yAc2sN0pZ7wB6qF9eM4kJ8iH1dV5gI2jK7mN0o", 980.75, 41.5, 38.0, false, "Open", [
    { timestamp: new Date("2024-01-14T23:30:00Z"), ask: 41.5, bid: 38.0, status: "Open" },
  ]),
  generateOrder("13", new Date("2024-01-14T22:15:00Z"), "Sell", 3, "5H2PbVuR6zBd3tO1qA8xC7rG0fN5lK9jI2eW6hJ3kL8nO1p", 2750.5, 46.25, 42.0, false, "Pending", [
    { timestamp: new Date("2024-01-14T22:15:00Z"), ask: 46.25, bid: 42.0, status: "Open" },
    { timestamp: new Date("2024-01-14T22:45:00Z"), ask: 46.25, bid: 42.0, status: "Pending" },
  ]),
  generateOrder("14", new Date("2024-01-14T21:00:00Z"), "Buy", 9, "5I3QcWvS7aCe4uP2rB9yD8sH1gO6mL0kK3fX7iK4lM9oP2q", 1450.0, 50.75, 46.25, true, "Partial", [
    { timestamp: new Date("2024-01-14T21:00:00Z"), ask: 50.75, bid: 46.25, status: "Open" },
    { timestamp: new Date("2024-01-14T21:40:00Z"), ask: 50.75, bid: 46.25, status: "Partial" },
  ]),
  generateOrder("15", new Date("2024-01-14T20:30:00Z"), "Sell", 1, "5J4RdXwT8bDf5vQ3sC0zE9tI2hP7nM1lL4gY8jL5mN0pQ3r", 890.25, 43.0, 39.5, false, "Failed", [
    { timestamp: new Date("2024-01-14T20:30:00Z"), ask: 43.0, bid: 39.5, status: "Open" },
    { timestamp: new Date("2024-01-14T21:00:00Z"), ask: 43.0, bid: 39.5, status: "Failed" },
  ]),
  generateOrder("16", new Date("2024-01-14T19:15:00Z"), "Buy", 6, "5K5SeYxU9cEg6wR4tD1aF0uJ3iQ8oN2mM5hZ9kM6nO1qR4s", 2100.75, 48.5, 44.25, false, "Canceled", [
    { timestamp: new Date("2024-01-14T19:15:00Z"), ask: 48.5, bid: 44.25, status: "Open" },
    { timestamp: new Date("2024-01-14T19:45:00Z"), ask: 48.5, bid: 44.25, status: "Canceled" },
  ]),
  generateOrder("17", new Date("2024-01-14T18:00:00Z"), "Sell", 4, "5L6TfZyV0dFh7xS5uE2bG1vK4jR9pO3nN6iA0lN7oP2rS5t", 1650.5, 45.75, 41.5, false, "Open", [
    { timestamp: new Date("2024-01-14T18:00:00Z"), ask: 45.75, bid: 41.5, status: "Open" },
  ]),
  generateOrder("18", new Date("2024-01-14T17:30:00Z"), "Buy", 2, "5M7UgAzW1eGi8yT6vF3cH2wL5kS0qP4oO7jB1mO8pQ3sT6u", 3200.0, 51.25, 47.0, true, "Partial", [
    { timestamp: new Date("2024-01-14T17:30:00Z"), ask: 51.25, bid: 47.0, status: "Open" },
    { timestamp: new Date("2024-01-14T18:10:00Z"), ask: 51.25, bid: 47.0, status: "Partial" },
  ]),
  generateOrder("19", new Date("2024-01-14T16:15:00Z"), "Sell", 7, "5N8VhBaX2fHj9zU7wG4dI3xM6lT1rQ5pP8kC2nP9qR4tU7v", 980.5, 42.25, 38.75, false, "Completed", [
    { timestamp: new Date("2024-01-14T16:15:00Z"), ask: 42.25, bid: 38.75, status: "Open" },
    { timestamp: new Date("2024-01-14T16:45:00Z"), ask: 42.25, bid: 38.75, status: "Pending" },
    { timestamp: new Date("2024-01-14T17:15:00Z"), ask: 42.25, bid: 38.75, status: "Completed" },
  ]),
  generateOrder("20", new Date("2024-01-14T15:00:00Z"), "Buy", 5, "5O9WiCbY3gIk0aV8xH5eJ4yN7mU2sR6qQ9lD3oQ0rS5uV8w", 2750.25, 49.5, 45.0, false, "Pending", [
    { timestamp: new Date("2024-01-14T15:00:00Z"), ask: 49.5, bid: 45.0, status: "Open" },
    { timestamp: new Date("2024-01-14T15:30:00Z"), ask: 49.5, bid: 45.0, status: "Pending" },
  ]),
  generateOrder("21", new Date("2024-01-14T14:30:00Z"), "Sell", 8, "5P0XjDcZ4hJl1bW9yI6fK5zO8nV3tS7rR0mE4pR1sT6vW9x", 1450.75, 44.0, 40.25, false, "Open", [
    { timestamp: new Date("2024-01-14T14:30:00Z"), ask: 44.0, bid: 40.25, status: "Open" },
  ]),
  generateOrder("22", new Date("2024-01-14T13:15:00Z"), "Buy", 3, "5Q1YkEdA5iKm2cX0zJ7gL6aP9oW4uT8sS1nF5qS2tU7wX0y", 890.0, 47.75, 43.5, true, "Partial", [
    { timestamp: new Date("2024-01-14T13:15:00Z"), ask: 47.75, bid: 43.5, status: "Open" },
    { timestamp: new Date("2024-01-14T13:55:00Z"), ask: 47.75, bid: 43.5, status: "Partial" },
  ]),
  generateOrder("23", new Date("2024-01-14T12:00:00Z"), "Sell", 6, "5R2ZlFeB6jLn3dY1aK8hM7bQ0pX5vU9tT2oG6rT3uV8xY1z", 2100.5, 46.5, 42.75, false, "Failed", [
    { timestamp: new Date("2024-01-14T12:00:00Z"), ask: 46.5, bid: 42.75, status: "Open" },
    { timestamp: new Date("2024-01-14T12:30:00Z"), ask: 46.5, bid: 42.75, status: "Failed" },
  ]),
  generateOrder("24", new Date("2024-01-14T11:30:00Z"), "Buy", 4, "5S3AmGfC7kMo4eZ2bL9iN8cR1qY6wV0uU3pH7sU4vW9yZ2a", 3200.75, 52.5, 48.25, false, "Canceled", [
    { timestamp: new Date("2024-01-14T11:30:00Z"), ask: 52.5, bid: 48.25, status: "Open" },
    { timestamp: new Date("2024-01-14T12:00:00Z"), ask: 52.5, bid: 48.25, status: "Canceled" },
  ]),
]

export { formatWalletAddress }

