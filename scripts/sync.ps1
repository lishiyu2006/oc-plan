# content/ 自动同步启动器(Windows 双击可用)
# 默认每 10 分钟检查一次;如需修改间隔,可编辑本文件在末尾追加: --interval 5
$ErrorActionPreference = 'Continue'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host '[sync] 未找到 node 命令,请先安装 Node.js 并把 node 加入 PATH。' -ForegroundColor Red
    pause
    exit 1
}

Set-Location $projectRoot
node "$scriptDir\sync.mjs" @args
pause
