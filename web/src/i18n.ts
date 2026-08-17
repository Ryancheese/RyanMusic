import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const zh = {
  ui: {
    visualizerClassic: '流光',
    visualizerCadenze: '心象',
    visualizerPartita: '云阶',
    visualizerFume: '浮名',
    visualizerTilt: '倾诉',
    visualizerCladdagh: '回环',
    visualizerMonet: '莫奈',
    visualizerPendolo: '时计',
    visualizerCappella: '群唱',
    visualizerDiorama: '镜台',
    visualizerSonnet: '商籁',
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
