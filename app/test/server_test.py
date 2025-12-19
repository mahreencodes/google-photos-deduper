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
        mocker.patch("app.server.CredentialsRepository", return_value=Mock(get=Mock(return_value=credentials)))

        with client.session_transaction() as session:
            session["user_id"] = user_id

        response = client.get("/api/credentials")
        assert response.status_code == 200
        assert response.json["has_credentials"] is True
        assert "scopes" in response.json