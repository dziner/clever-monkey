import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { UsageBar } from '../../components/UsageBar';

describe('UsageBar', () => {
    it('shows "used / limit" for a finite limit', () => {
        const { getByText } = render(<UsageBar label="문서" used={3} limit={5} />);
        expect(getByText('3 / 5')).toBeTruthy();
    });

    it('hides the bar and denominator when limit is Infinity (Pro tier)', () => {
        const { getByText, container } = render(<UsageBar label="문서" used={42} limit={Infinity} />);
        expect(getByText('42')).toBeTruthy();
        // No progress-bar track rendered for Infinity
        expect(container.querySelector('.bg-ink-200\\/70')).toBeNull();
    });

    it('flips to danger color at-limit, regardless of the active color', () => {
        const { container } = render(
            <UsageBar label="AI 사용" used={20} limit={20} atLimit activeColor="bg-success-500" />,
        );
        // The bar fill should carry bg-danger-500, not the activeColor.
        const fills = container.querySelectorAll('.h-1.rounded-full');
        const fillNode = fills[fills.length - 1] as HTMLElement;
        expect(fillNode.className).toContain('bg-danger-500');
        expect(fillNode.className).not.toContain('bg-success-500');
    });

    it('clamps over-cap usage to 100% width', () => {
        const { container } = render(<UsageBar label="문서" used={99} limit={5} />);
        const fills = container.querySelectorAll('.h-1.rounded-full');
        const fillNode = fills[fills.length - 1] as HTMLElement;
        // Inline style width is clamped at 100% so the bar never overflows.
        expect(fillNode.style.width).toBe('100%');
    });

    it('renders a footer node when provided', () => {
        const { getByText } = render(
            <UsageBar label="AI" used={20} limit={20} atLimit footer={<span>Pro로 업그레이드 →</span>} />,
        );
        expect(getByText('Pro로 업그레이드 →')).toBeTruthy();
    });
});
