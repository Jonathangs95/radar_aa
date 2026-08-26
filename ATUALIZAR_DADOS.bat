@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js/npm nao foi encontrado.
  echo Instale o Node.js 20+ ou execute manualmente: python scripts\build_data.py
  pause
  exit /b 1
)
echo Atualizando dados pelo script oficial do projeto...
npm.cmd run data:update
if %errorlevel% neq 0 goto erro
echo.
echo Dados atualizados. Para iniciar, use: npm run dev
pause
exit /b 0
:erro
echo.
echo Ocorreu um erro. Verifique a mensagem acima.
pause
exit /b 1
