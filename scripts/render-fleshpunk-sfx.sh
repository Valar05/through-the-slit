#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sources="$root/public/sfx/sources"
out="$root/public/sfx/processed"
mkdir -p "$out"

skin="$sources/cc0-skin-impact-235335-hq.mp3"
gore="$sources/cc0-gore-splat-414296-hq.mp3"
wet="$sources/cc0-cartoon-splat-445117-hq.mp3"
blast="$sources/public-domain-explosion-LS100155.ogg"

render_concussion() {
  local name="$1" skin_start="$2" gore_pitch="$3" wet_pitch="$4" blast_gain="$5"
  ffmpeg -hide_banner -loglevel error -y \
    -ss "$skin_start" -t 0.48 -i "$skin" \
    -t 0.78 -i "$gore" \
    -t 0.62 -i "$wet" \
    -t 1.05 -i "$blast" \
    -filter_complex "\
      [0:a]highpass=f=95,lowpass=f=5200,volume=1.05,afade=t=out:st=0.29:d=0.16[contact];\
      [1:a]rubberband=pitch=${gore_pitch},highpass=f=70,lowpass=f=1900,volume=0.48,adelay=18|18,afade=t=out:st=0.48:d=0.25[deform];\
      [2:a]rubberband=pitch=${wet_pitch},highpass=f=180,lowpass=f=3600,volume=0.23,adelay=46|46,afade=t=out:st=0.31:d=0.22[wet];\
      [3:a]highpass=f=28,lowpass=f=760,volume=${blast_gain},adelay=24|24,afade=t=out:st=0.55:d=0.42[pressure];\
      [contact][deform][wet][pressure]amix=inputs=4:normalize=0,acompressor=threshold=0.18:ratio=2.4:attack=4:release=160:knee=3:makeup=1,volume=2.15,alimiter=limit=0.84:attack=5:release=80:level=disabled,atrim=0:1.05,afade=t=out:st=0.82:d=0.2[out]" \
    -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/$name.ogg"
}

render_concussion organic-concussion-a 17.02 0.76 0.72 0.58
render_concussion organic-concussion-b 24.34 0.69 0.81 0.52
render_concussion organic-concussion-c 37.10 0.84 0.66 0.62

ffmpeg -hide_banner -loglevel error -y \
  -t 1.2 -i "$gore" -t 0.62 -i "$wet" \
  -filter_complex "[0:a]rubberband=pitch=0.72,highpass=f=80,lowpass=f=2200,volume=0.72,afade=t=out:st=0.62:d=0.35[g];[1:a]rubberband=pitch=0.66,highpass=f=210,lowpass=f=3900,volume=0.32,adelay=24|24,afade=t=out:st=0.31:d=0.22[w];[g][w]amix=inputs=2:normalize=0,volume=1.35,alimiter=limit=0.82:attack=5:release=70:level=disabled,atrim=0:0.96[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/rupture-wet-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.25 -i "$blast" -t 1.1 -i "$gore" \
  -filter_complex "[0:a]highpass=f=24,lowpass=f=1650,volume=0.92,afade=t=out:st=0.72:d=0.48[b];[1:a]rubberband=pitch=0.61,highpass=f=60,lowpass=f=1150,volume=0.35,adelay=95|95,afade=t=out:st=0.68:d=0.34[g];[b][g]amix=inputs=2:normalize=0,acompressor=threshold=0.2:ratio=2:attack=6:release=220:knee=4:makeup=1,alimiter=limit=0.84:attack=5:release=100:level=disabled,atrim=0:1.22[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/artillery-organic-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.25 -i "$gore" -t 0.62 -i "$wet" \
  -filter_complex "[0:a]areverse,rubberband=pitch=0.58,lowpass=f=1350,volume=0.54,afade=t=in:d=0.18,afade=t=out:st=0.72:d=0.28[g];[1:a]rubberband=pitch=0.74,highpass=f=150,lowpass=f=3000,volume=0.28,adelay=170|170,afade=t=out:st=0.42:d=0.2[w];[g][w]amix=inputs=2:normalize=0,volume=2.3,alimiter=limit=0.8:attack=5:release=90:level=disabled,atrim=0:1.02[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/graft-birth-a.ogg"

# The unified-material pass below replaces bare oscillator cues with recorded
# contact, tendon, pressure, scute, breath, and viscera bodies. Pitch is carried
# by resonant donor material rather than by exposed electronic tones.
render_membrane_shot() {
  local name="$1" skin_start="$2" rate="$3" body_pitch="$4"
  ffmpeg -hide_banner -loglevel error -y \
    -ss "$skin_start" -t 0.23 -i "$skin" -t 0.42 -i "$wet" \
    -filter_complex "[0:a]atempo=${rate},highpass=f=480,lowpass=f=5600,volume=1.2,afade=t=out:st=0.09:d=0.1[c];[1:a]rubberband=pitch=${body_pitch},highpass=f=120,lowpass=f=1250,volume=0.28,adelay=8|8,afade=t=out:st=0.19:d=0.16[b];[c][b]amix=inputs=2:normalize=0,volume=4.0,alimiter=limit=0.79:attack=3:release=50:level=disabled,atrim=0:0.34[out]" \
    -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/$name.ogg"
}

render_membrane_shot membrane-shot-a 6.18 1.18 0.78
render_membrane_shot membrane-shot-b 12.72 0.96 0.91
render_membrane_shot membrane-shot-c 29.44 1.31 0.68

ffmpeg -hide_banner -loglevel error -y \
  -ss 18.34 -t 0.5 -i "$skin" -t 0.5 -i "$wet" \
  -filter_complex "[0:a]highpass=f=700,lowpass=f=7200,volume=1.05,afade=t=out:st=0.16:d=0.2[s];[1:a]areverse,rubberband=pitch=1.28,highpass=f=340,lowpass=f=4100,volume=0.32,afade=t=out:st=0.19:d=0.16[t];[s][t]amix=inputs=2:normalize=0,volume=5.0,alimiter=limit=0.76:attack=3:release=45:level=disabled,atrim=0:0.42[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/tendon-snap-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -ss 31.08 -t 0.7 -i "$skin" -t 0.45 -i "$gore" \
  -filter_complex "[0:a]highpass=f=520,lowpass=f=5200,volume=1.25,afade=t=out:st=0.31:d=0.24[s];[1:a]rubberband=pitch=0.63,lowpass=f=880,volume=0.42,adelay=18|18,afade=t=out:st=0.28:d=0.14[g];[s][g]amix=inputs=2:normalize=0,volume=1.7,alimiter=limit=0.82:attack=4:release=70:level=disabled,atrim=0:0.61[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/scute-impact-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -ss 41.12 -t 0.95 -i "$skin" -t 0.8 -i "$blast" -t 0.7 -i "$gore" \
  -filter_complex "[0:a]highpass=f=170,lowpass=f=3800,volume=1.0,afade=t=out:st=0.42:d=0.34[c];[1:a]lowpass=f=690,volume=0.56,adelay=10|10,afade=t=out:st=0.53:d=0.34[p];[2:a]rubberband=pitch=0.57,lowpass=f=1050,volume=0.31,adelay=62|62,afade=t=out:st=0.38:d=0.22[g];[c][p][g]amix=inputs=3:normalize=0,acompressor=threshold=0.2:ratio=2.2:attack=4:release=150:knee=3:makeup=1,volume=1.4,alimiter=limit=0.83:attack=5:release=90:level=disabled,atrim=0:0.88[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/rib-mortar-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.25 -i "$gore" -t 0.62 -i "$wet" \
  -filter_complex "[0:a]areverse,rubberband=pitch=0.64,highpass=f=85,lowpass=f=1650,atempo=0.72,volume=0.5,afade=t=in:d=0.24,afade=t=out:st=0.96:d=0.38[g];[1:a]areverse,rubberband=pitch=0.82,highpass=f=240,lowpass=f=2800,atempo=0.68,volume=0.27,adelay=120|120,afade=t=in:d=0.18,afade=t=out:st=0.7:d=0.28[w];[g][w]amix=inputs=2:normalize=0,volume=1.55,alimiter=limit=0.72:attack=8:release=120:level=disabled,atrim=0:1.34[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/toxic-exhale-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.2 -i "$blast" -t 0.9 -i "$gore" \
  -filter_complex "[0:a]areverse,highpass=f=260,lowpass=f=3900,atempo=0.78,volume=0.42,afade=t=in:d=0.08,afade=t=out:st=0.92:d=0.42[p];[1:a]areverse,rubberband=pitch=1.34,highpass=f=520,lowpass=f=4300,atempo=0.84,volume=0.24,adelay=210|210,afade=t=in:d=0.12,afade=t=out:st=0.68:d=0.3[g];[p][g]amix=inputs=2:normalize=0,alimiter=limit=0.68:attack=8:release=110:level=disabled,atrim=0:1.36[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/artillery-incoming-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -ss 22.65 -t 1.0 -i "$skin" -t 0.8 -i "$wet" \
  -filter_complex "[0:a]areverse,highpass=f=900,lowpass=f=6900,volume=0.55,afade=t=in:d=0.16,afade=t=out:st=0.56:d=0.34[f];[1:a]areverse,rubberband=pitch=1.12,highpass=f=310,lowpass=f=3200,volume=0.22,adelay=140|140,afade=t=out:st=0.44:d=0.3[w];[f][w]amix=inputs=2:normalize=0,volume=5.5,alimiter=limit=0.67:attack=6:release=75:level=disabled,atrim=0:0.92[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/artillery-flare-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.1 -i "$gore" -t 0.8 -i "$blast" \
  -filter_complex "[0:a]areverse,rubberband=pitch=0.54,lowpass=f=1050,atempo=0.72,volume=0.5,afade=t=in:d=0.2,afade=t=out:st=0.82:d=0.4[g];[1:a]lowpass=f=520,volume=0.25,adelay=360|360,afade=t=in:d=0.08,afade=t=out:st=0.62:d=0.3[p];[g][p]amix=inputs=2:normalize=0,volume=2.1,alimiter=limit=0.72:attack=7:release=100:level=disabled,atrim=0:1.25[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/ground-capture-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.25 -i "$gore" -t 1.25 -i "$blast" -t 0.62 -i "$wet" \
  -filter_complex "[0:a]rubberband=pitch=0.47,lowpass=f=980,atempo=0.58,volume=0.55,afade=t=out:st=1.45:d=0.7[g];[1:a]lowpass=f=430,atempo=0.72,volume=0.42,adelay=110|110,afade=t=out:st=1.3:d=0.62[p];[2:a]rubberband=pitch=0.58,lowpass=f=1500,atempo=0.7,volume=0.24,adelay=520|520,afade=t=out:st=0.94:d=0.33[w];[g][p][w]amix=inputs=3:normalize=0,acompressor=threshold=0.18:ratio=2.4:attack=8:release=240:knee=4:makeup=1,volume=1.35,alimiter=limit=0.82:attack=7:release=130:level=disabled,atrim=0:2.08,afade=t=out:st=1.62:d=0.42[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/death-collapse-a.ogg"

ffmpeg -hide_banner -loglevel error -y \
  -t 1.05 -i "$gore" -t 0.85 -i "$blast" \
  -filter_complex "[0:a]areverse,rubberband=pitch=0.6,lowpass=f=1250,atempo=0.76,volume=0.42,afade=t=in:d=0.28,afade=t=out:st=0.88:d=0.34[g];[1:a]lowpass=f=540,volume=0.29,adelay=390|390,afade=t=in:d=0.06,afade=t=out:st=0.7:d=0.28[p];[g][p]amix=inputs=2:normalize=0,volume=2.5,alimiter=limit=0.69:attack=8:release=110:level=disabled,atrim=0:1.3[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$out/wake-organ-a.ogg"

sha256sum "$out"/*.ogg
