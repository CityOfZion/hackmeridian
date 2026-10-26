export type TVaultConfirmScreenParams =
  { action: 'reload'; amount: number } | { action: 'withdraw'; amount: number; destination: string };
