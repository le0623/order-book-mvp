'use client';

import { useState, useCallback, useRef } from 'react';
import { transferTao, transferAlpha, TransferResult } from '@/lib/bittensor';
import { useWallet } from '@/context/wallet-context';

export type TransferStatus =
  | 'idle'
  | 'connecting'
  | 'signing'
  | 'broadcasting'
  | 'in_block'
  | 'finalized'
  | 'error';

export interface TransferState {
  /** Current status of the transfer */
  status: TransferStatus;
  /** Human-readable status message */
  statusMessage: string;
  /** Error message if status === 'error' */
  error: string | null;
  /** Result after successful transfer */
  result: TransferResult | null;
  /** Whether a transfer is currently in progress */
  isTransferring: boolean;
}

/** Return type for sendTao / sendAlpha — always includes the error so callers don't need to rely on async state. */
export interface TransferOutcome {
  result: TransferResult | null;
  error: string | null;
}

/**
 * React hook for performing on-chain Bittensor transfers.
 *
 * Uses the connected wallet's signer to sign and submit transactions.
 */
export function useBittensorTransfer() {
  const { selectedAccount, getSigner, isConnected } = useWallet();

  const [state, setState] = useState<TransferState>({
    status: 'idle',
    statusMessage: '',
    error: null,
    result: null,
    isTransferring: false,
  });

  // Prevent double-submission
  const transferringRef = useRef(false);

  const handleStatusChange = useCallback((message: string) => {
    setState((prev) => {
      let status: TransferStatus = prev.status;
      if (message.includes('Connecting')) status = 'connecting';
      else if (message.includes('Waiting for wallet')) status = 'signing';
      else if (message.includes('Ready') || message.includes('Broadcast')) status = 'broadcasting';
      else if (message.includes('included in block')) status = 'in_block';
      else if (message.includes('Finalized')) status = 'finalized';
      return { ...prev, status, statusMessage: message };
    });
  }, []);

  /**
   * Transfer TAO to the escrow wallet.
   *
   * @param toAddress - Escrow wallet address
   * @param taoAmount - Amount of TAO to transfer
   * @returns TransferOutcome with result on success, or error message on failure
   */
  const sendTao = useCallback(
    async (toAddress: string, taoAmount: number): Promise<TransferOutcome> => {
      if (transferringRef.current) return { result: null, error: 'Transfer already in progress' };
      if (!isConnected || !selectedAccount) {
        const error = 'Wallet not connected. Please connect your wallet first';
        setState((prev) => ({ ...prev, status: 'error', error, isTransferring: false }));
        return { result: null, error };
      }

      const signer = getSigner();
      if (!signer) {
        const error = 'Wallet signer not available. Please reconnect your wallet';
        setState((prev) => ({ ...prev, status: 'error', error, isTransferring: false }));
        return { result: null, error };
      }

      transferringRef.current = true;
      setState({
        status: 'connecting',
        statusMessage: 'Initiating TAO transfer...',
        error: null,
        result: null,
        isTransferring: true,
      });

      try {
        const result = await transferTao(
          selectedAccount.address,
          toAddress,
          taoAmount,
          signer,
          handleStatusChange,
        );

        setState({
          status: 'finalized',
          statusMessage: `Transfer complete! TX: ${result.txHash.slice(0, 10)}...`,
          error: null,
          result,
          isTransferring: false,
        });

        return { result, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transfer failed';
        setState({
          status: 'error',
          statusMessage: '',
          error: message,
          result: null,
          isTransferring: false,
        });
        return { result: null, error: message };
      } finally {
        transferringRef.current = false;
      }
    },
    [isConnected, selectedAccount, getSigner, handleStatusChange],
  );

  /**
   * Transfer Alpha tokens to the escrow wallet.
   *
   * @param toAddress   - Escrow wallet address
   * @param alphaAmount - Amount of Alpha to transfer
   * @param netuid      - Subnet ID for the alpha token
   * @returns TransferOutcome with result on success, or error message on failure
   */
  const sendAlpha = useCallback(
    async (toAddress: string, alphaAmount: number, netuid: number): Promise<TransferOutcome> => {
      if (transferringRef.current) return { result: null, error: 'Transfer already in progress' };
      if (!isConnected || !selectedAccount) {
        const error = 'Wallet not connected. Please connect your wallet first';
        setState((prev) => ({ ...prev, status: 'error', error, isTransferring: false }));
        return { result: null, error };
      }

      const signer = getSigner();
      if (!signer) {
        const error = 'Wallet signer not available. Please reconnect your wallet';
        setState((prev) => ({ ...prev, status: 'error', error, isTransferring: false }));
        return { result: null, error };
      }

      transferringRef.current = true;
      setState({
        status: 'connecting',
        statusMessage: 'Initiating Alpha transfer...',
        error: null,
        result: null,
        isTransferring: true,
      });

      try {
        const result = await transferAlpha(
          selectedAccount.address,
          toAddress,
          alphaAmount,
          netuid,
          signer,
          handleStatusChange,
        );

        setState({
          status: 'finalized',
          statusMessage: `Transfer complete! TX: ${result.txHash.slice(0, 10)}...`,
          error: null,
          result,
          isTransferring: false,
        });

        return { result, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transfer failed';
        setState({
          status: 'error',
          statusMessage: '',
          error: message,
          result: null,
          isTransferring: false,
        });
        return { result: null, error: message };
      } finally {
        transferringRef.current = false;
      }
    },
    [isConnected, selectedAccount, getSigner, handleStatusChange],
  );

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      statusMessage: '',
      error: null,
      result: null,
      isTransferring: false,
    });
  }, []);

  return {
    ...state,
    sendTao,
    sendAlpha,
    reset,
  };
}
