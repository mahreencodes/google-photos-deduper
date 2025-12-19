import pytest
from unittest.mock import Mock

from app.lib.process_duplicates_task import ProcessDuplicatesTask
from app.lib.google_api_client import InsufficientScopesError


def test_run_returns_insufficient_scopes_when_fetch_fails(mocker):
    # Setup task with a client that raises InsufficientScopesError on fetch
    task_stub = Mock()
    user_id = "user-1"

    # Mock GooglePhotosClient.from_user_id to return a client whose fetch_media_items raises
    gp_cls = mocker.patch("app.lib.process_duplicates_task.GooglePhotosClient")
    gp_client = gp_cls.from_user_id.return_value
    gp_client.local_media_items_count.return_value = 0
    gp_client.fetch_media_items.side_effect = InsufficientScopesError("insufficient scopes")

    pd_task = ProcessDuplicatesTask(task_stub, user_id, logger=Mock())

    result = pd_task.run()

    assert result.get("error") == "insufficient_scopes"
    assert result.get("user_id") == user_id


def test_chunked_processing_small_dataset(mocker):
    # Create fake media items (4 items)
    media_items = [
        {"id": "a", "baseUrl": "http://example/a", "mediaMetadata": {"width": "100", "height": "100"}},
        {"id": "b", "baseUrl": "http://example/b", "mediaMetadata": {"width": "100", "height": "100"}},
        {"id": "c", "baseUrl": "http://example/c", "mediaMetadata": {"width": "100", "height": "100"}},
        {"id": "d", "baseUrl": "http://example/d", "mediaMetadata": {"width": "100", "height": "100"}},
    ]

    task_stub = Mock()
    user_id = "user-chunk"

    gp_cls = mocker.patch("app.lib.process_duplicates_task.GooglePhotosClient")
    gp_client = gp_cls.from_user_id.return_value
    gp_client.local_media_items_count.return_value = 4
    gp_client.get_local_media_items.return_value = media_items

    # Patch MediaItemsImageStore.store_image to avoid network/file operations
    img_store_cls = mocker.patch("app.lib.process_duplicates_task.MediaItemsImageStore")
    img_store = img_store_cls.return_value
    img_store.store_image.side_effect = lambda m: f"{m['id']}-100.jpg"

    # Patch DuplicateImageDetector._calculate_embeddings to create deterministic embeddings
    def fake_calculate(self):
        import numpy as np

        arrs = []
        for m in self.media_items:
            if m["id"] in ("a", "c"):
                arrs.append([1.0, 0.0, 0.0])
            else:
                arrs.append([0.0, 1.0, 0.0])

        class Emb:
            def __init__(self, arr):
                self._arr = arr

            def numpy(self):
                return self._arr

        self.embeddings = Emb(np.array(arrs))
        return self.embeddings

    mocker.patch("app.lib.process_duplicates_task.DuplicateImageDetector._calculate_embeddings", fake_calculate)

    # Run process with chunk_size=2 and low similarity threshold to pick pairs
    pd_task = ProcessDuplicatesTask(task_stub, user_id, chunk_size=2, similarity_threshold=0.8, logger=Mock())
    result = pd_task.run()

    # Expect two groups: {a,c} and {b,d}
    groups = result.get("groups")
    assert groups is not None
    group_sets = [set(g["mediaItemIds"]) for g in groups]
    assert {"a", "c"} in group_sets
    assert {"b", "d"} in group_sets