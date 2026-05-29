@echo off
cd /d "%~dp0"
echo === Mise a jour du quiz ===
git add .
git commit -m "Ajout CAPI server-side pour deduplication Pixel + serveur"
git push origin main
echo.
echo === TERMINE! ===
pause
