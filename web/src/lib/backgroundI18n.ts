/** 背景设置面板中文兜底 */
const BG_I18N: Record<string, string> = {
  'options.disableVisualizerVignette': '关闭暗角',
  'options.disableVisualizerVignetteDesc': '去掉舞台边缘压暗',
  'options.disableVisualizerGeometricBackground': '关闭几何背景',
  'options.disableVisualizerGeometricBackgroundDesc': '去掉线条几何装饰',
  'options.previewCoverBackgroundSettings': '封面取色背景',
  'options.previewCoverBackgroundSettingsDesc': '用封面主色渲染舞台底色',
  'theme.addCoverColor': '启用封面取色',
  'options.coverColorBackgroundDesc': '根据封面生成流体底色',
  'options.previewCoverBackgroundOpacity': '背景透明度',

  'options.monetBackgroundSettings': 'Monet 背景',
  'options.monetBackgroundSettingsDesc': '用歌曲封面或自定义图片作为舞台背景',
  'options.monetGroupBackgroundSource': '背景来源',
  'options.monetBackgroundSource': '图片来源',
  'options.monetBackgroundSourceCover': '歌曲封面',
  'options.monetBackgroundSourceUploaded': '自定义上传',
  'options.monetUploadBackground': '上传背景图',
  'options.monetClearBackground': '清除上传图',
  'options.monetGroupLayoutPosition': '布局与位置',
  'options.monetBackgroundLayout': '布局',
  'options.monetLayoutHalfPane': '半屏渐变',
  'options.monetLayoutFullOverlay': '全屏铺满',
  'options.monetHalfPaneOffsetX': '半屏水平偏移',
  'options.monetGroupFiltersPostProcessing': '滤镜与后处理',
  'options.monetBackgroundBlur': '模糊',
  'options.monetBackgroundSaturation': '饱和度',
  'options.monetBackgroundGrayscale': '灰度',
  'options.monetGroupColorTintWash': '色调与色洗',
  'options.monetBackgroundOverlayOpacity': '遮罩浓度',
  'options.monetBackgroundWash': '色洗强度',
  'options.monetBackgroundWashColorMode': '色洗颜色模式',
  'options.monetBackgroundWashTheme': '跟随主题',
  'options.monetBackgroundWashCustom': '自定义',
  'options.monetBackgroundWashCustomColor': '自定义色洗颜色',

  'options.nomandBackgroundSettings': 'Nomand 背景',
  'options.nomandBackgroundSettingsDesc': '纸感抖动风格的封面背景',
  'options.nomandBackgroundSource': '图片来源',
  'options.nomandBackgroundUploadSuccess': '上传成功',
  'options.nomandBackgroundUploadFailed': '上传失败',
  'options.nomandBackgroundDitheringType': '抖动类型',
  'options.nomandBackgroundOverlay': '启用遮罩',
  'options.nomandBackgroundOverlayDesc': '在抖动图上叠加半透明遮罩',
  'options.nomandBackgroundOverlayOpacity': '遮罩透明度',
  'options.nomandBackgroundSize': '颗粒大小',
  'options.nomandBackgroundColorSteps': '色阶',
  'options.nomandBackgroundOriginalColors': '保留原色',
  'options.nomandBackgroundInverted': '反相',

  'options.latentBackgroundSettings': 'Latent 背景',
  'options.latentBackgroundSettingsDesc': '抽象抖动与网格动态背景',
  'options.latentDisplayMode': '显示模式',
  'options.latentDisplayDithering': '抖动',
  'options.latentDisplayMesh': '网格',
  'options.latentDisplayBoth': '同时',
  'options.latentColorSource': '颜色来源',
  'options.latentColorSourceCoverTheme': '封面主题',
  'options.latentColorSourceCoverOnly': '仅封面',
  'options.latentDynamicOnlyInPlayer': '仅播放页动态',
  'options.latentDynamicOnlyInPlayerDesc': '离开播放页时静止，节省性能',
  'options.latentEnhancedBeatResponse': '增强节拍响应',
  'options.latentEnhancedBeatResponseDesc': '更强地跟随低频与节拍脉动',
  'options.latentDitheringGroup': '抖动参数',
  'options.latentMeshGroup': '网格参数',
  'options.latentBaseSpeed': '基础速度',
  'options.latentAudioSpeed': '音频联动速度',
  'options.latentDitheringSize': '抖动大小',
  'options.latentDitheringOpacity': '抖动透明度',
  'options.latentMeshDistortion': '网格扭曲',
  'options.latentMeshSwirl': '网格旋转',

  'options.urlBackgroundSettings': '网页嵌入背景',
  'options.urlBackgroundSettingsDesc': '嵌入网页作为舞台背景',
  'options.urlBackgroundNotePlaceholder': '备注（可选）',
  'options.urlBackgroundAdd': '添加网页',
  'options.urlBackgroundEmpty': '还没有嵌入网页',
};

export function translateBackgroundOption(key: string): string {
  const raw = String(key || '').trim();
  if (!raw) return '';
  if (BG_I18N[raw]) return BG_I18N[raw];
  const lower = raw.replace(/^OPTIONS\./i, 'options.');
  if (BG_I18N[lower]) return BG_I18N[lower];
  const soft = lower.replace(/([a-z])([A-Z])/g, '$1$2');
  if (BG_I18N[soft]) return BG_I18N[soft];
  return raw;
}
