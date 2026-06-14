@echo off
set DATABASE_URL=postgresql://postgres:password@localhost:5432/seo_admin
set PORT=5000
set NODE_ENV=development
set SESSION_SECRET=seo-admin-secret-dev
"C:\Program download\nodejs\node.exe" --enable-source-maps C:\DEV\Admin-Panel\backend\dist\index.mjs
