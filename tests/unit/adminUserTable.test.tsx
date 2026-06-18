import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRow } from '../../components/AdminUserTable';
import type { AdminUserRow } from '../../services/adminService';

const user = (overrides: Partial<AdminUserRow> = {}): AdminUserRow => ({
    id: 'user-1',
    email: 'student@example.com',
    displayName: null,
    role: 'user',
    tier: 'free',
    tierExpiresAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    stripePriceId: null,
    stripeCurrentPeriodEnd: null,
    stripeCancelAtPeriodEnd: false,
    accountStatus: 'active',
    deactivatedAt: null,
    deactivatedBy: null,
    deactivationReason: null,
    restoreUntil: null,
    aiActionsToday: 3,
    aiActionsDate: '2026-06-17',
    createdAt: '2026-06-01T00:00:00.000Z',
    language: null,
    documentCount: 2,
    ...overrides,
});

const noop = vi.fn();

describe('Admin UserRow', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-18T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders active users with explicit tier/role controls and delete action', () => {
        render(
            <table>
                <tbody>
                    <UserRow
                        user={user()}
                        currentUserId="admin-1"
                        onTierChange={noop}
                        onRoleChange={noop}
                        onDeactivateUser={noop}
                        onRestoreUser={noop}
                        isUpdating={false}
                    />
                </tbody>
            </table>,
        );

        expect(screen.getByText('활성')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /요금제/ })).toBeEnabled();
        expect(screen.getByRole('combobox', { name: /권한/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /삭제 처리/ })).toBeEnabled();
    });

    it('renders inactive users as restore-only rows', () => {
        render(
            <table>
                <tbody>
                    <UserRow
                        user={user({
                            accountStatus: 'inactive',
                            deactivatedAt: '2026-06-17T00:00:00.000Z',
                            restoreUntil: '2026-07-17T00:00:00.000Z',
                        })}
                        currentUserId="admin-1"
                        onTierChange={noop}
                        onRoleChange={noop}
                        onDeactivateUser={noop}
                        onRestoreUser={noop}
                        isUpdating={false}
                    />
                </tbody>
            </table>,
        );

        expect(screen.getByText(/삭제 대기/)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /요금제/ })).toBeDisabled();
        expect(screen.getByRole('combobox', { name: /권한/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /복구/ })).toBeEnabled();
        expect(screen.queryByRole('button', { name: /삭제 처리/ })).not.toBeInTheDocument();
    });

    it('disables restore after the 30-day recovery window expires', () => {
        render(
            <table>
                <tbody>
                    <UserRow
                        user={user({
                            accountStatus: 'inactive',
                            deactivatedAt: '2026-05-01T00:00:00.000Z',
                            restoreUntil: '2026-05-31T00:00:00.000Z',
                        })}
                        currentUserId="admin-1"
                        onTierChange={noop}
                        onRoleChange={noop}
                        onDeactivateUser={noop}
                        onRestoreUser={noop}
                        isUpdating={false}
                    />
                </tbody>
            </table>,
        );

        expect(screen.getByText(/복구 만료/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /만료/ })).toBeDisabled();
    });
});
