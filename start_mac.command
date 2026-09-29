#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting Einbürgerungstest Trainer..."
python3 -c "import webbrowser, time; time.sleep(0.6); webbrowser.open('http://localhost:8000')" &
python3 -m http.server 8000
