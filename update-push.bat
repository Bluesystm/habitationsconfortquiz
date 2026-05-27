@echo off
cd /d "%~dp0"
echo === Mise a jour du quiz ===
git add .
git commit -m "Fix image references casse + Pixel Meta"
git push origin main
echo.
echo === TERMINE! ===
pause
