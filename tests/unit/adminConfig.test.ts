import { describe, expect, it } from 'vitest';
import { isAdminUser } from '../../services/adminConfig';

describe('isAdminUser', () => {
    it('allows active DB admins', () => {
        expect(isAdminUser('admin', null, 'active')).toBe(true);
    });

    it('allows active bootstrap admin email', () => {
        expect(isAdminUser('user', 'voicemakesme@gmail.com', 'active')).toBe(true);
    });

    it('blocks inactive accounts even when role or email would otherwise pass', () => {
        expect(isAdminUser('admin', null, 'inactive')).toBe(false);
        expect(isAdminUser('user', 'voicemakesme@gmail.com', 'inactive')).toBe(false);
    });
});
