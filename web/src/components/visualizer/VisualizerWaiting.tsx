import React from 'react';

interface VisualizerWaitingProps {
  size?: number;
  coverUrl?: string | null;
}

/**
 * 歌词未就绪时的舞台占位。加载态改由 PlayerView 胶囊统一展示，这里不再叠第二套文案。
 */
const VisualizerWaiting: React.FC<VisualizerWaitingProps> = (_props) => null;

export default VisualizerWaiting;
