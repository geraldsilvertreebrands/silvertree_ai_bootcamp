import { motion } from 'framer-motion';

export default function UsersView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-dark-elevated rounded-xl p-12 text-center"
    >
      <p className="text-white/60 relative z-10 font-medium">Users view coming soon</p>
    </motion.div>
  );
}

