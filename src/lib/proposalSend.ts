/**
 * Shared logic for how a proposal gets shared with a client.
 *
 * A proposal can go out over email, SMS, both, or as a plain shareable "link"
 * the operator copies and pastes themselves (Thumbtack chat, iMessage, etc.).
 * The "link" channel delivers nothing — it only flips the proposal to `sent`
 * so that when the client opens the public page, the pipeline can register a
 * view (the public route only upgrades sent -> viewed, never draft -> viewed).
 */

export type ProposalSendChannel = "email" | "sms" | "both" | "link";

/** Normalize an untrusted `channel` from the request body. Defaults to email. */
export function resolveSendChannel(raw: unknown): ProposalSendChannel {
  return raw === "sms" || raw === "both" || raw === "link" ? raw : "email";
}

/** Which delivery mechanisms a channel implies. */
export function channelWants(channel: ProposalSendChannel): {
  email: boolean;
  sms: boolean;
  link: boolean;
} {
  return {
    email: channel === "email" || channel === "both",
    sms: channel === "sms" || channel === "both",
    link: channel === "link",
  };
}

/**
 * Public, no-login URL a client uses to view a proposal by its access token.
 * `origin` is trailing-slash tolerant so `window.location.origin` or an env
 * base URL both work.
 */
export function proposalPublicUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/proposal/${token}`;
}
