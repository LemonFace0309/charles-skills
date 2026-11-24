"""A raw take's audio on the file's own timeline.

His phone takes have holes in the audio's timestamps, in the pauses between lines (40-700 ms each, up to 1.25 s over a take). Decoding
to samples closes those holes, so sample index / rate runs up to a second behind the timeline that the video and ffmpeg's atrim use.
Planning cuts on the decoded clock and applying them on the real one is what cut the ends off his words on 2026-11-07
("poli-", "touch"). Always read a raw take through this.

load(path) places each 1024-sample AAC packet at its own timestamp and leaves zeros in the holes. Returns (samples[n, ch], rate, holes),
holes being [(start_s, end_s)] on the timeline."""
import json, subprocess
import numpy as np


def load(path):
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                                               "stream=sample_rate,channels,time_base", "-of", "json", path]))["streams"][0]
    rate, ch = int(info["sample_rate"]), int(info["channels"])
    num, den = (int(v) for v in info["time_base"].split("/"))
    assert num == 1 and den == rate, ("expected the audio's time base to be its sample rate", info)
    pts = [int(l.split(",")[0]) for l in subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "packet=pts",
                                                                  "-of", "csv=p=0", path], text=True).split()]
    pcm = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", str(ch), "-ar", str(rate), "-f", "f32le", "-"],
                                       capture_output=True, check=True).stdout, dtype=np.float32).reshape(-1, ch)
    FRAME = 1024
    # Some files start with a negative timestamp: the encoder's priming samples (-201 in an export, -2112 from an iPhone's
    # AAC). The decoder drops those samples, so packet k's decoded audio starts `lead` samples earlier in pcm.
    lead = max(0, -pts[0])
    assert abs(len(pcm) + lead - len(pts) * FRAME) <= FRAME, ("decoded length doesn't match the packets", len(pcm), len(pts) * FRAME, lead)
    out = np.zeros((pts[-1] + FRAME, ch), dtype=np.float32)
    holes = []
    for k, p in enumerate(pts):
        a = max(0, k * FRAME - lead)
        part = pcm[a:(k + 1) * FRAME - lead]
        start = max(0, p)
        out[start:start + len(part)] = part
        if k + 1 < len(pts) and pts[k + 1] > p + FRAME:
            holes.append(((p + FRAME) / rate, pts[k + 1] / rate))
    return out, rate, holes
