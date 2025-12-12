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

// Orbital blocks (5 concentric orbits) - parallelograms tangent to orbit
// Colors: dark browns, purples, greys - high opacity
const orbitalBlocks = [
  // Ring 1 - innermost (6 blocks) - speeds increased ~43% for 30% slower
  { id: 1, ring: 1, angle: -8, size: 14, speed: 89, shade: 'rgba(32, 22, 15, 0.85)' },      // dark brown
  { id: 2, ring: 1, angle: 59, size: 12, speed: 112, shade: 'rgba(25, 20, 38, 0.82)' },     // dark purple
  { id: 3, ring: 1, angle: 138, size: 16, speed: 83, shade: 'rgba(35, 35, 35, 0.84)' },     // dark grey
  { id: 4, ring: 1, angle: 205, size: 13, speed: 104, shade: 'rgba(38, 28, 18, 0.80)' },    // dark brown
  { id: 5, ring: 1, angle: 276, size: 15, speed: 93, shade: 'rgba(28, 22, 42, 0.83)' },     // dark purple
  { id: 6, ring: 1, angle: 341, size: 13, speed: 100, shade: 'rgba(32, 32, 32, 0.82)' },    // dark grey

  // Ring 2 - between inner and middle (7 blocks)
  { id: 7, ring: 2, angle: 15, size: 15, speed: 107, shade: 'rgba(35, 25, 18, 0.84)' },     // dark brown
  { id: 8, ring: 2, angle: 68, size: 14, speed: 126, shade: 'rgba(28, 22, 40, 0.80)' },     // dark purple
  { id: 9, ring: 2, angle: 120, size: 16, speed: 100, shade: 'rgba(33, 33, 33, 0.86)' },    // dark grey
  { id: 10, ring: 2, angle: 175, size: 15, speed: 117, shade: 'rgba(40, 28, 20, 0.82)' },   // dark brown
  { id: 11, ring: 2, angle: 230, size: 14, speed: 112, shade: 'rgba(30, 24, 44, 0.84)' },   // dark purple
  { id: 12, ring: 2, angle: 285, size: 16, speed: 122, shade: 'rgba(38, 38, 38, 0.80)' },   // dark grey
  { id: 13, ring: 2, angle: 335, size: 15, speed: 103, shade: 'rgba(34, 24, 16, 0.85)' },   // dark brown

  // Ring 3 - middle (9 blocks)
  { id: 14, ring: 3, angle: -3, size: 20, speed: 140, shade: 'rgba(30, 22, 14, 0.88)' },    // dark brown
  { id: 15, ring: 3, angle: 49, size: 18, speed: 179, shade: 'rgba(24, 18, 36, 0.82)' },    // dark purple
  { id: 16, ring: 3, angle: 103, size: 22, speed: 136, shade: 'rgba(35, 35, 35, 0.85)' },   // dark grey
  { id: 17, ring: 3, angle: 158, size: 19, speed: 169, shade: 'rgba(42, 30, 20, 0.80)' },   // dark brown
  { id: 18, ring: 3, angle: 212, size: 21, speed: 150, shade: 'rgba(28, 22, 42, 0.84)' },   // dark purple
  { id: 19, ring: 3, angle: 267, size: 20, speed: 186, shade: 'rgba(32, 32, 32, 0.82)' },   // dark grey
  { id: 20, ring: 3, angle: 314, size: 18, speed: 143, shade: 'rgba(36, 26, 16, 0.86)' },   // dark brown
  { id: 21, ring: 3, angle: 357, size: 22, speed: 160, shade: 'rgba(26, 20, 40, 0.84)' },   // dark purple
  { id: 22, ring: 3, angle: 404, size: 19, speed: 175, shade: 'rgba(40, 28, 18, 0.80)' },   // dark brown

  // Ring 4 - between middle and outer (12 blocks)
  { id: 23, ring: 4, angle: 8, size: 22, speed: 165, shade: 'rgba(32, 24, 16, 0.88)' },     // dark brown
  { id: 24, ring: 4, angle: 38, size: 20, speed: 193, shade: 'rgba(24, 18, 38, 0.82)' },    // dark purple
  { id: 25, ring: 4, angle: 68, size: 24, speed: 154, shade: 'rgba(35, 35, 35, 0.84)' },    // dark grey
  { id: 26, ring: 4, angle: 98, size: 21, speed: 183, shade: 'rgba(42, 28, 18, 0.80)' },    // dark brown
  { id: 27, ring: 4, angle: 128, size: 23, speed: 169, shade: 'rgba(30, 24, 44, 0.85)' },   // dark purple
  { id: 28, ring: 4, angle: 158, size: 20, speed: 200, shade: 'rgba(32, 32, 32, 0.82)' },   // dark grey
  { id: 29, ring: 4, angle: 188, size: 24, speed: 160, shade: 'rgba(36, 26, 16, 0.86)' },   // dark brown
  { id: 30, ring: 4, angle: 218, size: 22, speed: 189, shade: 'rgba(26, 20, 40, 0.82)' },   // dark purple
  { id: 31, ring: 4, angle: 248, size: 21, speed: 172, shade: 'rgba(30, 30, 30, 0.84)' },   // dark grey
  { id: 32, ring: 4, angle: 278, size: 23, speed: 197, shade: 'rgba(34, 24, 14, 0.85)' },   // dark brown
  { id: 33, ring: 4, angle: 308, size: 20, speed: 179, shade: 'rgba(28, 22, 42, 0.80)' },   // dark purple
  { id: 34, ring: 4, angle: 338, size: 24, speed: 157, shade: 'rgba(38, 38, 38, 0.88)' },   // dark grey

  // Ring 5 - outermost (18 blocks)
  { id: 35, ring: 5, angle: 2, size: 26, speed: 207, shade: 'rgba(30, 20, 12, 0.90)' },     // dark brown
  { id: 36, ring: 5, angle: 23, size: 24, speed: 246, shade: 'rgba(24, 18, 36, 0.84)' },    // dark purple
  { id: 37, ring: 5, angle: 41, size: 28, speed: 197, shade: 'rgba(33, 33, 33, 0.88)' },    // dark grey
  { id: 38, ring: 5, angle: 64, size: 25, speed: 236, shade: 'rgba(42, 28, 18, 0.82)' },    // dark brown
  { id: 39, ring: 5, angle: 83, size: 27, speed: 215, shade: 'rgba(30, 24, 44, 0.86)' },    // dark purple
  { id: 40, ring: 5, angle: 107, size: 24, speed: 255, shade: 'rgba(35, 35, 35, 0.80)' },   // dark grey
  { id: 41, ring: 5, angle: 128, size: 26, speed: 203, shade: 'rgba(36, 26, 16, 0.85)' },   // dark brown
  { id: 42, ring: 5, angle: 151, size: 28, speed: 240, shade: 'rgba(26, 20, 40, 0.88)' },   // dark purple
  { id: 43, ring: 5, angle: 169, size: 25, speed: 222, shade: 'rgba(30, 30, 30, 0.82)' },   // dark grey
  { id: 44, ring: 5, angle: 192, size: 27, speed: 265, shade: 'rgba(34, 24, 14, 0.84)' },   // dark brown
  { id: 45, ring: 5, angle: 214, size: 24, speed: 212, shade: 'rgba(28, 22, 42, 0.82)' },   // dark purple
  { id: 46, ring: 5, angle: 237, size: 26, speed: 250, shade: 'rgba(35, 35, 35, 0.86)' },   // dark grey
  { id: 47, ring: 5, angle: 259, size: 25, speed: 193, shade: 'rgba(40, 28, 18, 0.80)' },   // dark brown
  { id: 48, ring: 5, angle: 283, size: 28, speed: 232, shade: 'rgba(24, 18, 36, 0.88)' },   // dark purple
  { id: 49, ring: 5, angle: 304, size: 24, speed: 217, shade: 'rgba(32, 32, 32, 0.84)' },   // dark grey
  { id: 50, ring: 5, angle: 327, size: 27, speed: 257, shade: 'rgba(36, 26, 16, 0.82)' },   // dark brown
  { id: 51, ring: 5, angle: 347, size: 26, speed: 200, shade: 'rgba(30, 24, 42, 0.85)' },   // dark purple
  { id: 52, ring: 5, angle: 371, size: 25, speed: 243, shade: 'rgba(34, 24, 14, 0.88)' },   // dark brown
];

const getRingRadius = (ring: number) => {
  // Distance increases gradually as we go out
  switch (ring) {
    case 1: return 320;  // Innermost
    case 2: return 328;  // 8px gap
    case 3: return 365;  // 37px gap
    case 4: return 420;  // 55px gap
    case 5: return 500;  // 80px gap
    default: return 320;
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
      {/* Orbital parallelograms - tangent to orbit (forming circular pattern) */}
      {orbitalBlocks.map((block) => {
        const radius = getRingRadius(block.ring);

        // Parallelograms with max 1:3 width-to-length ratio, some nearly square
        // Size reduced by 20% (* 0.8), varies by ring
        const sizeMultiplier = 0.8; // 20% reduction
        const baseSize = block.ring >= 4
          ? (14 + block.size * 0.35) * sizeMultiplier
          : block.ring === 3
            ? (12 + block.size * 0.3) * sizeMultiplier
            : (8 + block.size * 0.25) * sizeMultiplier;

        // Vary the aspect ratio: some 1:1.5, some 1:2, some 1:2.5, max 1:3
        const aspectRatio = 1.5 + (block.id % 4) * 0.5;
        const rectWidth = baseSize;
        const rectHeight = baseSize * aspectRatio;

        // Skew angle for parallelogram effect (varies by block for variety)
        const skewAngle = 20 + (block.id % 5) * 5; // 20-40 degrees

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
              zIndex: block.ring,
            }}
            initial={{ rotate: block.angle }}
            animate={{ rotate: block.angle + 360 }}
            transition={{
              duration: block.speed,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {/* Parallelogram tangent to orbit */}
            <div
              className="floating-block"
              style={{
                width: rectWidth,
                height: rectHeight,
                background: block.shade,
                position: 'absolute',
                left: 0,
                top: 0,
                // Position at radius, centered, with skew for parallelogram shape
                transform: `translateX(${radius}px) translate(-50%, -50%) skewY(${skewAngle}deg)`,
                borderRadius: '2px',
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
