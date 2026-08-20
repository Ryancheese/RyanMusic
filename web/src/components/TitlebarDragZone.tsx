import React from 'react';
import { isMacosApp, isWindowsApp } from '../lib/media';
import { postWindowChrome } from '../lib/windowChrome';

/** 顶部拖动条：macOS 走 app-region，Windows 把按下交给原生窗口。 */
const TitlebarDragZone: React.FC = () => {
  const windows = isWindowsApp();
  const macos = isMacosApp();
  if (!windows && !macos) return null;

  return (
    <div
      className="titlebar-drag fixed top-0 left-0 z-[95] h-9"
      style={{ right: windows ? 176 : 0 }}
      onMouseDown={(event) => {
        if (!windows || event.button !== 0) return;
        event.preventDefault();
        postWindowChrome('drag');
      }}
      onDoubleClick={() => {
        if (!windows) return;
        postWindowChrome('toggleMaximize');
      }}
    />
  );
};

export default TitlebarDragZone;
