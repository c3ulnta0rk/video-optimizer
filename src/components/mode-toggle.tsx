import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "./theme-provider"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef, useEffect } from "react"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const toggleOpen = () => setIsOpen(!isOpen)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const variants = {
        open: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2 } },
        closed: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.2 } },
    }

    return (
        <div className="fixed top-4 left-4 z-50" ref={ref}>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleOpen}
                className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md transition-colors"
                title="Toggle theme"
            >
                <AnimatePresence mode="wait">
                    {theme === 'dark' ? (
                        <motion.div key="dark" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <Moon className="w-6 h-6" />
                        </motion.div>
                    ) : theme === 'light' ? (
                        <motion.div key="light" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <Sun className="w-6 h-6" />
                        </motion.div>
                    ) : (
                        <motion.div key="system" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <Monitor className="w-6 h-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={variants}
                        className="absolute top-14 left-0 p-1 bg-popover text-popover-foreground rounded-xl border shadow-lg flex flex-col min-w-[140px]"
                    >
                        {[
                            { value: "light", label: "Light", icon: Sun },
                            { value: "dark", label: "Dark", icon: Moon },
                            { value: "system", label: "System", icon: Monitor },
                        ].map((item) => (
                            <button
                                key={item.value}
                                onClick={() => {
                                    setTheme(item.value as any)
                                    setIsOpen(false)
                                }}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${theme === item.value
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted"
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
