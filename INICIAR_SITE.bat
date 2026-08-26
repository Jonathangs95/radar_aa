@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js/npm nao foi encontrado no computador.
  echo Abra o README.md para orientacoes.
  pause
  exit /b 1
)
echo.
echo Iniciando pelo script oficial do projeto...
echo.
npm.cmd run dev
pause
