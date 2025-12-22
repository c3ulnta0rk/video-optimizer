import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils'; // Assuming cn utility is in lib/utils, if not I'll create a basic one or inline it.

// Utility to merge classes if 'cn' doesn't exist yet, I'll provide a fallback in the file temporarily or check for it.
// Checking file listing earlier, 'lib' folder exists. 'lib/utils' is common.
// If it fails, I will fix.

export interface SelectOption {
    value: string;
    label: string;
    description?: string; // For things like "High Quality" vs "Small Size"
}

export interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    label?: string; // Optional label on top? No, usually separate.
}

// Group support
export interface SelectGroup {
    label: string;
    options: SelectOption[];
}

export type SelectOptionsOrGroups = SelectOption[] | SelectGroup[];

interface CustomSelectProps {
    value: string | number;
    onChange: (value: any) => void;
    options: SelectOptionsOrGroups;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const Select: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select option',
    disabled = false,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Flatten options to find selected label purely for display
    const getSelectedLabel = () => {
        const flatOptions: SelectOption[] = [];
        const isGrouped = (opts: SelectOptionsOrGroups): opts is SelectGroup[] => {
            return opts.length > 0 && 'options' in opts[0];
        };

        if (isGrouped(options)) {
            options.forEach(group => flatOptions.push(...group.options));
        } else {
            flatOptions.push(...(options as SelectOption[]));
        }

        const selected = flatOptions.find(opt => opt.value === value);
        return selected ? selected.label : placeholder;
    };

    const isGrouped = (opts: SelectOptionsOrGroups): opts is SelectGroup[] => {
        return opts.length > 0 && 'options' in opts[0] && 'label' in opts[0];
    };

    const renderOption = (option: SelectOption) => {
        const isSelected = option.value === value;
        return (
            <button
                key={option.value}
                type="button"
                onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                }}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                )}
            >
                <div className="flex flex-col gap-0.5">
                    <span>{option.label}</span>
                    {option.description && (
                        <span className="text-[10px] text-muted-foreground">{option.description}</span>
                    )}
                </div>
                {isSelected && <Check className="w-4 h-4 ml-2" />}
            </button>
        );
    };

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border bg-background text-foreground ring-offset-background transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                    isOpen ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50",
                    disabled && "opacity-50 cursor-not-allowed bg-muted"
                )}
            >
                <span className="truncate mr-2">{getSelectedLabel()}</span>
                <ChevronDown
                    className={cn(
                        "w-4 h-4 opacity-50 transition-transform duration-200",
                        isOpen && "transform rotate-180"
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-50 w-full mt-1.5 overflow-hidden bg-popover border rounded-lg shadow-xl"
                    >
                        <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                            {isGrouped(options) ? (
                                options.map((group) => (
                                    <div key={group.label} className="mb-2 last:mb-0">
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                            {group.label}
                                        </div>
                                        {group.options.map(renderOption)}
                                    </div>
                                ))
                            ) : (
                                (options as SelectOption[]).map(renderOption)
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
