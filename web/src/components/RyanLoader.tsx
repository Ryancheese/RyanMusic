import React from 'react';

interface RyanLoaderProps {
  size?: number;
  label?: string;
  className?: string;
  /** circular = 圆形点阵；hex = 旧六边形 */
  variant?: 'circular' | 'hex';
}

/** Folia 风格加载指示 */
const RyanLoader: React.FC<RyanLoaderProps> = ({
  size = 48,
  label,
  className = '',
  variant = 'circular',
}) => {
  const dot = Math.max(6, Math.round(size * 0.22));
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="ryan-loader" style={{ width: size, height: size }} data-variant={variant}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={variant === 'hex' ? 'ryan-loader-hex' : 'ryan-loader-dot'}
            style={{
              width: dot,
              height: dot,
              minWidth: dot,
              minHeight: dot,
              borderRadius: variant === 'hex' ? undefined : 9999,
              animationDelay: `${index * 0.16}s`,
            }}
          />
        ))}
      </div>
      {label ? <p className="text-xs tracking-wide opacity-50">{label}</p> : null}
    </div>
  );
};

export default RyanLoader;
