import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
    }
  }

  interface InjectedAccount {
    address: string
    genesisHash?: string | null
    name?: string | null
    type?: string
    meta?: {
      name?: string
      source: string
    }
  }

  interface InjectedAccounts {
    get: (anyType?: boolkean) => Promise<InjectedAccount[]>
    subscribe: (cb: (accounts: InjectedAccount[]) => void) => () => void
  }

  interface InjectedExtension {
    accounts: InjectedAccounts
    provider?: any
    signer?: any
    name: string
    version: string
  }

  interface Window {
    injectedWeb3?: {
      [key: string]: {
        enable: (origin: string) => Promise<InjectedExtension>
        accounts?: InjectedAccounts
        version?: string
      }
    }
    bittensor?: any
  }
}

export {};

