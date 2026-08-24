export type OnboardingScene = 'home' | 'player';

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  /** Matches `[data-tour="..."]`. Empty = centered intro card. */
  target?: string;
  scene: OnboardingScene;
  requireLogin?: boolean;
  requireTrack?: boolean;
  openPanel?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    scene: 'home',
    title: '欢迎来到 RyanMusic',
    body: '这是一次短引导，会把首页和歌词舞台上的按钮挨个点给你看。随时可以跳过，之后也能在设置里再看一遍。',
  },
  {
    id: 'account',
    scene: 'home',
    target: 'account',
    title: '账号与平台',
    body: '点这里登录网易云或 QQ 音乐，也可以在两个平台之间切换。登录后才能同步自己的歌单。',
  },
  {
    id: 'sections',
    scene: 'home',
    target: 'sections',
    requireLogin: true,
    title: '歌单和推荐',
    body: '「歌单」是你账号里的列表；「推荐」是每日推荐、私人雷达和发现内容。点标签即可左右切换。',
  },
  {
    id: 'search',
    scene: 'home',
    target: 'search',
    title: '搜索歌曲',
    body: '输入歌名，也可以加上歌手，回车搜索。有网页链接的话，直接粘贴进来也行。',
  },
  {
    id: 'theme',
    scene: 'home',
    target: 'theme',
    title: '日夜外观',
    body: '一键切换浅色 / 深色。背景和歌词颜色会跟着变。',
  },
  {
    id: 'settings',
    scene: 'home',
    target: 'settings',
    title: '设置',
    body: '歌词来源、评论气泡、跨渠道保底、底栏玻璃效果和缓存清理都在这里。',
  },
  {
    id: 'accent',
    scene: 'home',
    target: 'accent',
    title: '主题色',
    body: '选一个强调色，或让封面自动取色。按钮高亮和舞台氛围会跟着走。',
  },
  {
    id: 'update',
    scene: 'home',
    target: 'update',
    title: '检查更新',
    body: '电脑版可以从这里拉取新安装包并覆盖。有新版本时角上会亮一个小点。',
  },
  {
    id: 'help',
    scene: 'home',
    target: 'help',
    title: '使用帮助',
    body: '更细的说明、隐私政策和免责声明在这里。引导错过了，也可以从设置里重开。',
  },
  {
    id: 'layout',
    scene: 'home',
    target: 'layout',
    title: '浏览布局',
    body: '蜂窝适合扫封面，方形更整齐，列表适合快速找歌名。设置里还能改卡片铭牌和列表列数。',
  },
  {
    id: 'library',
    scene: 'home',
    target: 'library',
    title: '封面墙',
    body: '点一张封面进入歌单或推荐。没登录时也可以先去搜索听歌。',
  },
  {
    id: 'dock',
    scene: 'home',
    target: 'dock',
    requireTrack: true,
    title: '底部播放条',
    body: '播放后这里会出现控制条：显示当前歌词，点它就能回到全屏歌词舞台。',
  },
  {
    id: 'stage',
    scene: 'player',
    target: 'stage',
    requireTrack: true,
    title: '歌词舞台',
    body: '歌词会跟着进度走。点空白处可以隐藏底栏和侧栏，再点一次就会回来。',
  },
  {
    id: 'player-back',
    scene: 'player',
    target: 'player-back',
    requireTrack: true,
    title: '返回首页',
    body: '舞台左下角返回首页。歌曲会继续在后台播，底栏也不会消失。',
  },
  {
    id: 'player-panel',
    scene: 'player',
    target: 'player-panel',
    requireTrack: true,
    title: '正在播放',
    body: '打开右侧卡片，可以看歌词、队列和评论，也能改歌词样式、舞台背景和音质。',
  },
  {
    id: 'now-playing',
    scene: 'player',
    target: 'now-playing',
    requireTrack: true,
    openPanel: true,
    title: '侧栏功能',
    body: '「歌词样式」和「舞台背景」改视觉效果；匹配歌词能换更准的逐字版；评论页看热评。',
  },
  {
    id: 'player-dock',
    scene: 'player',
    target: 'dock',
    requireTrack: true,
    title: '播放控制',
    body: '播放 / 暂停、上一首下一首、循环模式，以及拖动进度，都在这条胶囊上。',
  },
  {
    id: 'done',
    scene: 'home',
    title: '可以开始听了',
    body: '登录同步歌单，或直接搜索一首歌。之后想再看引导，打开设置 → 外观即可。',
  },
];

export function visibleOnboardingSteps(options: {
  loggedIn: boolean;
  hasTrack: boolean;
}): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => {
    if (step.requireLogin && !options.loggedIn) return false;
    if (step.requireTrack && !options.hasTrack) return false;
    if (step.scene === 'player' && !options.hasTrack) return false;
    return true;
  });
}
