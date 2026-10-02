#!/usr/bin/env python3
"""
⚡ VirgoX Native Input Daemon
Ultra-fast sub-millisecond mouse and keyboard driver for VirgoX Cloud PC
Uses direct X11 / XTest C-bindings without process-fork overhead
"""

import sys
import json
import time
import socket
import ctypes
import os

def daemonize():
    try:
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError as e:
        sys.exit(1)

    os.setsid()

    try:
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError as e:
        sys.exit(1)

    sys.stdout.flush()
    sys.stderr.flush()
    si = open(os.devnull, 'r')
    so = open('/tmp/input_daemon.log', 'a+')
    se = open('/tmp/input_daemon.log', 'a+')
    os.dup2(si.fileno(), sys.stdin.fileno())
    os.dup2(so.fileno(), sys.stdout.fileno())
    os.dup2(se.fileno(), sys.stderr.fileno())

if "--foreground" not in sys.argv:
    daemonize()

os.environ["DISPLAY"] = ":1"

try:
    x11 = ctypes.CDLL("libX11.so.6")
    xtst = ctypes.CDLL("libXtst.so.6")
except Exception as e:
    print(f"Failed to load X11 libraries: {e}", file=sys.stderr)
    sys.exit(1)

disp = x11.XOpenDisplay(b":1")
if not disp:
    print("Could not open X11 Display :1", file=sys.stderr)
    sys.exit(1)

def do_move(dx, dy):
    try:
        x11.XWarpPointer(disp, 0, 0, 0, 0, 0, 0, int(dx), int(dy))
        x11.XFlush(disp)
    except Exception as e:
        print("Move error:", e)

def do_click(button, is_double=False):
    btn = int(button)
    xtst.XTestFakeButtonEvent(disp, btn, 1, 0)
    x11.XFlush(disp)
    time.sleep(0.01)
    xtst.XTestFakeButtonEvent(disp, btn, 0, 0)
    x11.XFlush(disp)

    if is_double:
        time.sleep(0.04)
        xtst.XTestFakeButtonEvent(disp, btn, 1, 0)
        x11.XFlush(disp)
        time.sleep(0.01)
        xtst.XTestFakeButtonEvent(disp, btn, 0, 0)
        x11.XFlush(disp)

def do_drag(state):
    press = 1 if state == "down" else 0
    xtst.XTestFakeButtonEvent(disp, 1, press, 0)
    x11.XFlush(disp)

def do_scroll(direction, steps=1):
    btn = 4 if direction == "up" else 5
    for _ in range(max(1, min(10, int(steps)))):
        xtst.XTestFakeButtonEvent(disp, btn, 1, 0)
        x11.XFlush(disp)
        time.sleep(0.005)
        xtst.XTestFakeButtonEvent(disp, btn, 0, 0)
        x11.XFlush(disp)
        time.sleep(0.005)

def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", 9999))
    print("[*] VirgoX Native Input Daemon listening on UDP 0.0.0.0:9999...")

    while True:
        try:
            data, addr = sock.recvfrom(4096)
            if not data:
                continue
            msg = json.loads(data.decode("utf-8"))
            action = msg.get("action")

            if action == "move":
                do_move(msg.get("dx", 0), msg.get("dy", 0))
            elif action == "click":
                do_click(msg.get("button", 1), msg.get("double", False))
            elif action == "drag":
                do_drag(msg.get("state", "up"))
            elif action == "scroll":
                do_scroll(msg.get("direction", "down"), msg.get("steps", 1))
        except Exception:
            pass

if __name__ == "__main__":
    main()
