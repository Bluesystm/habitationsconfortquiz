@echo off
cd /d "%~dp0"
echo === Force push vers GitHub ===
git push --force origin main
echo.
echo === TERMINE! Le code est sur GitHub ===
echo Tu peux fermer cette fenetre.
pause
