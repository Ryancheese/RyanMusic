<?php
if (!defined('MC_CORE')) {
    header('Location: /');
    exit();
}
?>
<p>RyanMusic 支持搜索、试听、收藏与下载 <strong>网易云音乐</strong>、<strong>QQ 音乐</strong> 的歌曲。首次打开会弹出界面引导；之后可随时在本页底部重新查看。</p>

<h3 class="site-modal__h">一、搜索歌曲</h3>
<ul>
    <li><strong>按歌名 / 歌手</strong>：在顶部搜索框输入关键词，例如 <code>普通朋友 陶喆</code>，再点「搜索」。把歌名和歌手一起输入，匹配更准。</li>
    <li><strong>按音乐 ID</strong>：直接输入平台歌曲 ID（网易多为数字，QQ 多为字母数字组合）。</li>
    <li><strong>按歌曲链接</strong>：粘贴完整歌曲页地址，例如：
        <ul>
            <li>网易：<code>http://music.163.com/#/song?id=<b>150623</b></code></li>
            <li>QQ：<code>https://y.qq.com/n/yqq/song/<b>0044SaFh0apuR2</b>.html</code></li>
        </ul>
    </li>
    <li>搜索通常需要几秒到十几秒，下方进度条会显示已等待时间，请稍候。</li>
    <li>播放中点击<strong>歌名</strong>或<strong>歌手</strong>，可立刻用该关键词再搜一次。</li>
</ul>

<h3 class="site-modal__h">二、切换音源</h3>
<ul>
    <li>搜索框右侧的 <strong>网易 / QQ</strong> 按钮用于切换当前音源。</li>
    <li>切换后请重新搜索；两侧曲库并不完全相同，同一首歌可能只在其中一个平台能播。</li>
</ul>

<h3 class="site-modal__h">三、播放控制</h3>
<ul>
    <li>搜索成功后，中央播放器可播放 / 暂停、拖动进度、调节音量。</li>
    <li>若出现多首结果，可在播放列表中切换上一首 / 下一首。</li>
    <li>部分歌曲因版权、地区或上游限制可能无法播放，可换音源或换一首试试。</li>
    <li><strong>macOS</strong>：可用键盘媒体键、控制中心 / 灵动岛调节播放（走网页 Media Session）。</li>
    <li><strong>Windows</strong>：关闭窗口时可选择最小化到托盘，下次打开继续听。</li>
</ul>

<h3 class="site-modal__h">四、我的音乐（左侧）</h3>
<ul>
    <li><strong>喜欢</strong>：播放时点「喜欢」（红心）收藏；再点一次可取消。数据保存在本机浏览器存储中。</li>
    <li><strong>最近</strong>：自动记录最近播放过的歌曲，方便回听。</li>
    <li><strong>播放列表</strong>：点「加入播放列表」把当前曲目加入；也可从喜欢 / 最近列表用「＋」加入。</li>
    <li><strong>网易云</strong>：点右上角「同步网易云」登录账号后，可将「我喜欢」与自建/收藏歌单同步到本机侧栏；点播仍走 RyanMusic 播放，不打开官方 App。</li>
    <li><strong>QQ</strong>：点右上角「同步QQ」登录账号后，可将 QQ 音乐「我喜欢」与自建/收藏歌单同步到侧栏「QQ」分区；点播同样走 RyanMusic。</li>
    <li>顶部 <strong>全部 / 网易云 / QQ</strong> 可按音源筛选左侧列表（云端歌单页除外）。</li>
    <li>在列表中点歌即可播放；喜欢与最近支持移出 / 取消喜欢等快捷操作。</li>
    <li>从「喜欢」或「最近」点播时，会从该首起连续播放列表后续曲目。</li>
</ul>

<h3 class="site-modal__h">四（附）、同步网易云账号</h3>
<ul>
    <li><strong>扫码登录</strong>（推荐）：弹层中显示二维码，用手机网易云 App 扫码并确认。</li>
    <li><strong>Cookie 兜底</strong>：若扫码失败，可在浏览器登录 music.163.com，从开发者工具复制含 <code>MUSIC_U</code> 的 Cookie 粘贴保存。</li>
    <li>登录 Cookie <strong>只保存在本机</strong>（应用缓存目录），不会上传到 RyanMusic 服务器；点「退出登录」即删除。</li>
    <li>同步结果出现在侧栏「网易云」分区，<strong>不会覆盖</strong>本地「喜欢」列表。</li>
    <li>大歌单会截断到约 500 首以便播放；无版权 / VIP 曲目仍可能无法播放（与搜索单曲相同）。</li>
    <li>网易接口可能变更，导致扫码或同步暂时失败，届时可改用 Cookie 或稍后再试。</li>
</ul>

<h3 class="site-modal__h">四（附）、同步 QQ 音乐账号</h3>
<ul>
    <li><strong>扫码登录</strong>（推荐）：弹层中显示二维码，用手机 QQ / 微信扫码并确认。</li>
    <li><strong>Cookie 兜底</strong>：若扫码失败，可在浏览器登录 <code>y.qq.com</code>，从开发者工具复制含 <code>uin</code> 与 <code>qm_keyst</code> 的 Cookie 粘贴保存。</li>
    <li>登录 Cookie <strong>只保存在本机</strong>，不会上传；点「退出登录」即删除。</li>
    <li>同步结果出现在侧栏「QQ」分区，<strong>不会覆盖</strong>本地「喜欢」列表。</li>
    <li>大歌单同样约截断到 500 首；无版权 / VIP 曲目可能无法播放。</li>
</ul>

<h3 class="site-modal__h">五、下载歌曲与歌词</h3>
<ul>
    <li>开始播放后，播放器右上角会出现 <strong>下载歌曲</strong>、<strong>下载歌词</strong>。</li>
    <li>桌面端（Mac / Windows）会弹出系统「另存为」对话框，请选择保存位置。</li>
    <li>浏览器端则由浏览器下载策略决定；若失败，多为资源限制或网络问题。</li>
    <li>无歌词时会保存占位内容；有歌词时保存为文本（LRC 风格）。</li>
</ul>

<h3 class="site-modal__h">六、光影氛围</h3>
<ul>
    <li>点击右上角 <strong>RYANMUSIC</strong> Logo，展开光影面板。</li>
    <li><strong>亮度</strong>：背景光影强弱，调到 0% 可关闭光影。</li>
    <li><strong>律动</strong>：背景随音乐节拍晃动的幅度。</li>
    <li><strong>饱和度</strong>：主题色与背景取色的鲜艳程度（与律动无关）。</li>
    <li>播放时背景会随封面取色变化；设置会记住，下次打开仍生效。</li>
</ul>

<h3 class="site-modal__h">七、窗口与操作（桌面端）</h3>
<ul>
    <li><strong>macOS</strong>：空白处可拖动窗口；标题栏区域双击可缩放。支持系统粘贴（⌘V）。</li>
    <li><strong>Windows</strong>：支持托盘常驻；深色标题栏与主界面风格一致。</li>
    <li>页脚「帮助 / 声明 / 联系」可随时打开说明与免责声明。</li>
</ul>

<h3 class="site-modal__h">八、常见问题</h3>
<ul>
    <li><strong>搜不到 / 播不了</strong>：换音源、换关键词，或确认网络正常；版权曲目可能无可用音源。</li>
    <li><strong>开了 VPN 后异常</strong>：桌面端已尽量直连国内音源。若仍失败，可在 Clash / Surge 等客户端将 RyanMusic（或 php）设为直连，或暂时关闭 TUN。</li>
    <li><strong>搜索很慢</strong>：属正常现象（需向多个上游取链），请等待进度条结束。</li>
    <li><strong>喜欢的歌不见了</strong>：数据存在本机；清理站点数据、换浏览器或重装且未迁移数据会导致丢失。</li>
    <li><strong>想再看一遍引导</strong>：打开本帮助，点底部「重新查看使用引导」。</li>
</ul>

<p class="site-modal__note">仅供个人学习与试听，请支持正版。商用或批量下载等用途请自行遵守相关法律法规与平台条款。</p>
