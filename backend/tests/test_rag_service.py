"""Unit tests for RAG service — similarity filtering and reranker fallback."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.schemas.rag import ChunkResult, RagSearchRequest
from app.service.rag import RAGService


def _make_chunk(score: float, similarity: float = 0.8) -> ChunkResult:
    return ChunkResult(
        chunk_id=uuid.uuid4(),
        attachment_id=uuid.uuid4(),
        content="sample content",
        highlight=None,
        page_number=1,
        bbox=None,
        section_title=None,
        score=score,
        similarity=similarity,
    )


def _make_request(**kwargs: object) -> RagSearchRequest:
    defaults = {
        "customer_id": uuid.uuid4(),
        "query": "test query",
        "ai_mode": False,
        "top_k": 5,
    }
    return RagSearchRequest(**{**defaults, **kwargs})


@pytest.fixture()
def embedding_service() -> AsyncMock:
    svc = AsyncMock()
    svc.embed.return_value = [0.1] * 768
    return svc


@pytest.fixture()
def llm_service() -> AsyncMock:
    svc = AsyncMock()
    svc.generate.return_value = "AI answer"
    return svc


@pytest.fixture()
def reranker_client() -> AsyncMock:
    client = AsyncMock()
    client.rerank.side_effect = lambda _q, chunks, top_k: chunks[:top_k]
    return client


@pytest.fixture()
def db_session() -> MagicMock:
    return MagicMock()


class TestRAGServiceFiltering:
    async def test_no_results_when_all_filtered_by_distance(
        self,
        embedding_service: AsyncMock,
        llm_service: AsyncMock,
        reranker_client: AsyncMock,
        db_session: MagicMock,
    ) -> None:
        """When repo returns empty list (all chunks exceeded max_distance), response reflects no results."""
        with patch("app.service.rag.DocumentChunkRepository") as MockRepo:
            MockRepo.return_value.search = AsyncMock(return_value=[])

            service = RAGService(embedding_service, llm_service, reranker_client)
            response = await service.search(_make_request(), db_session)

        assert response.chunks == []
        assert response.no_results_found is True
        assert response.ai_answer is None

    async def test_results_present_when_chunks_pass_filter(
        self,
        embedding_service: AsyncMock,
        llm_service: AsyncMock,
        reranker_client: AsyncMock,
        db_session: MagicMock,
    ) -> None:
        """When repo returns chunks (within max_distance), they appear in the response."""
        chunk = _make_chunk(score=0.2)
        fake_row = MagicMock()
        fake_row.id = chunk.chunk_id
        fake_row.attachment_id = chunk.attachment_id
        fake_row.content = chunk.content
        fake_row.page_number = chunk.page_number
        fake_row.bbox = chunk.bbox
        fake_row.section_title = chunk.section_title
        fake_row.vec_score = 0.2

        with patch("app.service.rag.DocumentChunkRepository") as MockRepo:
            MockRepo.return_value.search = AsyncMock(return_value=[(fake_row, 0.2)])

            service = RAGService(embedding_service, llm_service, reranker_client)
            response = await service.search(_make_request(), db_session)

        assert len(response.chunks) == 1
        assert response.no_results_found is False

    async def test_max_distance_passed_to_repo(
        self,
        embedding_service: AsyncMock,
        llm_service: AsyncMock,
        reranker_client: AsyncMock,
        db_session: MagicMock,
    ) -> None:
        """RAGService passes settings.rag_vec_max_distance to the repository."""
        with patch("app.service.rag.DocumentChunkRepository") as MockRepo:
            mock_search = AsyncMock(return_value=[])
            MockRepo.return_value.search = mock_search

            with patch("app.service.rag.settings") as mock_settings:
                mock_settings.rag_vec_max_distance = 0.35

                service = RAGService(embedding_service, llm_service, reranker_client)
                await service.search(_make_request(), db_session)

        call_kwargs = mock_search.call_args.kwargs
        assert call_kwargs["max_distance"] == 0.35

    async def test_ai_mode_not_called_when_no_chunks(
        self,
        embedding_service: AsyncMock,
        llm_service: AsyncMock,
        reranker_client: AsyncMock,
        db_session: MagicMock,
    ) -> None:
        """LLM is not invoked when no chunks pass the distance filter."""
        with patch("app.service.rag.DocumentChunkRepository") as MockRepo:
            MockRepo.return_value.search = AsyncMock(return_value=[])

            service = RAGService(embedding_service, llm_service, reranker_client)
            await service.search(_make_request(ai_mode=True), db_session)

        llm_service.generate.assert_not_called()


class TestRerankerClientFallback:
    async def test_fallback_to_vec_scores_on_http_error(self) -> None:
        """When reranker HTTP call fails, client falls back to vec-score ordering."""
        from app.service.reranker_client import RerankerClient

        chunks = [_make_chunk(score=0.3), _make_chunk(score=0.1), _make_chunk(score=0.5)]

        with patch("httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.side_effect = httpx.ConnectError("refused")
            MockClient.return_value.__aenter__.return_value = mock_instance

            client = RerankerClient()
            result = await client.rerank("query", chunks, top_k=2)

        assert len(result) == 2
        # fallback sorts ascending by vec score (lower=better), so chunk with 0.1 comes first
        assert result[0].score == 0.1
        assert result[1].score == 0.3

    async def test_reranker_updates_scores_on_success(self) -> None:
        """On successful reranker response, chunk scores are updated from reranker output."""
        from app.service.reranker_client import RerankerClient

        chunk = _make_chunk(score=0.9)
        chunk_id_str = str(chunk.chunk_id)

        reranker_response = [{"id": chunk_id_str, "text": "sample content", "score": 8.5}]

        with patch("httpx.AsyncClient") as MockClient:
            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = reranker_response

            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            MockClient.return_value.__aenter__.return_value = mock_instance

            client = RerankerClient()
            result = await client.rerank("query", [chunk], top_k=1)

        assert result[0].score == 8.5
