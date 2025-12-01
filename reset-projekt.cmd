@echo off
title React Native / Expo Projekt Reset
echo ============================================
echo   Projekt-Reset: Cache, node_modules, Lockfile
echo ============================================
echo.

REM 1) NPM Cache leeren
echo [1/5] NPM Cache wird geleert ...
npm cache clean --force
echo.

REM 2) node_modules löschen
echo [2/5] node_modules wird gelöscht (falls vorhanden) ...
IF EXIST node_modules (
  rmdir /S /Q node_modules
  echo   -> node_modules gelöscht.
) ELSE (
  echo   -> node_modules war nicht vorhanden.
)
echo.

REM 3) package-lock.json löschen
echo [3/5] package-lock.json wird gelöscht (falls vorhanden) ...
IF EXIST package-lock.json (
  del /F /Q package-lock.json
  echo   -> package-lock.json gelöscht.
) ELSE (
  echo   -> Keine package-lock.json gefunden.
)
echo.

REM 4) Expo-/Metro-Cache-Ordner aufräumen (.expo, .expo-shared)
echo [4/5] Expo Cache Ordner werden geprüft ...
IF EXIST .expo (
  rmdir /S /Q .expo
  echo   -> .expo gelöscht.
) ELSE (
  echo   -> .expo nicht vorhanden.
)

IF EXIST .expo-shared (
  rmdir /S /Q .expo-shared
  echo   -> .expo-shared gelöscht.
) ELSE (
  echo   -> .expo-shared nicht vorhanden.
)
echo.

REM 5) Pakete neu installieren
echo [5/5] npm install wird ausgeführt ...
npm install
echo.

echo ============================================
echo   Fertig! Du kannst jetzt z.B. starten mit:
echo   expo start -c
echo ============================================
echo.
pause
