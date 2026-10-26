# ITEM card signing in VaultPass

VaultPass asks for the card's 32-byte **application pairing key** on first use. Enter it as 64 hexadecimal characters in the sign-in screen. The app reads the card UID, opens the authenticated ITEM tunnel with that key, and asks the active KeyRing to sign a fresh SHA-256 challenge. It verifies the signature against the exported public key before saving the pairing key and that public key in the phone's SecureStore, keyed by UID. Later taps load the saved credential. The ephemeral tunnel keys are never saved. The card's private signing key never leaves the card.

The challenge includes a domain label, card UID, action (`sign-in` or `reload`), a reload's card ID and amount, and 32 random bytes. Every tap requires a new signature. VaultPass checks that the active KeyRing does not change during signing and pins its public key after first use. ITEM firmware v3.5.4 can ignore a requested KeyRing number, so this flow uses only the active ring. A paired card without an initialized signing ring cannot complete sign-in.

This is **local proof of card possession** for the current sandbox app. The signed challenge and public key are not sent to a backend; bunq sandbox reloads still run from the phone. Production authorization requires a server-issued nonce, server-side signature verification, a registered public key per card, and a binding between that card and the bunq account before a reload is submitted. Do not use the pairing key as a payment authorization secret or send it to the backend.

No provisioning or card mutation is performed by this flow. A changed signing key fails closed and requires explicit re-enrollment. Never put a pairing key in logs, a repository, or chat.
