@echo off
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)
start "" http://localhost:5173
npm run dev
pause
