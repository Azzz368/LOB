"""LLM-based multilingual fragment stitching (Strategy B)."""

from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import httpx


@dataclass
class LLMResult:
    poem: str
    used_fragments: Dict[str, List[str]]
    notes: str = ""


class LLMPoetryStitcher:
    """Generate a multilingual stitched poem from language fragments.

    The model must not translate fragments and should only arrange them.
    """

    def select_fragments(
        self, fragments: Dict[str, List[Dict]], plan: Dict
    ) -> Dict[str, List[str]]:
        """Select fragments by language.

        plan options:
        - per_lang_k: int (default 1)
        - language_weights: Dict[str, float]
        - must_include: Iterable[str]
        """

        per_lang_k = int(plan.get("per_lang_k", 1))
        weights = plan.get("language_weights", {})
        must_include = set(plan.get("must_include", []))

        selected: Dict[str, List[str]] = {}
        for lang, items in fragments.items():
            texts = [item.get("text", "").strip() for item in items if item.get("text")]
            if not texts:
                continue
            k = min(per_lang_k, len(texts))
            if lang in must_include:
                chosen = texts[:k]
            elif weights:
                chosen = random.choices(texts, k=k)
            else:
                chosen = random.sample(texts, k=k) if k > 0 else []
            selected[lang] = chosen
        return selected

    def build_messages(self, selected: Dict[str, List[str]], controls: Dict) -> List[Dict]:
        """Build chat messages for the LLM."""

        line_mode = controls.get("line_mode", "single")
        poetic_density = int(controls.get("poetic_density", 1))
        allow_connectors = bool(controls.get("allow_connectors", False))
        must_use_all = controls.get("must_use_all", True)
        max_chars = controls.get("max_chars")

        system = (
            "你是诗歌拼缝师。你只做排列组合，不翻译，不解释。"
            "必须保留原始文字，禁止改写或新增实词。"
            "仅允许添加少量标点、空格或换行。"
            "输出严格 JSON，不要包含多余文本。"
        )

        lines = []
        for lang, frags in selected.items():
            joined = " / ".join(frags)
            lines.append(f"[{lang} fragments]: {joined}")

        user = (
            "请根据以下碎片生成杂糅诗句。\n"
            f"line_mode={line_mode}, poetic_density={poetic_density}, "
            f"allow_connectors={allow_connectors}, must_use_all={must_use_all}.\n"
            + "\n".join(lines)
        )
        if max_chars:
            user += f"\n总长度不超过 {max_chars} 字符。"

        user += (
            "\n输出严格 JSON，例如："
            "{\"poem\":\"月光 forgets 水面 — نور\","
            "\"used_fragments\":{\"zh\":[\"月光\"],\"en\":[\"forgets\"],\"ar\":[\"نور\"]},"
            "\"notes\":\"\"}"
        )

        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    def generate(self, selected: Dict[str, List[str]], client_cfg: Dict, controls: Dict) -> str:
        """Generate poem using an OpenAI-compatible backend.

    client_cfg options:
        - model, temperature, top_p, max_tokens, timeout, retries
    - base_url (OpenAI-compatible, e.g. Ollama)
    - api_key (defaults to env OPENAI_API_KEY; optional for local base_url)
        - mock_responses: List[str] (for tests)
        """

        retries = int(client_cfg.get("retries", 2))
        attempt = 0
        last_errors: List[str] = []

        while attempt <= retries:
            messages = self.build_messages(selected, controls)
            if last_errors:
                messages.append(
                    {
                        "role": "user",
                        "content": "上次输出不合规：" + " | ".join(last_errors) + "。请严格输出 JSON。",
                    }
                )

            raw = self._call_llm(messages, client_cfg)
            parsed = self._parse_json(raw)
            if parsed is None:
                last_errors = ["JSON 解析失败"]
                attempt += 1
                continue

            poem = parsed.poem
            ok, errors = self.validate(poem, selected, controls)
            if ok:
                return poem
            last_errors = errors
            attempt += 1
            time.sleep(0.2)

        raise RuntimeError("LLM generation failed: " + "; ".join(last_errors))

    def validate(
        self, poem: str, selected: Dict[str, List[str]], controls: Dict
    ) -> Tuple[bool, List[str]]:
        """Validate output poem against fragment constraints."""

        errors: List[str] = []
        must_use_all = controls.get("must_use_all", True)
        max_chars = controls.get("max_chars")

        if max_chars and len(poem) > int(max_chars):
            errors.append("poem exceeds max_chars")

        if must_use_all:
            for lang, frags in selected.items():
                for frag in frags:
                    if frag not in poem:
                        errors.append(f"missing fragment: {lang}:{frag}")

        return (len(errors) == 0, errors)

    def _parse_json(self, raw: str) -> LLMResult | None:
        try:
            payload = json.loads(raw)
            poem = payload.get("poem", "")
            used = payload.get("used_fragments", {})
            notes = payload.get("notes", "")
            if not poem:
                return None
            return LLMResult(poem=poem, used_fragments=used, notes=notes)
        except Exception:
            return None

    def _call_llm(self, messages: List[Dict], client_cfg: Dict) -> str:
        mock = client_cfg.get("mock_responses")
        if mock:
            return mock.pop(0)

        model = client_cfg.get("model", "gpt-4o-mini")
        temperature = client_cfg.get("temperature", 0.7)
        top_p = client_cfg.get("top_p", 1.0)
        max_tokens = client_cfg.get("max_tokens", 200)
        timeout = client_cfg.get("timeout", 30)
        base_url = client_cfg.get("base_url") or os.getenv("OLLAMA_BASE_URL")
        api_key = client_cfg.get("api_key") or os.getenv("OPENAI_API_KEY")
        if not api_key and not base_url:
            raise RuntimeError("OPENAI_API_KEY not set")

        if base_url:
            return self._call_openai_compatible(
                base_url,
                api_key or "ollama",
                model,
                messages,
                temperature,
                top_p,
                max_tokens,
                timeout,
            )

        return self._call_openai_sdk(
            api_key,
            model,
            messages,
            temperature,
            top_p,
            max_tokens,
            timeout,
        )

    def _call_openai_sdk(
        self,
        api_key: str,
        model: str,
        messages: List[Dict],
        temperature: float,
        top_p: float,
        max_tokens: int,
        timeout: int,
    ) -> str:
        try:
            from openai import OpenAI  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("openai SDK not installed") from exc

        client = OpenAI(api_key=api_key, timeout=timeout)
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    def _call_openai_compatible(
        self,
        base_url: str,
        api_key: str,
        model: str,
        messages: List[Dict],
        temperature: float,
        top_p: float,
        max_tokens: int,
        timeout: int,
    ) -> str:
        url = base_url.rstrip("/") + "/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, headers=headers, json=payload)
        if response.status_code == 404:
            return self._call_ollama_native(base_url, model, messages, timeout)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    def _call_ollama_native(
        self,
        base_url: str,
        model: str,
        messages: List[Dict],
        timeout: int,
    ) -> str:
        url = base_url.rstrip("/") + "/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload)
        if response.status_code == 404:
            return self._call_ollama_generate(base_url, model, messages, timeout)
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "")

    def _call_ollama_generate(
        self,
        base_url: str,
        model: str,
        messages: List[Dict],
        timeout: int,
    ) -> str:
        url = base_url.rstrip("/") + "/api/generate"
        prompt = "\n".join(
            f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in messages
        )
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")


if __name__ == "__main__":
    fragments = {
        "zh": [{"text": "月光"}, {"text": "水面"}],
        "en": [{"text": "forgets"}, {"text": "river"}],
        "ar": [{"text": "نور"}],
    }
    stitcher = LLMPoetryStitcher()
    selected = stitcher.select_fragments(fragments, {"per_lang_k": 1})
    controls = {
        "line_mode": "single",
        "poetic_density": 1,
        "allow_connectors": False,
        "must_use_all": True,
        "max_chars": 120,
    }
    client_cfg = {
        "mock_responses": [
            '{"poem":"月光 forgets 水面 — نور","used_fragments":{"zh":["月光","水面"],"en":["forgets"],"ar":["نور"]},"notes":""}'
        ]
    }
    poem = stitcher.generate(selected, client_cfg, controls)
    print(poem)
