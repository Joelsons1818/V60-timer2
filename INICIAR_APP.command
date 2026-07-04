#!/bin/bash
cd "$(dirname "$0")"

# 1. Limpeza: Mata qualquer servidor rodando na porta 4173 (evita erro de porta em uso)
lsof -ti:4173 | xargs kill -9 2>/dev/null

# 2. Inicia o servidor em background (nohup) para não depender do Terminal aberto
# O output é descartado (> /dev/null) para manter limpo
nohup npx vite preview --port 4173 > /dev/null 2>&1 &

# 3. Aguarda 2 segundos para garantir que o servidor subiu
sleep 2

# 4. Abre o navegador
open http://localhost:4173

# 5. Fecha a janela do Terminal
osascript -e 'tell application "Terminal" to close front window' & exit
