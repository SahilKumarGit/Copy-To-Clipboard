#!/usr/bin/env bash
# Scenario: user focuses a text box, presses Ctrl+Shift+V, picks an older history item, expects it pasted.
# APP_HAS_XDOTOOL=1 lets the app find xdotool on PATH (the test driver always uses /opt/driver/xdotool).
set -u
OUT=/out
mkdir -p "$OUT"
DRV=/opt/driver/xdotool
export DISPLAY=:99
export HOME=/tmp/home && mkdir -p "$HOME"

Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 &
sleep 1
openbox >/dev/null 2>&1 &
python3 /opt/e2e/paste_target.py &
sleep 1

APP_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
[ "${APP_HAS_XDOTOOL:-0}" = "1" ] && APP_PATH="/opt/driver:$APP_PATH"
echo "[e2e] app can see xdotool: ${APP_HAS_XDOTOOL:-0}"

# Two history entries: SECOND_ITEM is newest (top), FIRST_ITEM is the one we will pick
# (the app ignores whatever is already on the clipboard at startup, so copy both after it starts)
cd /app && PATH="$APP_PATH" dbus-launch ./node_modules/.bin/electron . --hidden --no-sandbox --disable-gpu >"$OUT/app.log" 2>&1 &
sleep 4
printf 'FIRST_ITEM' | xclip -selection clipboard
sleep 1.5
printf 'SECOND_ITEM' | xclip -selection clipboard
sleep 1.5

# Focus the text box like a user clicking into a browser input
$DRV search --name PasteTarget windowactivate --sync mousemove --window %1 250 40 click 1
sleep 0.5
echo "[e2e] focused window before hotkey: $($DRV getactivewindow getwindowname)"

$DRV key ctrl+shift+v
sleep 1.5
echo "[e2e] focused window after hotkey:  $($DRV getactivewindow getwindowname)"
import -window root "$OUT/1-hud-open.png"

$DRV key Down
sleep 0.3
$DRV key Return
sleep 1.5
echo "[e2e] focused window after paste:   $($DRV getactivewindow getwindowname)"
import -window root "$OUT/2-after-paste.png"

RESULT="$(cat /tmp/target.txt)"
echo "[e2e] text box contains: '$RESULT'"
CLIP="$(xclip -selection clipboard -o 2>/dev/null)"
echo "[e2e] clipboard contains: '$CLIP'"
if [ "$RESULT" = "FIRST_ITEM" ]; then echo "[e2e] RESULT: PASS"; else echo "[e2e] RESULT: FAIL"; fi
grep -E "PasteInjector|HUD|Error" "$OUT/app.log" | head -10
