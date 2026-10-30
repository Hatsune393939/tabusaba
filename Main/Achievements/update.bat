@echo off
rem Convert achievements YAML to JSON and push to GitHub.
rem Edit SRC below to the path of your achievements.yml
set "SRC=C:\Users\tnhm_\Desktop\Minigame V3\plugins\Skript\scripts\Skript\systems\achievements.yml"
set PYTHONUTF8=1
cd /d "%~dp0"

if not exist "%SRC%" (
  echo ERROR: achievements.yml not found: %SRC%
  echo Nothing was published.
  pause
  exit /b 1
)

rem Use Python 3.14 (has pyyaml installed). Fall back to plain python.
set "PY=py -3.14"
%PY% --version >nul 2>&1
if errorlevel 1 set "PY=python"

%PY% convert.py "%SRC%" -o data\achievements.json
if errorlevel 1 (
  echo.
  echo ERROR: convert failed. Nothing was published. See the message above.
  pause
  exit /b 1
)

git add data/achievements.json
if errorlevel 1 (
  echo ERROR: git add failed. Nothing was published.
  pause
  exit /b 1
)
git diff --cached --quiet
if not errorlevel 1 (
  echo no changes
  pause
  exit /b 0
)
git commit -m "update achievements"
if errorlevel 1 (
  echo ERROR: git commit failed. Nothing was published.
  pause
  exit /b 1
)
git push
if errorlevel 1 (
  echo.
  echo ERROR: git push failed. The site was NOT updated. Check network / login and run again.
  pause
  exit /b 1
)
echo.
echo OK: published.
pause
