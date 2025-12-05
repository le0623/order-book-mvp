# EXFE Order Book 

A Next.js-based order book interface for a decentralized exchange with expandable rows showing order history and actions.

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

