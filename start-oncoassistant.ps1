# OncoAssistant - Запуск приложения
# Запустите этот скрипт: .\start-oncoassistant.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Цвета для консоли
$colors = @{
  Success = "Green"
  Error   = "Red"
  Warning = "Yellow"
  Info    = "Cyan"
}

function Write-Status {
  param(
    [string]$Message,
    [string]$Type = "Info"
  )
  $symbol = switch ($Type) {
    "Success" { "[+]" }
    "Error"   { "[X]" }
    "Warning" { "[!]" }
    "Info"    { "[*]" }
    default   { "[.]" }
  }
  Write-Host "$symbol " -ForegroundColor $colors[$Type] -NoNewline
  Write-Host $Message
}

# Заголовок
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   OncoAssistant - Запуск системы" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переход в директорию скрипта
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Проверка Node.js
Write-Status "Проверяю Node.js..." "Info"
try {
  $nodeVersion = node -v
  Write-Status "Node.js найден: $nodeVersion" "Success"
} catch {
  Write-Status "Node.js не найден!" "Error"
  Write-Host ""
  Write-Host "Необходимо установить Node.js версии 20 или выше."
  Write-Host "Загрузить можно здесь: https://nodejs.org/"
  Write-Host ""
  Read-Host "Нажмите Enter для выхода"
  exit 1
}

# Проверка и установка зависимостей
Write-Host ""
if (-not (Test-Path "node_modules")) {
  Write-Status "Первый запуск - устанавливаю зависимости npm..." "Info"
  Write-Host ""
  
  & npm install
  
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Status "Не удалось установить зависимости!" "Error"
    Write-Host ""
    Read-Host "Нажмите Enter для выхода"
    exit 1
  }
  
  Write-Host ""
  Write-Status "Зависимости установлены успешно" "Success"
} else {
  Write-Status "Зависимости уже установлены" "Success"
}

# Проверка портов
Write-Host ""
Write-Status "Проверяю доступность портов..." "Info"
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
  Write-Status "Порт 3000 уже используется! Возможно, приложение уже запущено." "Warning"
}

# Запуск
Write-Host ""
Write-Status "Запускаю сервер..." "Info"
Write-Host ""
Write-Host "Браузер откроется автоматически на http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "--- Нажмите Ctrl+C для остановки сервера ---" -ForegroundColor Yellow
Write-Host ""

# Открытие браузера
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

# Запуск dev сервера
& npm run dev
