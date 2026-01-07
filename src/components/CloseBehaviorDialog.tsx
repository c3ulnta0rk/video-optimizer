import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from './ui/Dialog';
import { Button } from './ui/Button';

interface CloseBehaviorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (action: 'minimize' | 'quit', remember: boolean) => void;
}

export const CloseBehaviorDialog: React.FC<CloseBehaviorDialogProps> = ({ isOpen, onClose, onConfirm }) => {
    const [remember, setRemember] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Conversion in Progress</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <p className="text-sm text-muted-foreground mb-4">
                        A video conversion is currently running. What would you like to do?
                    </p>
                    <div className="flex items-center space-x-2 mb-4">
                        <input
                            type="checkbox"
                            id="remember-choice"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                        />
                        <label htmlFor="remember-choice" className="text-sm font-medium leading-none cursor-pointer select-none">
                            Remember my choice
                        </label>
                    </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:justify-stretch">
                    <Button
                        variant="default"
                        onClick={() => onConfirm('minimize', remember)}
                        className="w-full sm:w-full"
                    >
                        Minimize to Tray
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => onConfirm('quit', remember)}
                        className="w-full sm:w-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                        Stop and Quit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
