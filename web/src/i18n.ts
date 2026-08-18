import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const zh = {
  ui: {
    visualizerClassic: '散字',
    visualizerCadenze: '浮字',
    visualizerPartita: '竖阶',
    visualizerFume: '长卷',
    visualizerTilt: '斜行',
    visualizerCladdagh: '环轨',
    visualizerMonet: '侧栏',
    visualizerPendolo: '钟摆',
    visualizerCappella: '对白',
    visualizerDiorama: '景深',
    visualizerSonnet: '海报',
    visualizerSpotlight: '聚光',
    backToHome: '返回主页',
    livePreview: '实时预览',
  },
  options: {
    lyricsStyleSettings: '歌词样式',
    lyricsAnimation: '歌词动画',
  },
  remote: {
    disableClickThrough: '关闭点击穿透',
    enableClickThrough: '开启点击穿透',
  },
};

void i18n.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  resources: {
    'zh-CN': { translation: zh },
  },
});

export default i18n;
