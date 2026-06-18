@echo off
REM ===================================================
REM  部署到 Obsidian Dev 插件目录
REM  用法: 双击运行, 或在终端执行 deploy.bat
REM ===================================================

set DEV_DIR=D:\工具\笔记工具\ObsidianRepository\repository\.obsidian\plugins\vault-lens-dev

echo 正在构建 Vault Lens Dev ...
call npm run build
if %errorlevel% neq 0 (
    echo 构建失败！
    pause
    exit /b 1
)

echo 正在部署到 %DEV_DIR% ...
copy /y main.js "%DEV_DIR%\main.js"
copy /y styles.css "%DEV_DIR%\styles.css"
REM 注意: 不复制 manifest.json，dev 目录有独立 id=vault-lens-dev

echo 完成！重启 Obsidian 后生效。
pause
