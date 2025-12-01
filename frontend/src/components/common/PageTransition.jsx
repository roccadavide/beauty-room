import { motion, useReducedMotion } from "framer-motion";

const MotionDiv = motion.div;

export default function PageTransition({ children, routeKey }) {
  const reduce = useReducedMotion();

  const ease = [0.25, 0.1, 0.25, 1];

  return (
    <MotionDiv
      key={routeKey}
      initial={{
        opacity: 0,
        y: reduce ? 0 : 40,
        scale: reduce ? 1 : 0.98,
        filter: "blur(10px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        y: reduce ? 0 : -30,
        scale: reduce ? 1 : 0.985,
        filter: "blur(10px)",
      }}
      transition={{
        duration: 0.9,
        ease,
      }}
      style={{
        willChange: "opacity, transform, filter",
        transformOrigin: "center center",
      }}
    >
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
        exit={{
          opacity: 0.25,
          transition: { duration: 0.4, ease },
        }}
        transition={{ duration: 0.6, ease }}
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(circle at center, rgba(255, 248, 240, 0.6), rgba(255, 245, 235, 0.9))",
          pointerEvents: "none",
          zIndex: 999,
        }}
      />
      {children}
    </MotionDiv>
  );
}
