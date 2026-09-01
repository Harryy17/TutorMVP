import { useMemo } from 'react'
import { motion } from 'framer-motion'

interface StudyFlowAnimationProps {
  active?: boolean
  density?: 'low' | 'medium' | 'high'
}

export default function StudyFlowAnimation({ active = true, density = 'medium' }: StudyFlowAnimationProps) {
  const particleCount = density === 'low' ? 14 : density === 'medium' ? 28 : 42

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 5 + 2,
      duration: Math.random() * 10 + 6,
      delay: Math.random() * 4,
      opacity: Math.random() * 0.45 + 0.15,
      color: i % 3 === 0 ? 'bg-orange-400' : i % 3 === 1 ? 'bg-amber-400' : 'bg-rose-400',
    }))
  }, [particleCount])

  if (!active) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Background Subtle Warm Radial Gradients */}
      <div className="absolute -top-[15%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-orange-200/20 via-amber-100/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-[15%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-rose-200/15 via-orange-100/15 to-transparent blur-3xl pointer-events-none" />

      {/* Subtle Matrix Grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Flowing Animated Stream Beams */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flowGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flowGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>

        <motion.path
          d="M-100 200 C 300 100, 600 400, 1200 250"
          fill="none"
          stroke="url(#flowGrad1)"
          strokeWidth="1.5"
          strokeDasharray="8 12"
          animate={{ strokeDashoffset: [-100, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />

        <motion.path
          d="M-100 600 C 400 400, 800 700, 1400 500"
          fill="none"
          stroke="url(#flowGrad2)"
          strokeWidth="1.5"
          strokeDasharray="6 14"
          animate={{ strokeDashoffset: [0, -100] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
      </svg>

      {/* Floating Animated Constellation Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full blur-[0.5px] ${p.color}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -35, 0],
            x: [0, p.id % 2 === 0 ? 25 : -25, 0],
            opacity: [p.opacity, p.opacity * 1.7, p.opacity],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
