; RyanMusic Windows 安装向导（Inno Setup 6）
; 由 windows/build-app.ps1 调用 ISCC 编译

#ifndef AppVersion
  #define AppVersion "1.8.67"
#endif

#ifndef DistDir
  #define DistDir "..\dist\RyanMusic-win"
#endif

#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

#define MyAppName "RyanMusic"
#define MyAppPublisher "RyanMusic"
#define MyAppURL "https://github.com/Ryancheese/RyanMusic-Releases"
#define MyAppExeName "RyanMusic.exe"

[Setup]
AppId={{A7C2E9B1-4F58-4D3A-9C6E-2B8D1F0A5E73}
AppName={#MyAppName}
AppVersion={#AppVersion}
AppVerName={#MyAppName} {#AppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
; 每用户安装，避免 Program Files 无写权限导致 WebView2/缓存启动失败
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
InfoBeforeFile=
OutputDir={#OutputDir}
OutputBaseFilename=RyanMusic-Setup-x64
SetupIconFile=AppIcon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes
RestartApplications=no
AllowNoIcons=yes
ChangesAssociations=no
ShowLanguageDialog=no
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#AppVersion}

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标:"; Flags: checkedonce

[Files]
Source: "{#DistDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\maicong-music\core\cache"
Type: filesandordirs; Name: "{localappdata}\RyanMusic\WebView2"
Type: filesandordirs; Name: "{localappdata}\RyanMusic\cache"
Type: filesandordirs; Name: "{localappdata}\RyanMusic\php"

[Messages]
chinesesimp.WelcomeLabel1=欢迎使用 [name] 安装向导
chinesesimp.WelcomeLabel2=这将在你的电脑上安装 [name/ver]。%n%n建议在继续前关闭其他应用程序。%n%n点击「下一步」继续。
chinesesimp.FinishedLabel=完成 [name] 安装向导。%n%n可从开始菜单或桌面快捷方式启动。
