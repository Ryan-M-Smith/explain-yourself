#!/bin/bash

mkdir -p wavs

for file in *.mp3; do
    [ -f "$file" ] || continue
    [[ "$file" == *.wav ]] && continue

    name="${file%.*}"

    ffmpeg -hide_banner -loglevel warning \
        -i "$file" \
        -map_metadata 0 \
        -c:a pcm_s16le \
        "wavs/${name}.wav" \
	-y
done

