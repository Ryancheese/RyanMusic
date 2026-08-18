import React from 'react';

interface RyanLoaderProps {
  size?: number;
  label?: string;
  className?: string;
}

/** Folia 风格六边形脉动加载 */
const RyanLoader: React.FC<RyanLoaderProps> = ({ size = 48, label, className = '' }) => {
  const hex = Math.max(10, Math.round(size * 0.28));
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="ryan-loader" style={{ width: size, height: size }}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="ryan-loader-hex"
            style={{
              width: hex,
              height: hex,
              animationDelay: `${index * 0.18}s`,
            }}
          />
        ))}
      </div>
      {label ? <p className="text-xs tracking-wide opacity-50">{label}</p> : null}
    </div>
  );
};

export default RyanLoader;
