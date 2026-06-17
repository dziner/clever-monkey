# Account Retention Policy

Updated: 2026-06-18

## Policy

Admin deletion remains a soft-delete:

- The profile is marked `inactive`.
- Auth user, documents, storage files, quiz history, wrong answers, annotations, and diagnostic logs are retained.
- The user cannot use the app while inactive.
- Admins can restore the account for 30 days.

After the 30-day restore window:

- Automatic hard delete is intentionally not enabled.
- The restore action is blocked in the dashboard and in the Supabase RPC.
- The account remains inactive until an operator performs a separately approved retention/purge action.

## Why Not Automatic Hard Delete

Automatic deletion is not enabled because it would irreversibly remove user content and operational evidence. This service still uses upload/OCR diagnostic logs to understand failures, and scanned-PDF processing boundaries are being tuned from real evidence.

## Current Runtime Contract

- Admin soft delete: `admin_soft_delete_user(p_user_id, p_reason)`
- Admin restore: `admin_restore_user(p_user_id)`
- User self-delete: `/.netlify/functions/delete-account`

These are different paths:

- Admin soft delete is reversible for 30 days.
- User self-delete is immediate hard delete by the signed-in user.
- Expired inactive accounts are preserved until a future manual purge policy is approved.

## Operator Notes

Run `supabase/add_admin_retention_policy.sql` after `supabase/add_admin_soft_delete.sql`.

The admin UI uses `profiles.restore_until` to disable restore buttons after the window expires. The SQL RPC enforces the same rule server-side.
