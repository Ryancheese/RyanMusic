; RyanMusic Windows 安装向导（Inno Setup 6）
; 由 windows/build-app.ps1 调用 ISCC 编译

#ifndef AppVersion
  #define AppVersion "1.8.40"
#endif

#ifndef DistDir
  #define DistDir "..\dist\RyanMusic-win"
#endif

#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

#define MyAppName "RyanMusic"
#define MyAppPublisher "RyanMusic"
#define MyAppURL "https://github.com/Ryancheese/RyanMusic"
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
DefaultDirName={autopf}\{#MyAppName}
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
PrivilegesRequired=admin
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
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 仅清理安装目录内缓存，避免管理员安装模式下误改每用户目录
Type: filesandordirs; Name: "{app}\maicong-music\core\cache"

[Messages]
; 覆盖欢迎页文案（简体中文）
chinesesimp.WelcomeLabel1=欢迎使用 [name] 安装向导
chinesesimp.WelcomeLabel2=这将在你的电脑上安装 [name/ver]。%n%n建议在继续前关闭其他应用程序。%n%n点击「下一步」继续。
chinesesimp.FinishedLabel=完成 [name] 安装向导。%n%n可从开始菜单或桌面快捷方式启动。
