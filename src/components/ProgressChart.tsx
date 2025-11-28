import React from 'react';
import { motion } from 'framer-motion';

interface ProgressChartProps {
    progress: number; // 0 to 100
    size?: number;
    strokeWidth?: number;
    color?: string;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
    progress,
    size = 60,
    strokeWidth = 6,
    color = "currentColor"
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Background Circle */}
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-muted/20"
                />
                {/* Progress Circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    strokeLinecap="round"
                    className="text-primary"
                />
            </svg>
            <div className="absolute text-xs font-semibold">
                {Math.round(progress)}%
            </div>
        </div>
    );
};
