param(
    [switch]$InstallDeps,
    [switch]$UseClassicVenv
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$venvName = ".venv-lstm"
if ($UseClassicVenv) {
    $venvName = ".venv"
}

$venvActivate = Join-Path $projectRoot "$venvName\Scripts\Activate.ps1"
$venvPython = Join-Path $projectRoot "$venvName\Scripts\python.exe"

if (!(Test-Path $venvActivate)) {
    if ($venvName -eq ".venv-lstm") {
        Write-Host "Creating Python 3.12 LSTM environment..."
        py -3.12 -m venv $venvName
    } else {
        Write-Host "Creating classic virtual environment..."
        python -m venv $venvName
    }
}

if ($InstallDeps) {
    Write-Host "Installing backend dependencies in $venvName..."
    & $venvPython -m pip install --upgrade pip

    if ($venvName -eq ".venv-lstm") {
        & $venvPython -m pip install tensorflow==2.16.2 tf-keras==2.16.0 mediapipe==0.10.14 opencv-python==4.10.0.84 opencv-contrib-python==4.10.0.84 fastapi uvicorn python-multipart httpx
    } else {
        & $venvPython -m pip install fastapi uvicorn python-multipart numpy opencv-python mediapipe httpx
    }
}

$backendCmd = "& '$venvActivate'; `$env:TF_USE_LEGACY_KERAS='1'; uvicorn app.main:app --reload --port 8000"
$frontendCmd = "npm run dev"

Write-Host "Starting backend on http://127.0.0.1:8000"
Start-Process powershell -WorkingDirectory $projectRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $backendCmd
)

Write-Host "Starting frontend on http://localhost:5173"
Start-Process powershell -WorkingDirectory $projectRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $frontendCmd
)

Write-Host "Signly started. Keep both terminal windows open."
