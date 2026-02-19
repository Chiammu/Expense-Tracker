import React from 'react';
import { motion } from 'framer-motion';

interface ConfettiProps {
    reward: string; // e.g. "🥗 Health Hero" -> we extract emoji
}

export const Confetti: React.FC<ConfettiProps> = ({ reward }) => {
    const emoji = reward.split(' ')[0] || '🎉';

    // Generate random positions for confetti
    const pieces = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // %
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        size: 20 + Math.random() * 30,
    }));

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {pieces.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ y: -50, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
                    animate={{ y: '110vh', rotate: 360 }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: "linear",
                        repeat: 0
                    }}
                    className="absolute top-0"
                    style={{ fontSize: p.size }}
                >
                    {emoji}
                </motion.div>
            ))
            }

            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            >
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center transform rotate-3">
                    <h1 className="text-4xl mb-2">🎉 Challenge Complete!</h1>
                    <p className="text-xl">You earned: {reward}</p>
                </div>
            </motion.div>
        </div >
    );
};
