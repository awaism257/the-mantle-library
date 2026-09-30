#!/usr/bin/env python3
"""
The Mantle Library — Historic Audio Remastering Script
Cleans up 78 RPM shellac recordings (1901–1921) using FFmpeg:
  1. Highpass filter to eliminate turntable/motor rumble (sub-70 Hz)
  2. Lowpass filter to eliminate out-of-band needle friction hiss (> 6.5 kHz)
  3. De-clicker (adeclick) to remove vinyl clicks, ticks, and pops
  4. Spectral FFT denoiser (afftdn) to reduce constant surface hiss
  5. Parametric EQ to restore vocal warmth, presence, and intelligibility
  6. EBU R128 loudness normalization (loudnorm) for balanced playback
"""

import os
import sys
import subprocess
import shutil

AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'audio')
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'audio_originals')

FILTER_CHAIN = (
    "highpass=f=70,"
    "lowpass=f=6500,"
    "adeclick,"
    "afftdn=nr=14:nf=-38,"
    "equalizer=f=1400:t=q:w=1.2:g=2.5,"
    "equalizer=f=3000:t=q:w=1.5:g=1.5,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)

def remaster_all():
    if not os.path.exists(BACKUP_DIR):
        print(f"Creating backup directory: {BACKUP_DIR}")
        os.makedirs(BACKUP_DIR, exist_ok=True)
        for f in os.listdir(AUDIO_DIR):
            if f.endswith('.mp3'):
                shutil.copy2(os.path.join(AUDIO_DIR, f), os.path.join(BACKUP_DIR, f))

    mp3_files = sorted([f for f in os.listdir(AUDIO_DIR) if f.endswith('.mp3')])
    print(f"Found {len(mp3_files)} audio files to remaster.\n")

    for idx, filename in enumerate(mp3_files, 1):
        src_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(src_path):
            src_path = os.path.join(AUDIO_DIR, filename)

        out_path = os.path.join(AUDIO_DIR, filename)
        tmp_path = os.path.join(AUDIO_DIR, f"tmp_{filename}")

        print(f"[{idx}/{len(mp3_files)}] Remastering: {filename}...")
        cmd = [
            "ffmpeg", "-y", "-i", src_path,
            "-af", FILTER_CHAIN,
            "-c:a", "libmp3lame", "-b:a", "192k",
            tmp_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            os.replace(tmp_path, out_path)
            orig_size = os.path.getsize(src_path) // 1024
            new_size = os.path.getsize(out_path) // 1024
            print(f"  ✓ Success: {orig_size}KB -> {new_size}KB")
        else:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            print(f"  ✗ Error remastering {filename}: {res.stderr[:200]}")

    print("\nAll historic audio files remastered successfully!")

if __name__ == '__main__':
    remaster_all()
