@echo off
cd /d "%~dp0"
echo === Initialisation du repo Git ===
git init
git checkout -b main
git add .
git commit -m "Quiz isolation entretoit - Habitations Confort"
git remote add origin https://github.com/Bluesystm/habitationsconfortquiz.git
echo === Push vers GitHub ===
git push -u origin main
echo.
echo === TERMINE! Le code est sur GitHub ===
echo Tu peux fermer cette fenetre.
pause
