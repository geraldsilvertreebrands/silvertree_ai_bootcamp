import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const brandLogos = [
  {
    name: 'SKOON.',
    component: () => (
      <div className="login-logo-text">SKOON.</div>
    )
  },
  {
    name: 'uCook',
    component: () => (
      <svg
        viewBox="0 0 84 16"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        fill="white"
        style={{ width: '130%', height: '130%', transform: 'translateX(-6%)' }}
      >
        <path d="M15.538 5.02c0-3.41-2.127-5.014-4.282-5.014-1.818 0-4.282 1.291-4.282 4.718 0 2.27.5 3.974 2.826 7.177 0 0-1.473 1.403-3.309 1.403-3.128 0-3.65-3.01-3.556-5.64.08-2.183.545-4.7 1.347-7.294H1.285A28.542 28.542 0 0 0 0 8.733c0 4.893 2.92 7.255 6.108 7.255a7.664 7.664 0 0 0 5.12-2.037l1.23 1.762h3.364l-2.686-3.695s2.402-2.95 2.402-6.998Zm-3.367 3.561a28.386 28.386 0 0 1-.638 1.262l-.676-.925a6.475 6.475 0 0 1-1.22-3.68c0-1.525.662-2.55 1.644-2.55.983 0 1.659 1.03 1.659 2.692a7.968 7.968 0 0 1-.769 3.201ZM43.391.023a7.94 7.94 0 0 0-7.411 4.909 7.923 7.923 0 0 0-.598 3.066 8.016 8.016 0 0 0 4.99 7.406 8.03 8.03 0 0 0 8.752-1.795 8.086 8.086 0 0 0 0-11.203A7.896 7.896 0 0 0 43.392.01v.013Zm0 13.043a5.065 5.065 0 0 1-4.912-3.054 5.053 5.053 0 0 1 2.897-6.74 5.064 5.064 0 0 1 2.016-.306 4.992 4.992 0 0 1 4.672 3.097c.25.614.377 1.272.37 1.935a4.996 4.996 0 0 1-5.042 5.057v.011ZM61.59.023a7.943 7.943 0 0 0-7.411 4.91 7.928 7.928 0 0 0-.599 3.065 8.015 8.015 0 0 0 4.993 7.404 8.03 8.03 0 0 0 8.751-1.799 8.084 8.084 0 0 0 0-11.203A7.893 7.893 0 0 0 61.589.01v.013Zm0 13.043a5.063 5.063 0 0 1-4.687-3.11 5.053 5.053 0 0 1 1.087-5.517 5.062 5.062 0 0 1 8.645 3.57 5.004 5.004 0 0 1-3.108 4.671 5.013 5.013 0 0 1-1.937.375v.011ZM84 15.731h-3.428l-5.734-7.698L80.57.35h3.424l-5.86 7.685L84 15.73ZM74.838.366V15.73h-2.92V.366h2.92ZM30.176 10.19h3.143a7.882 7.882 0 0 1-2.254 3.643 8.071 8.071 0 0 1-5.48 2.155A7.985 7.985 0 0 1 18.2 11.09a7.968 7.968 0 0 1 1.697-8.695A7.93 7.93 0 0 1 25.586 0c3.53 0 6.766 2.48 7.708 5.777h-3.115a5.007 5.007 0 0 0-4.593-2.836 5.063 5.063 0 0 0-5.06 5.057 5.055 5.055 0 0 0 5.06 5.057 4.997 4.997 0 0 0 4.59-2.865Z"/>
      </svg>
    )
  },
  {
    name: 'Pet Heaven',
    component: () => (
      <div className="text-[0.7rem] font-semibold tracking-[0.2em] text-white">PET HEAVEN</div>
    )
  }
];

// Orbital blocks (3 concentric orbits)
const orbitalBlocks = [
  // Inner orbit (6 blocks)
  { id: 1, ring: 1, angle: -8, size: 14, speed: 68, shade: 'rgba(100, 100, 100, 0.18)' },
  { id: 2, ring: 1, angle: 59, size: 12, speed: 71, shade: 'rgba(120, 120, 120, 0.15)' },
  { id: 3, ring: 1, angle: 138, size: 16, speed: 66, shade: 'rgba(90, 90, 90, 0.20)' },
  { id: 4, ring: 1, angle: 205, size: 13, speed: 69, shade: 'rgba(110, 110, 110, 0.16)' },
  { id: 5, ring: 1, angle: 276, size: 15, speed: 65, shade: 'rgba(95, 95, 95, 0.19)' },
  { id: 6, ring: 1, angle: 341, size: 13, speed: 72, shade: 'rgba(98, 98, 98, 0.18)' },

  // Middle orbit (9 blocks)
  { id: 7, ring: 2, angle: -3, size: 20, speed: 112, shade: 'rgba(85, 85, 85, 0.22)' },
  { id: 8, ring: 2, angle: 49, size: 18, speed: 116, shade: 'rgba(115, 115, 115, 0.16)' },
  { id: 9, ring: 2, angle: 103, size: 22, speed: 108, shade: 'rgba(95, 95, 95, 0.20)' },
  { id: 10, ring: 2, angle: 158, size: 19, speed: 114, shade: 'rgba(100, 100, 100, 0.18)' },
  { id: 11, ring: 2, angle: 212, size: 21, speed: 110, shade: 'rgba(90, 90, 90, 0.19)' },
  { id: 12, ring: 2, angle: 267, size: 20, speed: 118, shade: 'rgba(110, 110, 110, 0.17)' },
  { id: 13, ring: 2, angle: 314, size: 18, speed: 106, shade: 'rgba(105, 105, 105, 0.16)' },
  { id: 14, ring: 2, angle: 357, size: 22, speed: 113, shade: 'rgba(86, 86, 86, 0.23)' },
  { id: 15, ring: 2, angle: 404, size: 19, speed: 117, shade: 'rgba(110, 110, 110, 0.20)' },

  // Outer orbit (12 blocks) - largest, slowest
  { id: 16, ring: 3, angle: 5, size: 26, speed: 155, shade: 'rgba(75, 75, 75, 0.24)' },
  { id: 17, ring: 3, angle: 35, size: 24, speed: 160, shade: 'rgba(105, 105, 105, 0.18)' },
  { id: 18, ring: 3, angle: 68, size: 28, speed: 150, shade: 'rgba(85, 85, 85, 0.22)' },
  { id: 19, ring: 3, angle: 100, size: 25, speed: 158, shade: 'rgba(95, 95, 95, 0.20)' },
  { id: 20, ring: 3, angle: 135, size: 27, speed: 152, shade: 'rgba(80, 80, 80, 0.23)' },
  { id: 21, ring: 3, angle: 168, size: 24, speed: 162, shade: 'rgba(110, 110, 110, 0.17)' },
  { id: 22, ring: 3, angle: 200, size: 26, speed: 156, shade: 'rgba(90, 90, 90, 0.21)' },
  { id: 23, ring: 3, angle: 235, size: 28, speed: 148, shade: 'rgba(78, 78, 78, 0.25)' },
  { id: 24, ring: 3, angle: 268, size: 25, speed: 159, shade: 'rgba(100, 100, 100, 0.19)' },
  { id: 25, ring: 3, angle: 300, size: 27, speed: 153, shade: 'rgba(88, 88, 88, 0.22)' },
  { id: 26, ring: 3, angle: 332, size: 24, speed: 161, shade: 'rgba(105, 105, 105, 0.18)' },
  { id: 27, ring: 3, angle: 362, size: 26, speed: 154, shade: 'rgba(82, 82, 82, 0.24)' },
];

const getRingRadius = (ring: number) => {
  switch (ring) {
    case 1: return 230; // Inner orbit
    case 2: return 420; // Middle orbit
    case 3: return 620; // Outer orbit - extends to edges
    default: return 120;
  }
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  const { login } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogoIndex((prev) => (prev + 1) % brandLogos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const CurrentLogo = brandLogos[currentLogoIndex].component;

  return (
    <div className="login-container">
      {/* Orbital blocks moving in circular paths */}
      {orbitalBlocks.map((block) => {
        const radius = getRingRadius(block.ring);
        const blockLength =
          block.size *
          (block.ring === 1 ? 2.3 : block.ring === 2 ? 2.8 : 3.2);
        const blockThickness = Math.max(6, block.size * (block.ring === 3 ? 0.55 : 0.6));
        const baseTilt = block.ring === 1 ? -8 : block.ring === 2 ? 12 : -5;

        return (
          <motion.div
            key={block.id}
            className="floating-block-wrapper"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 0,
              height: 0,
              zIndex: 1,
            }}
            initial={{ rotate: block.angle }}
            animate={{ rotate: block.angle + 360 }}
            transition={{
              duration: block.speed,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div
              className="floating-block"
              style={{
                width: blockLength,
                height: blockThickness,
                background: block.shade,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(-50%, -50%) translateX(${radius}px) rotate(${baseTilt}deg)`,
                boxShadow: '0 0 12px rgba(0, 0, 0, 0.35)',
              }}
            />
          </motion.div>
        );
      })}

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="login-content"
      >
        {/* Logo box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="login-logo-box"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentLogoIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="login-logo-wrapper"
            >
              <CurrentLogo />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="login-title"
          style={{ color: '#ffffff', fontSize: 'clamp(1.5rem, 4.5vw, 2.15rem)' }}
        >
          Silvertree Access Management
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="login-subtitle"
        >
          Secure, streamlined access control across all your systems.
        </motion.p>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          onSubmit={handleSubmit}
          className="login-form"
        >
          <div className="login-field">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="login-input"
              required
            />
          </div>

          <div className="login-field">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="login-error"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="login-button"
          >
            {loading ? (
              <span className="login-button-loading">
                <motion.span
                  className="login-spinner"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </motion.form>

      </motion.div>

      {/* Corner accents */}
      <div className="corner-accent corner-tl" />
      <div className="corner-accent corner-br" />
    </div>
  );
}
