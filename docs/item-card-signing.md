# ITEM card signing in VaultPass

VaultPass asks for the card's 32-byte **application pairing key** on first use. Enter it as 64 hexadecimal characters in the sign-in screen. The app reads the card UID, opens the authenticated ITEM tunnel with that key, and asks the active KeyRing to sign a fresh SHA-256 challenge. It verifies the signature against the exported public key before saving the pairing key and that public key in the phone's SecureStore, keyed by UID. Later taps load the saved credential. The ephemeral tunnel keys are never saved. The card's private signing key never leaves the card.

The sign-in challenge includes a domain label, card UID, action, and 32 random bytes. VaultPass hashes that challenge before sending the 32-byte digest to the card. The qualified ITEM card signs a supplied 32-byte digest directly with P-256. The app normalizes high-S ECDSA signatures for Soroban and verifies the same digest before sending a proof to the backend. Ed25519 signs the digest bytes as its message; secp256k1 remains a separate legacy path. A funding has the card sign the 32-byte hash of a Stellar payment instead (a path payment: USDC in, EURC out) (Ed25519 over the transaction hash is Stellar's signature scheme); the transaction must be in a closed ledger before the bunq limit changes. Every tap requires a new signature. VaultPass checks that the active KeyRing does not change during signing and pins its public key after first use. Account approvals address the selected ring and verify against its pinned public key. Older ITEM firmware v3.5.4 can ignore a requested ring and requires separate qualification. A paired card without an initialized signing ring cannot complete sign-in.

This is **local proof of card possession** for the current app. The signed challenge and public key are not sent to a backend; bunq funding still runs from the phone. Production authorization requires a server-issued nonce, server-side signature verification, a registered public key per card, and a binding between that card and the bunq account before a funding is submitted. Do not use the pairing key as a payment authorization secret or send it to the backend.

No provisioning or card mutation is performed by this flow. A changed signing key fails closed and requires explicit re-enrollment. Never put a pairing key in logs, a repository, or chat.

## Physical card qualification (26 October 2026)

An Android phone opened the authenticated ITEM tunnel, read diagnostics, exported a 32-byte public key, and obtained a 64-byte signature. The first VaultPass verifier handled only ECDSA, so it rejected that format. VaultPass then verified a fresh card signature using strict Ed25519 verification and completed sign-in. After an app restart, a second signed tap succeeded with the pairing-key field blank, confirming the credential was retrieved from SecureStore. The card's exact installed engine and source revision were not independently identified; the checked-in `item-engine-ed25519` source is not evidence of what is deployed on this card.

The Android NFC link intermittently returned `transceive fail` during slower public-key export or signing operations. VaultPass sets a two-minute ISO-DEP timeout on Android and still fails closed when a card exchange or signature verification fails. The successful tests used an Expo development build; a standalone release build was not qualified. No funding or bunq transaction was performed during these card tests.

## P-256 smart-account migration (27 October 2026)

See [smart-accounts.md](smart-accounts.md) for the new mainnet flow and attached-reader qualification. The earlier Ed25519/G-account flow described above is historical and is no longer the dashboard login path.
