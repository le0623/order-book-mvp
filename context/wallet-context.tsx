'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'

interface WalletAccount {
    address: string
    name?: string
    source?: string
}

export type WalletType = 'polkadot-js' | 'bittensor-wallet' | 'nova' | 'talisman' | null

interface WalletContextType {
    accounts: WalletAccount[]
    selectedAccount: WalletAccount | null
    isConnected: boolean
    isConnecting: boolean
    walletType: WalletType
    availableWallets: { name: string; installed: boolean; extensionName: string }[]
    connect: (walletType: 'polkadot-js' | 'bittensor-wallet' | 'nova' | 'talisman') => Promise<void>
    disconnect: () => void
    selectAccount: (address: string) => void
    cancelConnection: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const WALLET_EXTENSIONS = {
    'polkadot-js': {
        name: 'Polkadot.js',
        extensionName: 'polkadot-js',
        possibleKeys: ['polkadot-js'],
        installUrl: 'https://polkadot.js.org/extension/'
    },
    'bittensor-wallet': {
        name: 'Bittensor Wallet',
        extensionName: 'bittensor-wallet',
        possibleKeys: ['@opentensor/bittensor-extension'],
        installUrl: 'https://chromewebstore.google.com/detail/bittensor-wallet/bdgmdoedahdcjmpmifafdhnffjinddgc'
    },
    'nova': {
        name: 'Nova Wallet',
        extensionName: 'nova',
        possibleKeys: ['nova', 'novawallet'],
        installUrl: 'https://novawallet.io/'
    },
    'talisman': {
        name: 'Talisman',
        extensionName: 'talisman',
        possibleKeys: ['talisman'],
        installUrl: 'https://talisman.xyz/'
    }
} as const

function findWalletExtension(possibleNames: readonly string[]): string | null {
    if (typeof window === 'undefined' || !window.injectedWeb3) {
        return null
    }

    for (const name of possibleNames) {
        if (window.injectedWeb3![name]) {
            return name
        }
    }

    return null
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const [accounts, setAccounts] = useState<WalletAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [walletType, setWalletType] = useState<WalletType>(null)
    const [availableWallets, setAvailableWallets] = useState<{ name: string; installed: boolean; extensionName: string }[]>([])

    // Track connection state for cancellation
    const connectionAbortController = useRef<AbortController | null>(null)
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const isConnected = accounts.length > 0 && selectedAccount !== null

    const checkAvailableWallets = useCallback(() => {
        if (typeof window === 'undefined') return

        const wallets = Object.entries(WALLET_EXTENSIONS).map(([key, value]) => {
            const foundExtension = findWalletExtension(value.possibleKeys)
            return {
                name: value.name,
                installed: !!foundExtension,
                extensionName: value.extensionName
            }
        })

        setAvailableWallets(wallets)
    }, [])

    useEffect(() => {
        checkAvailableWallets()

        const handleFocus = () => {
            setTimeout(checkAvailableWallets, 100)
        }
        window.addEventListener('focus', handleFocus)

        return () => {
            window.removeEventListener('focus', handleFocus)
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current)
            }
        }
    }, [checkAvailableWallets])

    const cancelConnection = useCallback(() => {
        if (connectionAbortController.current) {
            connectionAbortController.current.abort()
            connectionAbortController.current = null
        }
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current)
            connectionTimeoutRef.current = null
        }
        setIsConnecting(false)
    }, [])

    const connect = async (type: 'polkadot-js' | 'bittensor-wallet' | 'nova' | 'talisman') => {
        if (typeof window === 'undefined') {
            throw new Error('Window is not available')
        }

        cancelConnection()

        const abortController = new AbortController()
        connectionAbortController.current = abortController

        setIsConnecting(true)

        try {
            // Add timeout (30 seconds)
            const timeoutPromise = new Promise<never>((_, reject) => {
                connectionTimeoutRef.current = setTimeout(() => {
                    if (abortController.signal.aborted) return
                    reject(new Error('Connection timeout. Please try again.'))
                }, 30000) // 30 seconds
            })

            const extensionInfo = WALLET_EXTENSIONS[type]

            const extensionName = findWalletExtension(extensionInfo.possibleKeys)

            if (!extensionName) {
                const available = window.injectedWeb3 ? Object.keys(window.injectedWeb3) : []
                console.error(`Wallet not found. Available extensions:`, available)
                throw new Error(`${extensionInfo.name} extension not found. Available: ${available.join(', ') || 'none'}`)
            }

            const injected = window.injectedWeb3![extensionName]

            if (!injected) {
                throw new Error(`${extensionInfo.name} extension not found. Please install it first.`)
            }

            let extension
            try {
                // Race between enable and timeout
                extension = await Promise.race([
                    injected.enable('Infinity Exchange'),
                    timeoutPromise
                ]) as any

                if (abortController.signal.aborted) {
                    throw new Error('Connection cancelled')
                }

                // Small delay to ensure extension is fully initialized (especially for postMessage-based extensions)
                if (type === 'bittensor-wallet') {
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
            } catch (enableError: any) {
                if (abortController.signal.aborted) {
                    throw new Error('Connection cancelled')
                }

                // Better error messages for user rejection
                const errorMessage = enableError.message || 'Unknown error'
                if (errorMessage.includes('Rejected') || errorMessage.includes('User rejected') || errorMessage.includes('User cancelled') || errorMessage.includes('rejected')) {
                    throw new Error('Connection request was cancelled. Please try again when ready.')
                }

                console.error('Enable error:', enableError)
                throw new Error(`Failed to enable ${extensionInfo.name}: ${errorMessage}`)
            }

            if (abortController.signal.aborted) {
                throw new Error('Connection cancelled')
            }

            if (!extension) {
                throw new Error('Failed to enable wallet extension')
            }

            const accountsApi = extension.accounts

            if (!accountsApi) {
                console.error('Extension object:', extension)
                throw new Error('Wallet extension does not provide accounts API')
            }

            if (abortController.signal.aborted) {
                throw new Error('Connection cancelled')
            }

            let accounts
            try {
                // Race between get accounts and timeout
                const getAccountsPromise = (async () => {
                    // Bittensor extension uses standard Polkadot.js API
                    // Try get() without parameter first (most common)
                    if (typeof accountsApi.get === 'function') {
                        try {
                            return await accountsApi.get()
                        } catch (e: any) {
                            // If that fails, try with anyType parameter
                            console.warn('get() without parameter failed, trying with true:', e.message)
                            return await accountsApi.get(true)
                        }
                    } else {
                        throw new Error('Accounts API does not have a get() method')
                    }
                })()

                accounts = await Promise.race([
                    getAccountsPromise,
                    timeoutPromise
                ])

                if (abortController.signal.aborted) {
                    throw new Error('Connection cancelled')
                }

                if (!accounts || accounts.length === 0) {
                    throw new Error('No accounts returned from wallet')
                }
            } catch (getError: any) {
                if (abortController.signal.aborted) {
                    throw new Error('Connection cancelled')
                }
                console.error('Get accounts error:', getError)
                console.error('Accounts API:', accountsApi)
                console.error('Error stack:', getError.stack)
                throw new Error(`Failed to get accounts: ${getError.message || 'Unknown error'}`)
            }

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please create an account in the wallet extension.')
            }

            if (abortController.signal.aborted) {
                throw new Error('Connection cancelled')
            }

            const walletAccounts: WalletAccount[] = accounts.map((acc: any) => ({
                address: acc.address,
                name: acc.name || acc.meta?.name || 'Account',
                source: acc.meta?.source || extensionInfo.extensionName,
                meta: acc.meta
            }))

            if (abortController.signal.aborted) {
                throw new Error('Connection cancelled')
            }

            setAccounts(walletAccounts)
            setWalletType(type)

            if (walletAccounts.length > 0) {
                setSelectedAccount(walletAccounts[0])
            }

            if (extension.accounts.subscribe) {
                extension.accounts.subscribe((accounts: any[]) => {
                    const updatedAccounts = accounts.map((acc: any) => ({
                        address: acc.address,
                        name: acc.name || acc.meta?.name || 'Account',
                        source: acc.meta?.source || extensionInfo.extensionName,
                        meta: acc.meta
                    }))

                    setAccounts(updatedAccounts)

                    if (selectedAccount) {
                        const stillExists = updatedAccounts.find(
                            acc => acc.address === selectedAccount.address
                        )
                        if (stillExists) {
                            setSelectedAccount(stillExists)
                        } else if (updatedAccounts.length > 0) {
                            setSelectedAccount(updatedAccounts[0])
                        } else {
                            setSelectedAccount(null)
                        }
                    } else if (updatedAccounts.length > 0) {
                        setSelectedAccount(updatedAccounts[0])
                    }
                })
            }

            checkAvailableWallets()
        } catch (error: any) {
            // Don't show error if it was cancelled
            if (error.message === 'Connection cancelled') {
                return // Silently cancel
            }

            console.error('Failed to connect wallet:', error)
            if (process.env.NODE_ENV === 'development') {
                console.error('Error details:', {
                    type,
                    windowInjectedWeb3: window.injectedWeb3 ? Object.keys(window.injectedWeb3) : null,
                    error: error.message,
                    stack: error.stack
                })
            }
            throw error
        } finally {
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current)
                connectionTimeoutRef.current = null
            }

            if (!abortController.signal.aborted) {
                setIsConnecting(false)
            }
            connectionAbortController.current = null
        }
    }

    const disconnect = () => {
        setAccounts([])
        setSelectedAccount(null)
        setWalletType(null)
    }

    const selectAccount = (address: string) => {
        const account = accounts.find(acc => acc.address === address)
        if (account) {
            setSelectedAccount(account)
        }
    }

    return (
        <WalletContext.Provider
            value={{
                accounts,
                selectedAccount,
                isConnected,
                isConnecting,
                walletType,
                availableWallets,
                connect,
                disconnect,
                selectAccount,
                cancelConnection,
            }}
        >
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}