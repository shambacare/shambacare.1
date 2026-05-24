@echo off
echo ====================================
echo   ShambaCare Deployment Helper
echo ====================================
echo.
echo Choose deployment target:
echo 1. Deploy to Vercel (Frontend + Node.js API)
echo 2. Deploy to Render (Python AI Service)
echo 3. Deploy to Both
echo 4. Exit
echo.
set /p choice="Enter choice (1-4): "

if "%%choice%%"=="1" goto vercel
if "%%choice%%"=="2" goto render
if "%%choice%%"=="3" goto both
if "%%choice%%"=="4" goto end

:vercel
echo.
echo Deploying to Vercel...
echo Make sure you have installed Vercel CLI: npm i -g vercel
cd backend-api
vercel --prod
cd ..
goto end

:render
echo.
echo Deploying to Render...
echo 1. Go to https://render.com
echo 2. Click "New +" -
echo 3. Connect your GitHub repository
echo 4. Set Root Directory to: python-ai
echo 5. Set Build Command: pip install -r requirements.txt
echo 6. Set Start Command: gunicorn app_tf:app
echo 7. Add environment variables:
echo    - DATABASE_URL=your-neon-url
echo    - PORT=10000
echo.
pause
goto end

:both
echo Deploying to both platforms...
call :vercel
call :render
goto end

:end
echo.
echo Deployment process initiated!
pause
