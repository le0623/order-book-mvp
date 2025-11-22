# SPA Exchange - Order Book MVP

A Next.js-based order book interface for a decentralized exchange with expandable rows showing order history and actions.

## Features

- **Order Book Table**: Displays all orders with key information
- **Expandable Rows**: Click any row to view detailed history and actions
- **Order Actions**: Update Ask/Bid prices, Cancel, or Accept orders (for Open orders)
- **Status Tracking**: Visual status badges for different order states
- **Mock Data**: Functional UI with sample data
- **Responsive Design**: Clean, modern DeFi/crypto themed interface

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript**
- **ShadCN UI** components
- **Tailwind CSS** for styling
- **Lucide React** for icons

## Getting Started

### Install Dependencies

```bash
yarn install
```

### Run Development Server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
yarn build
yarn start
```

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Import your repository in Vercel
3. Vercel will automatically detect Next.js and configure the build settings
4. Deploy!

Or use the Vercel CLI:

```bash
yarn global add vercel
vercel
```


## Order Book Columns

- **Date**: UTC timestamp
- **Order**: Buy or Sell
- **SN**: Subnet number
- **Wallet**: SS58 address (truncated)
- **Size**: Wallet size in Tao
- **Ask**: Ask price in Tao
- **Bid**: Bid price in Tao
- **Partial**: Yes/No
- **Status**: Open, Pending, Canceled, Failed, Partial, Completed

## Future Enhancements

- Wallet connection integration
- Real-time order updates
- Order filtering and sorting
- Pagination for large datasets
- Order creation interface
- API integration

