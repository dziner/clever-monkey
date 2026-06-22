import { describe, expect, it } from 'vitest';
import {
  adminEmailAllowlist,
  canUpdateProfilesAsAdmin,
  parseAdminUpdatePayload,
} from '../../netlify/functions/admin-update-profile';

describe('admin-update-profile function helpers', () => {
  it('accepts a valid tier update payload', () => {
    const parsed = parseAdminUpdatePayload(JSON.stringify({
      userId: '11111111-1111-4111-8111-111111111111',
      tier: 'pro',
    }));

    expect(parsed).toEqual({
      ok: true,
      value: {
        userId: '11111111-1111-4111-8111-111111111111',
        tier: 'pro',
      },
    });
  });

  it('rejects invalid tier and missing updates', () => {
    expect(parseAdminUpdatePayload(JSON.stringify({
      userId: '11111111-1111-4111-8111-111111111111',
      tier: 'enterprise',
    }))).toMatchObject({ ok: false, status: 400, error: 'Invalid tier' });

    expect(parseAdminUpdatePayload(JSON.stringify({
      userId: '11111111-1111-4111-8111-111111111111',
    }))).toMatchObject({ ok: false, status: 400, error: 'No profile update requested' });
  });

  it('allows active DB admins and bootstrap admin email', () => {
    expect(canUpdateProfilesAsAdmin({ role: 'admin', account_status: 'active' }, null)).toBe(true);
    expect(canUpdateProfilesAsAdmin({ role: 'user', account_status: 'active' }, 'voicemakesme@gmail.com')).toBe(true);
  });

  it('blocks inactive admins', () => {
    expect(canUpdateProfilesAsAdmin({ role: 'admin', account_status: 'inactive' }, 'voicemakesme@gmail.com')).toBe(false);
  });

  it('normalizes configured admin emails', () => {
    expect(adminEmailAllowlist({
      ADMIN_EMAILS: 'Owner@example.com',
      VITE_ADMIN_EMAILS: 'second@example.com, OWNER@example.com',
    })).toEqual(['voicemakesme@gmail.com', 'owner@example.com', 'second@example.com']);
  });
});
