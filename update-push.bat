@echo off
cd /d "%~dp0"
echo === Mise a jour du quiz ===
git add .
git commit -m "Ajout Microsoft Clarity pour session recording + heatmaps"
git push origin main
echo.
echo === TERMINE! ===
pause
