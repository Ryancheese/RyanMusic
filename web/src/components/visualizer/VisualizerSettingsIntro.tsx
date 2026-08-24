import React from 'react';
import { localizeVisualizerCopy } from '../../lib/visualizerI18n';

interface VisualizerSettingsIntroProps {
  title: string;
  description?: string;
  localizeDescription?: boolean;
}

const VisualizerSettingsIntro: React.FC<VisualizerSettingsIntroProps> = ({
  title,
  description,
  localizeDescription = true,
}) => {
  const resolvedDescription = description
    ? (localizeDescription ? localizeVisualizerCopy(description) : description)
    : undefined;

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      {resolvedDescription ? (
        <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
          {resolvedDescription}
        </div>
      ) : null}
    </div>
  );
};

export default VisualizerSettingsIntro;
