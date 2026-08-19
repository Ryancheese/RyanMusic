import React from 'react';
import { Archive } from 'lucide-react';

interface DelistedCoverBadgeProps {
  className?: string;
  size?: number;
}

const DelistedCoverBadge: React.FC<DelistedCoverBadgeProps> = ({
  className = '',
  size = 12,
}) => (
  <span
    className={`pointer-events-none absolute right-1 bottom-1 z-10 inline-flex items-center justify-center rounded-md bg-black/58 p-1 text-white shadow-sm backdrop-blur-[2px] ${className}`}
    title="平台已下架，将通过 RyanMusic 私链播放"
    aria-label="已下架"
  >
    <Archive size={size} strokeWidth={2.2} />
  </span>
);

export default DelistedCoverBadge;
