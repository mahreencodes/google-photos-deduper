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
