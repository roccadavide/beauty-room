import "./LikeBurst.css";

const LikeBurst = ({ active }) => {
  if (!active) return null;

  return (
    <span className="like-burst" aria-hidden="true">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="hg" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#ff6b8a"/>
            <stop offset="100%" stopColor="#e0195a"/>
          </radialGradient>
        </defs>
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
             a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
             1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          fill="url(#hg)"
          stroke="none"
        />
      </svg>
    </span>
  );
};

export default LikeBurst;
