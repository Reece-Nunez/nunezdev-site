/**
 * When a client accepts and signs a proposal, they hand us contact info the
 * lead record often didn't have — a real email and their full legal name
 * (Thumbtack, for instance, only gives "Jamie C." and hides the email). This
 * decides how to backfill the CRM `clients` profile from what the signer typed,
 * without clobbering data that's already good.
 *
 * Rules:
 *  - email: fill only when the client has none. Never overwrite an existing
 *    email — that may be a deliberate billing address.
 *  - name: upgrade only from empty or a lead-style stub ("First L."). A client
 *    with a real full name on file is left alone.
 */

export interface ClientContact {
  name?: string | null;
  email?: string | null;
}

export interface SignerContact {
  name?: string | null;
  email?: string | null;
}

// "Jamie C." / "Jamie C" — a first name followed by a single-letter initial,
// the shape lead sources hand over. Full names ("Jamie Cannady") don't match.
const STUB_NAME = /^\S+\s+\S\.?$/;

export function clientEnrichmentFromSigner(
  client: ClientContact,
  signer: SignerContact,
): { name?: string; email?: string } {
  const patch: { name?: string; email?: string } = {};

  const signerEmail = signer.email?.trim();
  if (signerEmail && !client.email?.trim()) {
    patch.email = signerEmail;
  }

  const signerName = signer.name?.trim();
  const currentName = client.name?.trim() ?? '';
  if (
    signerName &&
    signerName !== currentName &&
    (currentName === '' || STUB_NAME.test(currentName))
  ) {
    patch.name = signerName;
  }

  return patch;
}
