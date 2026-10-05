@echo off
chcp 65001 >nul
setlocal

pushd "%~dp0"

echo =========================================
echo    INICIANDO SITE DO HOTEL
echo =========================================
echo.

set "URL=http://localhost:8080/"

:: Verifica se o servidor ja responde
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% == 0 (
    echo Site ja esta rodando. Abrindo navegador...
    start "" "%URL%"
    popd
    exit /b
)

:: Verifica se o Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org
    echo.
    pause
    popd
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Instalando dependencias. Pode demorar na primeira vez...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        popd
        exit /b 1
    )
) else (
    echo [1/2] Dependencias ja instaladas.
)

echo [2/2] Iniciando servidor...
start /min "Servidor Hotel" cmd /c "npm run dev"

echo.
echo Aguardando servidor ficar pronto...
set /a tentativas=0
:esperar
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% == 0 goto pronto
set /a tentativas+=1
if %tentativas% geq 60 (
    echo.
    echo [ERRO] Servidor nao respondeu em 60 segundos.
    echo Veja a janela "Servidor Hotel" para detalhes do erro.
    pause
    popd
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto esperar

:pronto
echo Abrindo navegador...
start "" "%URL%"

echo.
echo Site iniciado em %URL%
echo Para parar o servidor, feche a janela "Servidor Hotel".
popd
endlocal
