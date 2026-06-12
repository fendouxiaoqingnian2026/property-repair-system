@echo off
chcp 65001 >nul
title SmartProperty 智慧物业系统服务器
color 0A

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║    🏢 SmartProperty 智慧物业报修管理系统           ║
echo  ║    版本 v3.0  —  多端实时同步服务器               ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4"') do (
  set IP=%%a
  goto :found
)
:found
set IP=%IP: =%

echo  📡 启动服务器中...
echo.

REM 使用 WorkBuddy 内置 Node.js 启动
"C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe" "%~dp0server.js"

if errorlevel 1 (
  echo.
  echo  ❌ 启动失败！请确认 node_modules 目录存在
  echo  💡 解决方法：在当前目录运行 npm install
  pause
)
