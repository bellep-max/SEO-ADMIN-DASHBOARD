@echo off
set PORT=3000
set BASE_PATH=/
set API_PORT=5000
set NODE_ENV=development
cd /d "C:\DEV\Admin-Panel\frontend"
"C:\Program download\nodejs\node.exe" "C:\DEV\Admin-Panel\node_modules\.pnpm\vite@7.3.3_@types+node@25.6_ae3e33f3fe335111b5390f6db5b643d9\node_modules\vite\bin\vite.js" --host 0.0.0.0
