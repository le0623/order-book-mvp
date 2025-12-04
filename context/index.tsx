'use client'

import React, { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
// Import config, networks, projectId, and wagmiAdapter from your config file
import { config, networks, projectId, wagmiAdapter } from '@/config'
// Import the default network separately if needed
import { mainnet } from '@reown/appkit/networks'

const queryClient = new QueryClient()

const metadata = {
  name: 'SPA Exchange - Order Book',
  description: 'Decentralized order book exchange MVP',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000', 
  icons: [], 
}

// Flag to ensure AppKit is only initialized once on the client
let appKitInitialized = false

export default function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null 
}) {
  const initialState = cookieToInitialState(config as Config, cookies)

  // Initialize AppKit only on the client side to prevent hydration errors
  useEffect(() => {
    if (typeof window !== 'undefined' && !appKitInitialized && projectId) {
      createAppKit({
        adapters: [wagmiAdapter],
        projectId: projectId!,
        networks: networks,
        defaultNetwork: mainnet, 
        metadata,
        themeMode: 'dark',
        features: { analytics: true }, 
        themeVariables: {
          '--w3m-accent': '#000000',
        }
      })
      appKitInitialized = true
    } else if (!projectId) {
      console.error("AppKit Initialization Error: Project ID is missing.");
    }
  }, [])

  return (
    <WagmiProvider config={config as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

