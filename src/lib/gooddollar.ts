import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  keccak256,
  toHex,
} from 'viem';
import { celo } from 'viem/chains';

// ── Contract addresses ──────────────────────────────────────
export const G_TOKEN      = '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as const;
export const G_DECIMALS   = 18;

// Set EXPO_PUBLIC_CREDITS_CONTRACT in .env after deploying DataGaugeCredits.sol
export const CREDITS_CONTRACT = (
  process.env.EXPO_PUBLIC_CREDITS_CONTRACT ?? ''
) as `0x${string}`;

export const CONTRACT_CONFIGURED =
  !!CREDITS_CONTRACT &&
  CREDITS_CONTRACT.startsWith('0x') &&
  CREDITS_CONTRACT.length === 42 &&
  !/^0x0+$/.test(CREDITS_CONTRACT);

// GoodDollar Identity contract on Celo mainnet
const IDENTITY_CONTRACT = '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42' as const;

// UBIScheme on Celo mainnet
const UBI_SCHEME = '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1' as const;

// ── Public client (read-only) ───────────────────────────────
const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

// ── ABIs ───────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    name: 'approve',
    type: 'function' as const,
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable' as const,
  },
  {
    name: 'allowance',
    type: 'function' as const,
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;

const IDENTITY_ABI = [
  {
    name: 'isWhitelisted',
    type: 'function' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const,
  },
] as const;

const UBI_ABI = [
  {
    name: 'checkEntitlement',
    type: 'function' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;

const CREDITS_ABI = [
  {
    name: 'balanceOf',
    type: 'function' as const,
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    name: 'hasCredits',
    type: 'function' as const,
    inputs: [
      { name: 'user',   type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const,
  },
  {
    name: 'deposit',
    type: 'function' as const,
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    name: 'spend',
    type: 'function' as const,
    inputs: [
      { name: 'amount',    type: 'uint256' },
      { name: 'planId',    type: 'string'  },
      { name: 'phoneHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    name: 'withdraw',
    type: 'function' as const,
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
] as const;

// ── Wallet client (write — web only) ───────────────────────
function getWalletClient() {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error(
      'No Web3 wallet detected. Open this page in MetaMask, Valora, or a dApp browser.'
    );
  }
  return createWalletClient({
    chain: celo,
    transport: custom((window as any).ethereum),
  });
}

// ── On-chain reads ──────────────────────────────────────────
export async function getGBalance(address: string): Promise<number> {
  try {
    const bal = await publicClient.readContract({
      address: G_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return parseFloat(formatUnits(bal as bigint, G_DECIMALS));
  } catch {
    return 0;
  }
}

export async function isWhitelisted(address: string): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: IDENTITY_CONTRACT,
      abi: IDENTITY_ABI,
      functionName: 'isWhitelisted',
      args: [address as `0x${string}`],
    });
    return result as boolean;
  } catch {
    return false;
  }
}

export async function getClaimable(address: string): Promise<number> {
  try {
    const amount = await publicClient.readContract({
      address: UBI_SCHEME,
      abi: UBI_ABI,
      functionName: 'checkEntitlement',
      args: [address as `0x${string}`],
    });
    return parseFloat(formatUnits(amount as bigint, G_DECIMALS));
  } catch {
    return 0;
  }
}

/** Read on-chain G$ credit balance from DataGaugeCredits contract */
export async function getContractCredits(address: string): Promise<number> {
  if (!CONTRACT_CONFIGURED) return 0;
  try {
    const bal = await publicClient.readContract({
      address: CREDITS_CONTRACT,
      abi: CREDITS_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return parseFloat(formatUnits(bal as bigint, G_DECIMALS));
  } catch {
    return 0;
  }
}

// ── Contract writes (require MetaMask / injected wallet) ────

/**
 * Approve G$ spending on the credits contract then deposit.
 * Skips the approve step if allowance is already sufficient.
 */
export async function depositCreditsOnChain(
  gdAmount: number
): Promise<{ txHash: `0x${string}`; userAddress: `0x${string}` }> {
  if (!CONTRACT_CONFIGURED) throw new Error('Credits contract not configured.');

  const walletClient = getWalletClient();
  const [userAddress] = await walletClient.requestAddresses();
  const amountWei = parseUnits(gdAmount.toFixed(18), G_DECIMALS);

  // Check current allowance
  const allowance = await publicClient.readContract({
    address: G_TOKEN,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, CREDITS_CONTRACT],
  }) as bigint;

  // Approve if needed
  if (allowance < amountWei) {
    const approveTx = await walletClient.writeContract({
      address: G_TOKEN,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CREDITS_CONTRACT, amountWei],
      account: userAddress,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // Deposit
  const txHash = await walletClient.writeContract({
    address: CREDITS_CONTRACT,
    abi: CREDITS_ABI,
    functionName: 'deposit',
    args: [amountWei],
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash, userAddress };
}

/**
 * Spend G$ credits from the contract to purchase data.
 * Phone number is hashed for privacy (keccak256).
 */
export async function spendCreditsOnChain(
  gdAmount: number,
  planId: string,
  phone: string
): Promise<{ txHash: `0x${string}` }> {
  if (!CONTRACT_CONFIGURED) throw new Error('Credits contract not configured.');

  const walletClient = getWalletClient();
  const [userAddress] = await walletClient.requestAddresses();
  const amountWei = parseUnits(gdAmount.toFixed(18), G_DECIMALS);
  const phoneHash  = keccak256(toHex(phone)) as `0x${string}`;

  const txHash = await walletClient.writeContract({
    address: CREDITS_CONTRACT,
    abi: CREDITS_ABI,
    functionName: 'spend',
    args: [amountWei, planId, phoneHash],
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash };
}

/**
 * Withdraw unspent G$ credits back to the user's wallet.
 */
export async function withdrawCreditsOnChain(
  gdAmount: number
): Promise<{ txHash: `0x${string}` }> {
  if (!CONTRACT_CONFIGURED) throw new Error('Credits contract not configured.');

  const walletClient = getWalletClient();
  const [userAddress] = await walletClient.requestAddresses();
  const amountWei = parseUnits(gdAmount.toFixed(18), G_DECIMALS);

  const txHash = await walletClient.writeContract({
    address: CREDITS_CONTRACT,
    abi: CREDITS_ABI,
    functionName: 'withdraw',
    args: [amountWei],
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash };
}

// ── Watch for incoming G$ ───────────────────────────────────
export function watchIncomingG(
  targetAddress: string,
  onReceive: (from: string, amount: number) => void
): () => void {
  const interval = setInterval(async () => {
    try {
      const logs = await publicClient.getLogs({
        address: G_TOKEN,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { name: 'from',  type: 'address', indexed: true },
            { name: 'to',    type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
          ],
        },
        args: { to: targetAddress as `0x${string}` },
        fromBlock: 'latest',
      });
      for (const log of logs) {
        const args   = log.args as { from: string; to: string; value: bigint };
        const amount = parseFloat(formatUnits(args.value, G_DECIMALS));
        onReceive(args.from, amount);
      }
    } catch {
      // ignore polling errors
    }
  }, 12_000);

  return () => clearInterval(interval);
}

// ── Price feeds ─────────────────────────────────────────────
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 2,
  delayMs = 1500
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function getGPriceUSD(): Promise<number> {
  try {
    const res  = await fetchWithRetry(
      'https://api.coingecko.com/api/v3/simple/price?ids=gooddollar&vs_currencies=usd',
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return (data as { gooddollar?: { usd?: number } }).gooddollar?.usd ?? 0.0012;
  } catch {
    return 0.0012;
  }
}

export async function getUSDToNGN(): Promise<number> {
  try {
    const res  = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    return (data as { rates?: { NGN?: number } }).rates?.NGN ?? 1600;
  } catch {
    return 1600;
  }
}

// ── Conversion helpers ──────────────────────────────────────
export function gToNGN(g: number, priceUSD: number, usdNgn: number): number {
  return g * priceUSD * usdNgn;
}

export function ngnToG(ngn: number, priceUSD: number, usdNgn: number): number {
  if (!priceUSD || !usdNgn) return 0;
  return ngn / (priceUSD * usdNgn);
}

// ── Deep-link URLs ──────────────────────────────────────────
export const GD_URLS = {
  verify:    'https://gooddollar.org/#/AppNavigation/UBI/VerifyWrapper',
  claim:     'https://gooddollar.org/#/AppNavigation/UBI',
  learnMore: 'https://gooddollar.org',
  walletApp: 'https://wallet.gooddollar.org',
};
