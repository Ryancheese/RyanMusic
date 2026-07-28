# RyanMusic Windows 打包脚本
# 用法（在仓库根目录或 windows 目录）：
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WinDir = Join-Path $Root "windows"
$DistDir = Join-Path $Root "dist\RyanMusic-win"
$MusicSrc = Join-Path $Root "maicong-music"
$Csproj = Join-Path $WinDir "RyanMusic.csproj"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  Write-Error "未找到 dotnet。请安装 .NET 8 SDK：https://dotnet.microsoft.com/download"
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
  dotnet publish $Csproj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $DistDir
} finally {
  Pop-Location
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
