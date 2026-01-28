"use client";

import { useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatWalletAddress } from "@/lib/types";
import { WalletModal } from "./wallet-modal";

export const ConnectButton = () => {
  const {
    isConnected,
    selectedAccount,
    accounts,
    disconnect,
    selectAccount
  } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  if (isConnected && selectedAccount) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shadow-none">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">
                {formatWalletAddress(selectedAccount.address)}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Connected Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.map((account) => (
              <DropdownMenuItem
                key={account.address}
                onClick={() => selectAccount(account.address)}
                className={selectedAccount.address === account.address ? "bg-accent" : ""}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{account.name || "Account"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatWalletAddress(account.address)}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={disconnect} className="text-red-600">
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="gap-2 shadow-none"
      >
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Wallet</span>
      </Button>
      <WalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
};