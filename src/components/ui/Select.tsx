import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionsListRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Calculate dropdown position based on button position
    const updateDropdownPosition = useCallback(() => {
        if (buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;
            
            // Calculate position
            const top = buttonRect.bottom + scrollY + 6; // 6px = mt-1.5 equivalent
            const left = buttonRect.left + scrollX;
            const width = buttonRect.width;

            // Check if dropdown would overflow bottom of viewport
            const viewportHeight = window.innerHeight;
            const estimatedDropdownHeight = 300; // max-h-[300px]
            const spaceBelow = viewportHeight - buttonRect.bottom;
            const spaceAbove = buttonRect.top;

            let finalTop = top;
            // If not enough space below but enough above, position above
            if (spaceBelow < estimatedDropdownHeight && spaceAbove > estimatedDropdownHeight) {
                finalTop = buttonRect.top + scrollY - estimatedDropdownHeight - 6;
            }

            setDropdownPosition({ top: finalTop, left, width });
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updateDropdownPosition();
            
            // Close dropdown on scroll outside
            const handleScroll = (event: Event) => {
                if (!dropdownRef.current || !buttonRef.current) return;
                
                const target = event.target as Node;
                
                // Check if scroll is happening inside the dropdown (including scrollable content)
                const isScrollingInDropdown = dropdownRef.current.contains(target);
                
                // Check if scroll is happening in the button or container
                const isScrollingInSelect = buttonRef.current.contains(target) ||
                                            containerRef.current?.contains(target);
                
                // If scrolling inside the dropdown content area, don't close
                // User is browsing options
                if (isScrollingInDropdown) {
                    return;
                }
                
                // If scrolling in the select button/container area, update position
                if (isScrollingInSelect) {
                    updateDropdownPosition();
                    return;
                }
                
                // If scrolling outside, close the dropdown
                setIsOpen(false);
            };
            
            // Update position on resize
            const handleResize = () => {
                updateDropdownPosition();
            };
            
            // Use capture phase to catch all scroll events
            document.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
            
            return () => {
                document.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen, updateDropdownPosition]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && 
                !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Flatten options for navigation and display
    const getFlatOptions = useCallback((): SelectOption[] => {
        const flatOptions: SelectOption[] = [];
        const isGrouped = (opts: SelectOptionsOrGroups): opts is SelectGroup[] => {
            return opts.length > 0 && 'options' in opts[0];
        };

        if (isGrouped(options)) {
            options.forEach(group => flatOptions.push(...group.options));
        } else {
            flatOptions.push(...(options as SelectOption[]));
        }

        return flatOptions;
    }, [options]);

    // Flatten options to find selected label purely for display
    const getSelectedLabel = () => {
        const flatOptions = getFlatOptions();
        const selected = flatOptions.find(opt => opt.value === value);
        return selected ? selected.label : placeholder;
    };

    const isGrouped = (opts: SelectOptionsOrGroups): opts is SelectGroup[] => {
        return opts.length > 0 && 'options' in opts[0] && 'label' in opts[0];
    };

    // Scroll highlighted option into view
    const scrollToHighlighted = useCallback((index: number) => {
        if (!optionsListRef.current) return;
        
        const optionElements = optionsListRef.current.querySelectorAll('button');
        const optionElement = optionElements[index];
        
        if (optionElement) {
            optionElement.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (disabled) return;

        const flatOptions = getFlatOptions();
        
        if (!isOpen) {
            // Open dropdown on ArrowDown, ArrowUp, Enter, or Space
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setIsOpen(true);
                // Set initial highlight to current value or first option
                const currentIndex = flatOptions.findIndex(opt => opt.value === value);
                setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
            }
            return;
        }

        // Handle keyboard when dropdown is open
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setHighlightedIndex(prev => {
                    const nextIndex = prev < flatOptions.length - 1 ? prev + 1 : 0;
                    scrollToHighlighted(nextIndex);
                    return nextIndex;
                });
                break;
            case 'ArrowUp':
                event.preventDefault();
                setHighlightedIndex(prev => {
                    const nextIndex = prev > 0 ? prev - 1 : flatOptions.length - 1;
                    scrollToHighlighted(nextIndex);
                    return nextIndex;
                });
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
                    onChange(flatOptions[highlightedIndex].value);
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                }
                break;
            case 'Escape':
                event.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                buttonRef.current?.focus();
                break;
            case 'Home':
                event.preventDefault();
                setHighlightedIndex(0);
                scrollToHighlighted(0);
                break;
            case 'End':
                event.preventDefault();
                const lastIndex = flatOptions.length - 1;
                setHighlightedIndex(lastIndex);
                scrollToHighlighted(lastIndex);
                break;
        }
    }, [isOpen, disabled, highlightedIndex, value, getFlatOptions, onChange, scrollToHighlighted]);

    // Reset highlighted index when dropdown opens/closes and focus dropdown
    useEffect(() => {
        if (isOpen) {
            const flatOptions = getFlatOptions();
            const currentIndex = flatOptions.findIndex(opt => opt.value === value);
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
            // Focus the dropdown for keyboard navigation
            setTimeout(() => {
                dropdownRef.current?.focus();
            }, 0);
        } else {
            setHighlightedIndex(-1);
        }
    }, [isOpen, value, getFlatOptions]);

    const renderOption = (option: SelectOption, index: number) => {
        const isSelected = option.value === value;
        const isHighlighted = index === highlightedIndex;
        return (
            <button
                key={option.value}
                type="button"
                onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground",
                    isHighlighted && !isSelected && "bg-muted"
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
        <>
            <div className={cn("relative w-full", className)} ref={containerRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    onKeyDown={handleKeyDown}
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
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dropdownRef}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed z-50 overflow-hidden bg-popover border rounded-lg shadow-xl"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                        }}
                        onKeyDown={handleKeyDown}
                        tabIndex={-1}
                    >
                        <div 
                            ref={optionsListRef}
                            className="max-h-[300px] overflow-y-auto p-1"
                        >
                            {isGrouped(options) ? (
                                (() => {
                                    let optionIndex = 0;
                                    return options.map((group) => (
                                        <div key={group.label} className="mb-2 last:mb-0">
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                {group.label}
                                            </div>
                                            {group.options.map(option => {
                                                const index = optionIndex++;
                                                return renderOption(option, index);
                                            })}
                                        </div>
                                    ));
                                })()
                            ) : (
                                (options as SelectOption[]).map((option, index) => renderOption(option, index))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
