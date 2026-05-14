"""LLM service — OpenRouter (OpenAI-compatible API).

To switch to local ollama later:
  OPENROUTER_BASE_URL=http://ollama:11434/v1
  OPENROUTER_API_KEY=ollama
  OPENROUTER_MODEL=gemma3:4b  (or whichever model you pulled)
"""

import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings

_SYSTEM_PROMPT = (
    "Jesteś asystentem CRM analizującym dokumenty klientów. "
    "Odpowiadaj wyłącznie na podstawie podanego kontekstu. "
    "Jeśli odpowiedź nie wynika z kontekstu, powiedz to wprost."
)


_SUMMARY_SYSTEM_PROMPT = (
    "Jesteś analitykiem CRM. Na podstawie podanych danych o kliencie wygeneruj "
    "krótkie podsumowanie (3-4 zdania) w języku polskim. "
    "Odpowiedz wyłącznie treścią podsumowania, bez nagłówków ani list."
)


_COVER_LETTER_SYSTEM_PROMPT = (
    "Jesteś specjalistą ds. kluczowych klientów w firmie HRK Payroll Consulting. "
    "Piszesz pismo przewodnie do aneksu waloryzacyjnego umowy. "
    "Twoje zadanie: napisz 3-4 akapity profesjonalnego, rzeczowego pisma w języku polskim. "
    "ZASADY (NIE ŁAM): "
    "1) Nigdy nie wymyślaj liczb, dat ani klauzul prawnych — używaj tylko tych, które dostałeś. "
    "2) Nie cytuj tabel ani paragrafów aneksu — pismo ma być narracją. "
    "3) Zachowaj ton zgodny z parametrem 'tone'. "
    "4) Uwzględnij dodatkowe wytyczne użytkownika, jeśli zostały podane, ale nie kosztem profesjonalizmu. "
    "5) Zwróć WYŁĄCZNIE treść pisma — bez nagłówka 'Szanowni Państwo', bez podpisu, "
    "te elementy są dodawane szablonem."
)


_RATIONALE_SYSTEM_PROMPT = (
    "Jesteś analitykiem biznesowym. Na podstawie podanych faktów o kliencie i waloryzacji "
    "wygeneruj 3-5 krótkich punktów uzasadniających podwyżkę stawek — KAŻDY w jednym zdaniu. "
    "ZASADY: nie wymyślaj faktów, używaj tylko tego co dostałeś, pisz po polsku, "
    "zwróć każdy punkt w osobnej linii (bez markdown, bez numeracji), bez wstępu i podsumowania."
)


_TONE_DESCRIPTIONS: dict[str, str] = {
    "formal": "Bardzo formalny, oficjalny, dystans.",
    "neutral": "Profesjonalny, neutralny, partnerski.",
    "warm": "Ciepły, podkreślający długą współpracę i partnerstwo.",
    "assertive": "Stanowczy, rzeczowy, podkreślający konieczność zmiany.",
}


class LLMService:
    async def summarize(self, prompt: str) -> str:
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if response.status_code == 429:
                return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]

    async def stream_summarize(self, prompt: str) -> AsyncIterator[str]:
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "stream": True,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            ) as response:
                if response.status_code == 429:
                    yield "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
                    return
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def generate(self, query: str, context_chunks: list[str]) -> str:
        context = "\n\n".join(f"[{i + 1}] {chunk}" for i, chunk in enumerate(context_chunks))
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": f"Kontekst:\n{context}\n\nPytanie: {query}",
                        },
                    ],
                },
            )
            if response.status_code == 429:
                return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]

    async def generate_cover_letter(
        self,
        *,
        facts: dict[str, object],
        tone: str,
        user_instructions: str | None,
    ) -> str:
        """Cover letter for a valorization amendment.

        ``facts`` carry numbers/dates derived from DB — LLM only uses them in
        prose. ``user_instructions`` is operator-supplied free-form guidance
        (e.g. "podkreśl 5 lat współpracy"). Numbers and clauses are never taken
        from this string.
        """
        tone_hint = _TONE_DESCRIPTIONS.get(tone, _TONE_DESCRIPTIONS["neutral"])
        instructions_block = (
            f"\nDODATKOWE WYTYCZNE UŻYTKOWNIKA (uwzględnij w narracji, ale NIE wprowadzaj nowych liczb):\n{user_instructions.strip()}\n"
            if user_instructions and user_instructions.strip()
            else ""
        )
        user_message = (
            f"TON: {tone_hint}\n\n"
            f"FAKTY (jedyne dopuszczalne źródło liczb i dat):\n{_format_facts(facts)}\n"
            f"{instructions_block}\n"
            "Napisz pismo przewodnie zgodnie z zasadami systemowymi."
        )
        return await self._chat(_COVER_LETTER_SYSTEM_PROMPT, user_message)

    async def generate_rationale_bullets(
        self,
        *,
        facts: dict[str, object],
        tone: str,
        user_instructions: str | None,
    ) -> list[str]:
        tone_hint = _TONE_DESCRIPTIONS.get(tone, _TONE_DESCRIPTIONS["neutral"])
        instructions_block = (
            f"\nDODATKOWE WYTYCZNE: {user_instructions.strip()}\n"
            if user_instructions and user_instructions.strip()
            else ""
        )
        user_message = (
            f"TON: {tone_hint}\n\n"
            f"FAKTY:\n{_format_facts(facts)}\n"
            f"{instructions_block}"
        )
        raw = await self._chat(_RATIONALE_SYSTEM_PROMPT, user_message)
        bullets = [line.strip(" -•\t") for line in raw.splitlines() if line.strip()]
        return [b for b in bullets if len(b) > 4][:5]

    async def _chat(self, system_prompt: str, user_message: str) -> str:
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                },
            )
            if response.status_code == 429:
                return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]


def _format_facts(facts: dict[str, object]) -> str:
    return "\n".join(f"- {key}: {value}" for key, value in facts.items())
