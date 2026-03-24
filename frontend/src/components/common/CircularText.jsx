import { useEffect } from "react";
import { motion, useAnimation, useMotionValue } from "framer-motion";

const MotionDiv = motion.div;

const getRotationTransition = (duration, from, loop = true) => ({
  from,
  to: from + 360,
  ease: "linear",
  duration,
  type: "tween",
  repeat: loop ? Infinity : 0,
});

const getTransition = (duration, from) => ({
  rotate: getRotationTransition(duration, from),
  scale: { type: "spring", damping: 20, stiffness: 300 },
});

const CircularText = ({ text, spinDuration = 18, onHover = "slowDown", logoSrc = null, logoAlt = "Logo" }) => {
  const letters = Array.from(text);
  const controls = useAnimation();
  const rotation = useMotionValue(0);

  useEffect(() => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start),
    });
  }, [spinDuration, text, controls, rotation]);

  const handleHoverStart = () => {
    const start = rotation.get();
    let transitionConfig;
    switch (onHover) {
      case "slowDown":
        transitionConfig = getTransition(spinDuration * 2.5, start);
        break;
      case "speedUp":
        transitionConfig = getTransition(spinDuration / 4, start);
        break;
      case "pause":
        transitionConfig = {
          rotate: { type: "spring", damping: 20, stiffness: 300 },
          scale: { type: "spring", damping: 20, stiffness: 300 },
        };
        break;
      default:
        transitionConfig = getTransition(spinDuration, start);
    }
    controls.start({ rotate: start + 360, scale: 1, transition: transitionConfig });
  };

  const handleHoverEnd = () => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start),
    });
  };

  return (
    <div className="circular-text-wrapper">
      <MotionDiv
        className="circular-text"
        style={{ rotate: rotation }}
        initial={{ rotate: 0 }}
        animate={controls}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
      >
        {letters.map((letter, i) => {
          const rotationDeg = (360 / letters.length) * i;
          const factor = Math.PI / letters.length;
          const x = factor * i;
          const y = factor * i;
          const transform = `rotateZ(${rotationDeg}deg) translate3d(${x}px, ${y}px, 0)`;
          return (
            <span key={i} style={{ transform, WebkitTransform: transform }}>
              {letter}
            </span>
          );
        })}
      </MotionDiv>

      {logoSrc && <img src={logoSrc} alt={logoAlt} className="circular-text-logo" draggable={false} />}
    </div>
  );
};

export default CircularText;
