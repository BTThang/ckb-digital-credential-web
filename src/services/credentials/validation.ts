import {
  MAX_DESCRIPTION_LENGTH,
  MAX_ISSUER_NAME_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/services/spore/payload";
import type { CredentialType, IssuerType } from "@/types";

export interface IssueFormValues {
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  credentialType: CredentialType;
  issueDate: string;
  expirationDate: string;
  recipientAddress: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The length limits come from `buildPayload`, because the form must not be more
 * permissive than the on-chain cell: a description the builder then silently
 * truncated would issue a credential that does not match what the user saw.
 */
export { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_ISSUER_NAME_LENGTH };

/**
 * Validates the issue form.
 *
 * Returns a single human-readable message, or `null` when the form is
 * submittable. The caller shows the message as-is.
 *
 * The recipient is checked with the same prefilter the wallet write path uses;
 * `ccc.Address.fromString` performs the authoritative bech32m check when the
 * transaction is built.
 */
export function validateIssueForm(values: IssueFormValues): string | null {
  if (!values.title.trim()) return "Title is required.";
  if (values.title.length > MAX_TITLE_LENGTH)
    return `Title must be at most ${MAX_TITLE_LENGTH} characters.`;

  if (values.description.length > MAX_DESCRIPTION_LENGTH)
    return `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;

  if (!values.issuerName.trim()) return "Issuer name is required.";
  if (values.issuerName.length > MAX_ISSUER_NAME_LENGTH)
    return `Issuer name must be at most ${MAX_ISSUER_NAME_LENGTH} characters.`;

  if (!values.recipientAddress.trim())
    return "Enter a CKB address for the recipient.";
  if (!ISO_DATE.test(values.issueDate)) return "Enter a valid issue date.";
  if (values.expirationDate && !ISO_DATE.test(values.expirationDate))
    return "Enter a valid expiration date.";
  if (values.expirationDate && values.expirationDate < values.issueDate)
    return "The expiration date cannot be before the issue date.";

  return null;
}
