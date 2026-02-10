"use client";

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

export const ConnectButton = () => {
  const {
    isConnected,
    selectedAccount,
    accounts,
    disconnect,
    selectAccount,
    openWalletModal,
  } = useWallet();

  if (isConnected && selectedAccount) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 shadow-none">
            <ChevronDown className="h-4 w-4" />
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">
              {formatWalletAddress(selectedAccount.address)}
            </span>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
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
          <DropdownMenuItem onClick={disconnect} className="text-green-600">
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openWalletModal}
      className="gap-2 shadow-none"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">Wallet</span>
      <div className="w-2 h-2 rounded-full bg-red-500"></div>
    </Button>
  );
};