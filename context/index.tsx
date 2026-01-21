'use client'

import React, { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { config, networks, projectId, wagmiAdapter } from '@/config'
import { mainnet } from '@reown/appkit/networks'

const queryClient = new QueryClient()

const metadata = {
  name: '',
  description: '',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000', 
  icons: [], 
}

let appKitInitialized = false

export default function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null 
}) {
  const initialState = cookieToInitialState(config as Config, cookies)

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

