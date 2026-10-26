/** A tap read from the Pass: chip ID plus a counter that rises on every tap. */
export type TapProof = {
  chipId: string;
  counter: number;
  /** Chip signature over chip ID and counter. Mocked until ITEM Systems publishes the tap format. */
  signature: string;
};

export type TapResult = {
  chipId: string;
  /** Single-use token proving a fresh tap; required by every call that moves money. */
  tapToken: string;
  registered: boolean;
};

export type Session = {
  userId: string;
  chipId: string;
  name: string;
};

export type Vault = {
  contractId: string;
  /** The user's Stellar G-account: Mercuryo sends bought EURC here before it moves into the vault. */
  ownerAddress: string;
  /** EURC held by the vault, including withdrawals still waiting for their delay. */
  balance: number;
  dailyCap: number;
  withdrawDelayMs: number;
  status: 'active' | 'frozen';
};

export type ActivityKind = 'buy' | 'deposit' | 'withdraw';
export type ActivityStatus = 'pending' | 'settled' | 'failed';

export type Activity = {
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  amount: number;
  createdAt: number;
  /** Mercuryo order ID (buy) or contract call `ref` (deposit, withdraw). */
  ref: string;
  txHash?: string;
  /** Withdrawals only: destination G-address and when `execute_withdraw` can run. */
  destination?: string;
  availableAt?: number;
};

export type VaultOverview = {
  vault: Vault;
  activity: Activity[];
};

export type ApiError = { message: string };
