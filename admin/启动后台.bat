@echo off
rem OC 照片日记 - 本地管理后台启动器
cd /d %~dp0\..
where node >nul 2>nul
if errorlevel 1 (
  echo [admin] 未找到 node 命令,请先安装 Node.js 并把 node 加入 PATH。
  pause
  exit /b 1
)
node admin\server.mjs
pause
