# RyanMusic Windows 打包脚本
# 用法（在仓库根目录或 windows 目录）：
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WinDir = Join-Path $Root "windows"
$DistDir = Join-Path $Root "dist\RyanMusic-win"
$MusicSrc = Join-Path $Root "maicong-music"
$Csproj = Join-Path $WinDir "RyanMusic.csproj"

# 刷新 PATH，避免刚装完 SDK 找不到
$machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$user = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machine;$user;${env:ProgramFiles}\dotnet;${env:ProgramFiles(x86)}\dotnet"

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
  Write-Error "未找到 dotnet。请安装 .NET 8 SDK：https://dotnet.microsoft.com/download"
}

$sdks = & dotnet --list-sdks 2>$null
if (-not $sdks -or -not ($sdks | Where-Object { $_ -match '^\d+\.\d+\.\d+' })) {
  Write-Error "未找到 .NET SDK（仅有 runtime 无法编译）。请执行：winget install --id Microsoft.DotNet.SDK.8 -e"
}

if (-not (Test-Path $Csproj)) {
  Write-Error "找不到 $Csproj"
}

if (-not (Test-Path $MusicSrc)) {
  Write-Error "找不到 $MusicSrc"
}

Write-Host "==> 清理旧包"
if (Test-Path $DistDir) {
  Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path $DistDir | Out-Null

Write-Host "==> 发布自包含可执行文件 (win-x64)"
Push-Location $WinDir
try {
  & dotnet publish $Csproj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $DistDir
  if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish 失败 (exit=$LASTEXITCODE)"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $DistDir "RyanMusic.exe"))) {
  Write-Error "发布完成但未找到 RyanMusic.exe"
}

Write-Host "==> 复制站点文件"
$MusicDst = Join-Path $DistDir "maicong-music"
robocopy $MusicSrc $MusicDst /E /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD .git core\cache node_modules `
  /XF .DS_Store | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Error "复制站点文件失败 (robocopy=$LASTEXITCODE)"
}
New-Item -ItemType Directory -Force -Path (Join-Path $MusicDst "core\cache") | Out-Null

Write-Host ""
Write-Host "已生成：$DistDir"
Write-Host "运行：$DistDir\RyanMusic.exe"
