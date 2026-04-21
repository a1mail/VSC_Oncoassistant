$ErrorActionPreference = "Stop"

$AppDir = if ($env:APP_DIR) { $env:APP_DIR } else { "$HOME\VSC_Oncoassistant" }
$RepoUrl = if ($env:REPO_URL) { $env:REPO_URL } else { "https://github.com/a1mail/VSC_Oncoassistant.git" }
$Branch = if ($env:BRANCH) { $env:BRANCH } else { "main" }

if (-not (Test-Path "$AppDir\.git")) {
  git clone $RepoUrl $AppDir
}

Set-Location $AppDir
git fetch origin
git checkout $Branch
git pull --ff-only origin $Branch

docker compose pull
docker compose up -d --build
