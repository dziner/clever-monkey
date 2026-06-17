import * as React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useUser } from '../contexts/UserContext';
import { t, type UiKey } from '../services/uiStrings';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: React.ReactNode;
    body?: React.ReactNode;
    /** UI key for the confirm button label. Falls back to common.confirm. */
    confirmKey?: UiKey;
    /** Direct confirm label for one-off admin actions. */
    confirmLabel?: React.ReactNode;
    /** UI key for the cancel button label. Falls back to common.cancel. */
    cancelKey?: UiKey;
    /** Direct cancel label for one-off admin actions. */
    cancelLabel?: React.ReactNode;
    /** Render the confirm action as destructive (red) instead of brand. */
    destructive?: boolean;
}

/**
 * Lightweight confirm dialog used wherever an action benefits from a
 * "are you sure?" beat — sign-out, delete account, etc. Centralizes the
 * pattern so each caller doesn't reinvent button layout or i18n wiring.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen, onClose, onConfirm, title, body,
    confirmKey = 'common.confirm', confirmLabel,
    cancelKey = 'common.cancel', cancelLabel,
    destructive,
}) => {
    const { userProfile } = useUser();
    const language = userProfile?.language;
    const [busy, setBusy] = React.useState(false);

    const handleConfirm = async () => {
        try {
            setBusy(true);
            await onConfirm();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={body}
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={busy}>
                        {cancelLabel ?? t(cancelKey, language)}
                    </Button>
                    <Button
                        variant={destructive ? 'danger' : 'primary'}
                        onClick={handleConfirm}
                        loading={busy}
                    >
                        {confirmLabel ?? t(confirmKey, language)}
                    </Button>
                </div>
            }
        >
            {null}
        </Modal>
    );
};
