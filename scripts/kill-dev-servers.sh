#!/bin/bash

# Kill dev servers script
# Kills all running dev servers (frontend on 3000/3001 and catalog server on 4545)

echo "Killing dev servers..."

# Kill processes on ports 3000, 3001, and 4545
lsof -ti:3000 -ti:3001 -ti:4545 2>/dev/null | xargs -r kill -9 2>/dev/null

# Kill any lingering Next.js processes
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null

# Kill any Node processes running the catalog server
pkill -9 -f "catalog-server" 2>/dev/null

echo "✓ Dev servers killed successfully"
