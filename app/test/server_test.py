from unittest.mock import Mock
import pytest
import flask
import requests
from app import server
from app.lib.google_api_client import GoogleApiClient


@pytest.fixture()
def client(flask_app):
    return flask_app.test_client()


class TestAuthMe:
    def test_auth_me_no__session_user_id(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 401
        assert response.json["logged_in"] is False

    def test_auth_me__session_user_id(
        self,
        client,
        credentials,
        user_info,
        mocker,
    ):
        mocker.patch.multiple(
            "app.models.credentials_repository.CredentialsRepository",
            get=Mock(return_value=credentials),
        )
        mocker.patch.multiple(
            "app.lib.google_api_client.GoogleApiClient",
            get_user_info=Mock(return_value=user_info),
        )

        with client.session_transaction() as session:
            session["user_id"] = user_info["id"]

        with client:
            response = client.get("/auth/me")
            assert response.status_code == 200
            assert response.json["logged_in"] is True
            assert response.json["user_info"] == user_info

    def test_get_active_task_results_for_insufficient_scopes(self, client, mocker):
        # Setup a fake AsyncResult with SUCCESS status and an error payload
        fake_result = Mock()
        fake_result.status = "SUCCESS"
        fake_result.info = {"error": "insufficient_scopes", "user_id": "user-1"}

        mocker.patch("app.server.tasks.process_duplicates.AsyncResult", return_value=fake_result)

        with client.session_transaction() as session:
            session["active_task_id"] = "fake"

        response = client.get("/api/active_task/results")
        assert response.status_code == 200
        assert response.json["error"] == "insufficient_scopes"

    def test_get_credentials(self, client, mocker, credentials, user_id):
        mocker.patch(
        "app.models.credentials_repository.CredentialsRepository",
        return_value=Mock(get=Mock(return_value=credentials)),
    )

        with client.session_transaction() as session:
            session["user_id"] = user_id

        response = client.get("/api/credentials")
        assert response.status_code == 200
        assert response.json["has_credentials"] is True
        assert "scopes" in response.json
        assert "required_scopes" in response.json
        assert "missing_scopes" in response.json

    def test_get_credentials_reports_no_missing_scopes_when_all_present(self, client, mocker):
        from app import utils

        credentials = {"scopes": list(utils.REQUIRED_SCOPES)}
        mocker.patch(
            "app.models.credentials_repository.CredentialsRepository",
            return_value=Mock(get=Mock(return_value=credentials)),
        )

        with client.session_transaction() as session:
            session["user_id"] = "abc"

        res = client.get("/api/credentials")
        assert res.status_code == 200
        assert res.json["missing_scopes"] == []

    def test_create_task_forwards_new_options(self, client, mocker, user_id):
        # Patch the celery task to capture kwargs
        fake_result = Mock()
        fake_result.id = "fake"
        captured = {}

        def fake_delay(*args, **kwargs):
            captured["args"] = args
            captured["kwargs"] = kwargs
            return fake_result

        mocker.patch("app.server.tasks.process_duplicates.delay", side_effect=fake_delay)

        with client.session_transaction() as session:
            session["user_id"] = user_id

        payload = {
            "refresh_media_items": True,
            "resolution": 300,
            "download_original": True,
            "image_store_path": "./tmp-images",
            "chunk_size": 50,
        }

        res = client.post("/api/task", json=payload)
        assert res.status_code == 200
        assert captured["kwargs"]["resolution"] == 300
        assert captured["kwargs"]["download_original"] is True
        assert "image_store_path" in captured["kwargs"]
        assert captured["kwargs"]["chunk_size"] == 50

    def test_create_task_rejects_invalid_image_store_path(self, client, mocker, user_id):
        # Simulate os.makedirs raising an error
        mocker.patch("os.makedirs", side_effect=OSError("no space"))

        with client.session_transaction() as session:
            session["user_id"] = user_id

        payload = {"image_store_path": "./bad-path"}
        res = client.post("/api/task", json=payload)
        assert res.status_code == 400
        assert res.json["error"] == "invalid_image_store_path"

    def test_callback_handles_scope_change_error(self, client, mocker):
        # Simulate utils.get_credentials raising the oauthlib scope-change ValueError
        mocker.patch("app.utils.get_credentials", side_effect=ValueError("Warning: Scope has changed"))

        with client.session_transaction() as session:
            session["state"] = "xyz"

        res = client.get("/auth/google/callback")
        assert res.status_code == 400
        assert res.json["error"] == "token_exchange_failed"