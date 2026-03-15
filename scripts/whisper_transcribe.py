#!/usr/bin/env python3
"""
Transcribe an audio file using local faster-whisper.
Usage: python3 whisper_transcribe.py <audio_file_path>
Output: transcription text on stdout
"""
import sys
import os
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")

def transcribe(audio_path: str) -> str:
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(
        audio_path,
        language="en",
        beam_size=5,
        temperature=0.0,
        no_speech_threshold=0.1,
        vad_filter=False,
        condition_on_previous_text=False,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: whisper_transcribe.py <audio_file>", file=sys.stderr)
        sys.exit(1)
    result = transcribe(sys.argv[1])
    print(result)
