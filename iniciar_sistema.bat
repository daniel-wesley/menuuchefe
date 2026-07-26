@echo off
title Iniciando Sistema do Restaurante...
cd /d "%~dp0"

echo ======================================================
echo 🚀 INICIANDO SISTEMA DE RESTAURANTE LOCAL
echo ======================================================
echo.

:: Verifica se a pasta node_modules existe na raiz. Se nao existir, roda o setup.
if not exist "node_modules" (
    echo [INFO] Primeira execucao detectada neste computador.
    echo [INFO] Instalando dependencias do sistema... Isso pode levar alguns minutos...
    call npm run setup-all
    if %errorlevel% neq 0 (
        echo [ERRO] Ocorreu um problema ao instalar as dependencias.
        echo Certifique-se de que o Node.js esta instalado corretamente e voce tem acesso a internet nesta primeira execucao.
        pause
        exit /b
    )
)

echo [INFO] Dependencias verificadas com sucesso!
echo [INFO] Iniciando o servidor backend e frontend em segundo plano...
echo.

:: Abre o navegador no endereço padrão do frontend após um pequeno delay
start "" http://localhost:5173

:: Executa o comando de desenvolvimento do projeto
call npm run dev

pause
