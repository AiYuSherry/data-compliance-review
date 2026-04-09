#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def read_text(file_path: str, text: str) -> str:
    if file_path:
        return Path(file_path).read_text(encoding='utf-8')
    return text


def normalize(raw: str) -> str:
    text = raw.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[\t\u3000]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def segment(text: str, max_chars: int = 500) -> list[str]:
    paras = [p.strip() for p in text.split('\n\n') if p.strip()]
    out: list[str] = []
    buf = ''
    for p in paras:
        if not buf:
            buf = p
        elif len(buf) + 2 + len(p) <= max_chars:
            buf += '\n\n' + p
        else:
            out.append(buf)
            buf = p
    if buf:
        out.append(buf)
    if not out and text:
        out = [text[:max_chars]]
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', default='')
    parser.add_argument('--text', default='')
    parser.add_argument('--output', required=True)
    parser.add_argument('--max-chars', type=int, default=500)
    args = parser.parse_args()

    raw = read_text(args.file, args.text)
    if not raw.strip():
        raise SystemExit('empty input')

    normalized = normalize(raw)
    chunks = segment(normalized, max_chars=args.max_chars)
    result = {
        'raw_length': len(raw),
        'normalized_length': len(normalized),
        'segment_count': len(chunks),
        'normalized_text': normalized,
        'segments': chunks,
    }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(args.output)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
