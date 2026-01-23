"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle2, XCircle, X } from "lucide-react";
import { useWallet } from "@/context/wallet-context";

interface WalletModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const WALLET_INFO = {
    'polkadot-js': {
        name: 'Polkadot.js',
        description: 'Official Polkadot browser extension',
        icon: '🔵',
        installUrl: 'https://polkadot.js.org/extension/'
    },
    'bittensor-wallet': {
        name: 'Bittensor Wallet',
        description: 'Bittensor wallet extension',
        icon: '🧠',
        installUrl: 'https://chromewebstore.google.com/detail/bittensor-wallet/bdgmdoedahdcjmpmifafdhnffjinddgc'
    }
} as const

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
    const { availableWallets, connect, isConnecting, isConnected, cancelConnection } = useWallet();
    const [error, setError] = useState<string>("");
    const [connectingTo, setConnectingTo] = useState<string | null>(null);

    // Cancel connection when modal is closed while connecting
    useEffect(() => {
        if (!open && isConnecting) {
            cancelConnection();
            setConnectingTo(null);
            setError("");
        }
    }, [open, isConnecting, cancelConnection]);

    const handleConnect = async (walletType: 'polkadot-js' | 'bittensor-wallet') => {
        setError("");
        setConnectingTo(walletType);

        try {
            await connect(walletType);
            onOpenChange(false);
        } catch (err: any) {
            // Don't show error if it was cancelled
            if (err.message !== 'Connection cancelled') {
                setError(err.message || `Failed to connect to ${WALLET_INFO[walletType].name}`);
            }
        } finally {
            setConnectingTo(null);
        }
    };

    const handleCancel = () => {
        cancelConnection();
        setConnectingTo(null);
        setError("");
    };

    const handleInstall = (walletType: 'polkadot-js' | 'bittensor-wallet') => {
        window.open(WALLET_INFO[walletType].installUrl, '_blank');
    };

    const isWalletInstalled = (extensionName: string) => {
        return availableWallets.some(w => w.extensionName === extensionName && w.installed);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Wallet</DialogTitle>
                    <DialogDescription>
                        Choose a wallet to connect to your account
                    </DialogDescription>
                </DialogHeader>

                {/* Show cancel button when connecting */}
                {isConnecting && connectingTo && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Waiting for {WALLET_INFO[connectingTo as keyof typeof WALLET_INFO].name}...</span>
                        </div>
                        <Button
                            onClick={handleCancel}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <X className="h-4 w-4" />
                            Cancel
                        </Button>
                    </div>
                )}

                <div className="space-y-3 py-4">
                    {/* Polkadot.js Wallet */}
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden">
                                <Image
                                    src="/polkadot-wallet.png"
                                    alt="Polkadot.js Wallet"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div>
                                <div className="font-medium">{WALLET_INFO['polkadot-js'].name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {WALLET_INFO['polkadot-js'].description}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isWalletInstalled('polkadot-js') ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <Button
                                        onClick={() => handleConnect('polkadot-js')}
                                        disabled={isConnecting || isConnected}
                                        size="sm"
                                    >
                                        {connectingTo === 'polkadot-js' ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            'Connect'
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-5 w-5 text-muted-foreground" />
                                    <Button
                                        onClick={() => handleInstall('polkadot-js')}
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Install
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bittensor Wallet */}
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden">
                                <Image
                                    src="/bittesnor-wallet.png"
                                    alt="Bittensor Wallet"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div>
                                <div className="font-medium">{WALLET_INFO['bittensor-wallet'].name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {WALLET_INFO['bittensor-wallet'].description}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isWalletInstalled('bittensor-wallet') ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <Button
                                        onClick={() => handleConnect('bittensor-wallet')}
                                        disabled={isConnecting || isConnected}
                                        size="sm"
                                    >
                                        {connectingTo === 'bittensor-wallet' ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            'Connect'
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-5 w-5 text-muted-foreground" />
                                    <Button
                                        onClick={() => handleInstall('bittensor-wallet')}
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Install
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                        {error}
                    </div>
                )}

                {isConnected && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                        Wallet connected successfully!
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}