export const scenes = {
  flowing: {
    id: 'flowing', number: '01', name: '流动幻境', english: 'Flowing Illusion',
    folder: 'flowing',
    description: '原始三张贴图、网格、材质与 GLES3 片元计算移植到 WebGL2。',
    material: 'Low 0.55 · Mid 0.5 · Step 0.35', camera: '16:9 · FOV 60° · 原始裁切',
    lyric: 'OPPOSans Heavy · 30ms / 字',
    unknown: '待核对原机音频幅值映射、运行时歌词行为和色彩空间。',
    load: async () => (await import('./renderer.js')).createFlowingRenderer,
  },
  mobius: {
    id: 'mobius', number: '02', name: '莫比乌斯光环', english: 'Mobius', folder: 'mobius',
    description: '使用坚果原始环带网格、层级和内外发光材质，移植三组 GLES3 渲染程序。',
    material: '原始 Mobius / Light / Bloom', camera: '16:9 · FOV 60° · 原始相机',
    lyric: '播放器动态字幕 · 可切换字效与艺术字体',
    lyricPresentation: {
      hidden: false, disabled: false, readable: true, fontFamily: 'JMGOBold',
      fontSize: 72, autoSize: false, width: 1574, anchorY: 0.3, y: 0,
      shadowY: 0, typewriterInterval: 0, appearanceDuration: 0, fallbackToTitle: true,
    },
    unknown: '待核对原机音频映射、旋转控制与发光层的运行时参数。',
    load: async () => (await import('./mobius-renderer.js')).createMobiusRenderer,
  },
  shapes: {
    id: 'shapes', number: '03', name: '轮廓几何', english: 'Shapes FX', folder: 'shapes',
    description: '使用原始球体、方块网格、五组源材质和 MusicFX 渲染程序，保留轮廓与 MatCap 表面计算。',
    material: '原始 MusicFX · 五组造型／材质', camera: '16:9 · 演示相机适配',
    lyric: '补充演示歌词 · 下方高对比字幕',
    lyricPresentation: {
      hidden: false, disabled: false, readable: true, fontFamily: 'JMGOBold',
      fontSize: 72, autoSize: false, width: 1574, anchorY: 0.3, y: 0,
      shadowY: 0, typewriterInterval: 0, appearanceDuration: 0, fallbackToTitle: true,
    },
    unknown: '相机采用演示适配；造型选择、旋转与音频驱动的原生运行方程仍待核实。',
    load: async () => (await import('./shapes-renderer.js')).createShapesRenderer,
  },
  elantra: {
    id: 'elantra', number: '04', name: '动态几何球', english: 'Elantra Ball', folder: 'elantra',
    description: '使用原始球体网格、MatCap、渐变与轮廓贴图，保留八频段顶点形变计算。',
    material: '原始 DynamicGeometry · 八频段形变', camera: '16:9 · 原始相机与球体比例',
    lyric: '演示字幕置于下方 · 加强字号与对比度',
    lyricPresentation: {
      hidden: false, disabled: false, readable: true, fontFamily: 'JMGOBold',
      fontSize: 72, autoSize: false, width: 1574, anchorY: 0.3, y: 0,
      shadowY: 0, typewriterInterval: 0, appearanceDuration: 0, fallbackToTitle: true,
    },
    unknown: '待核对原机八频段输入幅值和圆环粒子的触发时序。',
    load: async () => (await import('./elantra-renderer.js')).createElantraRenderer,
  },
  matrix: {
    id: 'matrix', number: '05', name: '光影矩阵', english: 'Matrix', folder: 'matrix',
    description: '使用 24 个原始网格和源材质变体，保留 MatrixAudio 驱动的顶点与片元计算。',
    material: '原始 Matrix / MatrixLight 材质变体', camera: '16:9 · FOV 36° · 原始层级',
    lyric: 'OPPOSans Bold · 原始布局参数',
    unknown: '待核对 MatrixAudio 的幅值归一化、段落激活与运行时控制。',
    load: async () => (await import('./matrix-renderer.js')).createMatrixRenderer,
  },
  vinyl: {
    id: 'vinyl', number: '06', name: '黑胶唱机', english: 'Vinyl', folder: 'vinyl',
    description: '优先还原源包默认启用的唱机布局，使用原始唱盘、唱针、封面与阴影资源，并读取源动画曲线。',
    material: '原始唱机贴图、材质与布局', camera: '16:9 · 原始正交相机',
    lyric: '源歌词、歌曲信息与遮罩布局',
    unknown: '原生动画状态机、运行时布局切换和歌曲信息覆盖行为仍待核实。',
    load: async () => (await import('./vinyl-renderer.js')).createVinylRenderer,
  },
};

export function getScene(id) { return scenes[id] ?? scenes.flowing; }
