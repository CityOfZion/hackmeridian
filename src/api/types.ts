export type CardDesign = 'a' | 'b' | 'c' | 'd' | 'e';

/** A bunq virtual card paid through Google Pay; one Pass can hold many. */
export type Card = {
  id: string;
  label: string;
  design: CardDesign;
  /** Last four digits of the card number, for display (bunq `primary_account_numbers`). */
  last4: string;
  /** USDC loaded onto the card: its bunq `card_limit`, raised by every reload. */
  loadedBalance: number;
  createdAt: number;
};

export type ApiError = { message: string };
