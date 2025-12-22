import React from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

const DialogContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
    return (
        <DialogContext.Provider value={{ open: !!open, onOpenChange }}>
            <AnimatePresence>
                {open && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget && onOpenChange) {
                                onOpenChange(false);
                            }
                        }}
                    >
                        {children}
                    </div>
                )}
            </AnimatePresence>
        </DialogContext.Provider>
    );
};

interface DialogContentProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    maxWidth?: string;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className, maxWidth = 'max-w-lg', ...props }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "w-full bg-background border rounded-xl shadow-lg flex flex-col",
                maxWidth,
                className
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
    const { onOpenChange } = React.useContext(DialogContext);

    return (
        <div className={cn("flex items-center justify-between p-6 border-b", className)} {...props}>
            <div className="flex-1 text-left">
                {children}
            </div>
            {onOpenChange && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-2"
                    onClick={() => onOpenChange(false)}
                >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Close</span>
                </Button>
            )}
        </div>
    );
};

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 border-t bg-muted/20", className)} {...props} />
);

export const DialogBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn("p-6 overflow-y-auto max-h-[60vh] flex-1", className)} {...props} />
);
