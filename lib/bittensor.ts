import { ApiPromise, WsProvider } from '@polkadot/api';

// Bittensor mainnet RPC endpoint
const BITTENSOR_RPC_URL =
  process.env.NEXT_PUBLIC_BITTENSOR_RPC_URL ||
  'wss://bittensor-finney.api.onfinality.io/ws?apikey=6ca72fe1-97a6-44c5-8621-28e8dcd9e754';

// Singleton API instance (shared across the app lifetime)
let apiInstance: ApiPromise | null = null;
let apiPromiseInFlight: Promise<ApiPromise> | null = null;

/**
 * Get (or create) a connected ApiPromise to the Bittensor mainnet.
 * Uses a singleton pattern so we only open one WebSocket connection.
 */
export async function getApi(): Promise<ApiPromise> {
  if (apiInstance && apiInstance.isConnected) {
    return apiInstance;
  }

  // If a connection attempt is already in progress, wait for it
  if (apiPromiseInFlight) {
    return apiPromiseInFlight;
  }

  apiPromiseInFlight = (async () => {
    try {
      const provider = new WsProvider(BITTENSOR_RPC_URL);
      const api = await ApiPromise.create({ provider });
      apiInstance = api;

      // Handle disconnection so we reconnect on next call
      api.on('disconnected', () => {
        console.warn('[Bittensor] API disconnected');
        apiInstance = null;
      });

      console.log('[Bittensor] API connected to', BITTENSOR_RPC_URL);
      return api;
    } finally {
      apiPromiseInFlight = null;
    }
  })();

  return apiPromiseInFlight;
}

/**
 * Disconnect the singleton API if it exists.
 */
export async function disconnectApi(): Promise<void> {
  if (apiInstance) {
    await apiInstance.disconnect();
    apiInstance = null;
  }
}

// 1 TAO = 10^9 rao (Bittensor smallest unit)
const RAO_PER_TAO = BigInt(1_000_000_000);

/**
 * Fetch the free (transferable) TAO balance for an SS58 address.
 * Queries system.account on the Bittensor chain.
 *
 * @returns TAO balance as a number (e.g. 12.345)
 */
export async function fetchTaoBalance(ss58Address: string): Promise<number> {
  const api = await getApi();
  const { data } = await api.query.system.account(ss58Address) as unknown as {
    data: { free: { toBigInt(): bigint } };
  };
  return raoToTao(data.free.toBigInt());
}

/**
 * Fetch the Alpha (stake) balance for a coldkey on a specific subnet.
 * Sums all stake entries on the given netuid from the /stake endpoint.
 *
 * @returns Alpha balance as a number (e.g. 5.25)
 */
export async function fetchAlphaBalance(
  coldkeySs58: string,
  netuid: number,
): Promise<number> {
  const stakes = await fetchStakeInfo(coldkeySs58);
  const matching = stakes.filter((s) => s.netuid === netuid);
  return matching.reduce((sum, s) => sum + s.stake, 0);
}

/**
 * Convert a TAO amount (as a number, e.g. 1.5) to rao (bigint).
 * Handles up to 9 decimal places of precision.
 */
export function taoToRao(tao: number): bigint {
  // Avoid floating-point issues by working with string
  const parts = tao.toFixed(9).split('.');
  const whole = BigInt(parts[0]) * RAO_PER_TAO;
  const frac = BigInt(parts[1].padEnd(9, '0').slice(0, 9));
  return whole + frac;
}

/**
 * Convert rao (bigint) back to TAO (number).
 */
export function raoToTao(rao: bigint): number {
  return Number(rao) / Number(RAO_PER_TAO);
}

export interface TransferResult {
  /** Block hash the extrinsic was included in */
  blockHash: string;
  /** Extrinsic hash */
  txHash: string;
  /** Whether the extrinsic succeeded on-chain */
  success: boolean;
}

/**
 * Transfer TAO from the connected wallet to a destination address.
 *
 * @param fromAddress - The sender's SS58 address (must be available in the wallet extension)
 * @param toAddress   - The destination SS58 address (e.g. escrow wallet)
 * @param taoAmount   - Amount of TAO to transfer (e.g. 1.5)
 * @param signer      - The injected signer from the wallet extension
 * @param onStatusChange - Optional callback for status updates
 * @returns TransferResult with block hash, tx hash, and success flag
 */
export async function transferTao(
  fromAddress: string,
  toAddress: string,
  taoAmount: number,
  signer: { signPayload?: unknown; signRaw?: unknown },
  onStatusChange?: (status: string) => void,
): Promise<TransferResult> {
  if (taoAmount <= 0) {
    throw new Error('Transfer amount must be greater than 0');
  }

  onStatusChange?.('Connecting to Bittensor network...');
  const api = await getApi();

  const raoAmount = taoToRao(taoAmount);

  onStatusChange?.('Preparing transfer transaction...');

  // balances.transferKeepAlive keeps the sender account alive (minimum existential deposit)
  const transfer = api.tx.balances.transferKeepAlive(toAddress, raoAmount);

  onStatusChange?.('Waiting for wallet signature...');

  return new Promise<TransferResult>((resolve, reject) => {
    let unsub: (() => void) | undefined;

    transfer
      .signAndSend(fromAddress, { signer: signer as never }, (result) => {
        const statusType = result.status.type;
        onStatusChange?.(`Transaction status: ${statusType}`);

        if (result.status.isInBlock) {
          onStatusChange?.('Transaction included in block, waiting for finalization...');
        }

        if (result.status.isFinalized) {
          // Check for dispatch errors
          const dispatchError = result.dispatchError;
          if (dispatchError) {
            let errorMessage = 'Transaction failed';
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } else {
              errorMessage = dispatchError.toString();
            }
            unsub?.();
            reject(new Error(errorMessage));
          } else {
            const blockHash = result.status.asFinalized.toHex();
            const txHash = result.txHash.toHex();
            unsub?.();
            resolve({ blockHash, txHash, success: true });
          }
        }

        // Handle errors that prevent inclusion
        if (result.isError) {
          unsub?.();
          reject(new Error('Transaction failed to submit'));
        }
      })
      .then((unsubFn) => {
        unsub = unsubFn;
      })
      .catch((err) => {
        // User rejected the signing request
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Rejected') || msg.includes('Cancelled') || msg.includes('cancelled')) {
          reject(new Error('Transaction signing was cancelled by the user'));
        } else {
          reject(err);
        }
      });
  });
}

// ---------------------------------------------------------------------------
// Stake info helpers — used to resolve the hotkey for alpha (stake) transfers
// ---------------------------------------------------------------------------

export interface StakeEntry {
  hotkey: string;
  netuid: number;
  stake: number;
}

/**
 * Fetch stake info for a coldkey from the backend API.
 * Endpoint: GET /stake/{coldkey_ss58}
 *
 * Returns an array of { hotkey, netuid, stake } entries.
 */
export async function fetchStakeInfo(coldkeySs58: string): Promise<StakeEntry[]> {
  const baseUrl = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL)
    ? process.env.NEXT_PUBLIC_API_URL
    : 'https://api.subnet118.com';
  const url = `${baseUrl}/stake/${coldkeySs58}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch stake info: ${response.status} ${response.statusText}`);
  }

  let data = await response.json();
  // Response may be double-encoded as a JSON string
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((entry: { hotkey?: string; netuid?: number; stake?: number }) => ({
    hotkey: String(entry.hotkey || ''),
    netuid: Number(entry.netuid || 0),
    stake: Number(entry.stake || 0),
  }));
}

/**
 * Resolve the best hotkey for a given coldkey + netuid.
 *
 * If multiple hotkeys have stake on the same netuid, pick the one with the
 * highest stake (matching the backend logic in execute.py).
 *
 * @returns The hotkey SS58 address, or null if no stake found on that netuid.
 */
export async function resolveHotkey(
  coldkeySs58: string,
  netuid: number,
): Promise<string | null> {
  const stakes = await fetchStakeInfo(coldkeySs58);

  // Filter to entries matching the target netuid
  const matching = stakes.filter((s) => s.netuid === netuid && s.hotkey);

  if (matching.length === 0) {
    return null;
  }

  // Pick the hotkey with the highest stake on this netuid
  matching.sort((a, b) => b.stake - a.stake);
  return matching[0].hotkey;
}

// ---------------------------------------------------------------------------
// On-chain price query
// ---------------------------------------------------------------------------

/**
 * Query the Bittensor chain directly for a subnet's alpha token spot price.
 *
 * Reads SubnetTAO and SubnetAlphaIn from the subtensor pallet storage
 * (both in RAO, 1 TAO = 1 000 000 000 RAO) and computes:
 *   spot_price = (tao_reserve_rao / 1e9) / (alpha_reserve_rao / 1e9)
 *
 * Args:
 *   netuid (number): The subnet network UID.
 *
 * Returns:
 *   number: Spot price of one alpha token in TAO. Returns 0 if pool is empty.
 */
export async function fetchSubnetPrice(netuid: number): Promise<number> {
  const api = await getApi();

  // Reason: Use the same dynamic-access pattern as transferStake because
  // the chain's storage types aren't fully generated in the TS bindings.
  const queryModule = (
    api.query as Record<
      string,
      Record<string, (...args: unknown[]) => Promise<{ toString(): string }>>
    >
  )['subtensorModule'];

  if (!queryModule?.['subnetTAO'] || !queryModule?.['subnetAlphaIn']) {
    throw new Error('Pool storage keys not available on this chain runtime');
  }

  const [taoReserveCodec, alphaReserveCodec] = await Promise.all([
    queryModule['subnetTAO'](netuid),
    queryModule['subnetAlphaIn'](netuid),
  ]);

  // Values are in RAO (1 TAO = 1,000,000,000 RAO)
  const taoReserveRao = BigInt(taoReserveCodec.toString());
  const alphaReserveRao = BigInt(alphaReserveCodec.toString());

  if (alphaReserveRao === BigInt(0)) return 0;

  // Convert RAO → TAO, then compute spot price (TAO per Alpha)
  const taoInPool = Number(taoReserveRao) / 1e9;
  const alphaInPool = Number(alphaReserveRao) / 1e9;

  return taoInPool / alphaInPool;
}

// ---------------------------------------------------------------------------
// Alpha (stake) transfer
// ---------------------------------------------------------------------------

/**
 * Transfer Alpha tokens (subnet stake) from the connected wallet to a destination.
 *
 * This mirrors the backend's `execute.py` transfer logic:
 *   st.transfer_stake(wa, ss58, hotkey, netuid, netuid, amount)
 *
 * Uses `subtensorModule.transferStake` extrinsic on the Bittensor mainnet.
 *
 * @param fromAddress - The sender's SS58 address (coldkey)
 * @param toAddress   - The destination SS58 address (e.g. escrow wallet)
 * @param alphaAmount - Amount of Alpha to transfer (in whole units, e.g. 1.5)
 * @param netuid      - The subnet ID (netuid) for the alpha token
 * @param signer      - The injected signer from the wallet extension
 * @param onStatusChange - Optional callback for status updates
 */
export async function transferAlpha(
  fromAddress: string,
  toAddress: string,
  alphaAmount: number,
  netuid: number,
  signer: { signPayload?: unknown; signRaw?: unknown },
  onStatusChange?: (status: string) => void,
): Promise<TransferResult> {
  if (alphaAmount <= 0) {
    throw new Error('Transfer amount must be greater than 0');
  }

  // --- Step 1: Resolve hotkey ---
  onStatusChange?.('Looking up stake info for your wallet...');
  const hotkey = await resolveHotkey(fromAddress, netuid);

  if (!hotkey) {
    throw new Error("No hotkey for this subnet");
  }

  console.log(`[transferAlpha] Resolved hotkey for netuid ${netuid}: ${hotkey}`);

  // --- Step 2: Connect to chain ---
  onStatusChange?.('Connecting to Bittensor network...');
  const api = await getApi();

  // Alpha uses the same 9-decimal precision as TAO (rao units)
  const raoAmount = taoToRao(alphaAmount);

  onStatusChange?.('Preparing alpha transfer transaction...');

  // subtensorModule.transferStake(destination_coldkey, hotkey, origin_netuid, destination_netuid, alpha_amount)
  // Both netuids are the same for same-subnet transfer (matching backend: netuid, netuid)
  const txMethod = (api.tx as Record<string, Record<string, (...args: unknown[]) => unknown>>)
    ['subtensorModule']?.['transferStake'];

  if (!txMethod) {
    throw new Error(
      'subtensorModule.transferStake is not available on this chain. ' +
      'The runtime may not support stake transfers'
    );
  }

  const transfer = txMethod(toAddress, hotkey, netuid, netuid, raoAmount) as ReturnType<typeof api.tx.balances.transferKeepAlive>;

  onStatusChange?.('Waiting for wallet signature...');

  // --- Step 3: Sign and submit ---
  return new Promise<TransferResult>((resolve, reject) => {
    let unsub: (() => void) | undefined;

    transfer
      .signAndSend(fromAddress, { signer: signer as never }, (result) => {
        const statusType = result.status.type;
        onStatusChange?.(`Transaction status: ${statusType}`);

        if (result.status.isInBlock) {
          onStatusChange?.('Transaction included in block, waiting for finalization...');
        }

        if (result.status.isFinalized) {
          const dispatchError = result.dispatchError;
          if (dispatchError) {
            let errorMessage = 'Transaction failed';
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } else {
              errorMessage = dispatchError.toString();
            }
            unsub?.();
            reject(new Error(errorMessage));
          } else {
            const blockHash = result.status.asFinalized.toHex();
            const txHash = result.txHash.toHex();
            unsub?.();
            resolve({ blockHash, txHash, success: true });
          }
        }

        if (result.isError) {
          unsub?.();
          reject(new Error('Transaction failed to submit'));
        }
      })
      .then((unsubFn) => {
        unsub = unsubFn;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Rejected') || msg.includes('Cancelled') || msg.includes('cancelled')) {
          reject(new Error('Transaction signing was cancelled by the user'));
        } else {
          reject(err);
        }
      });
  });
}
