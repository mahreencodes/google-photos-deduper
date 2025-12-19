import pytest

from app import utils


def test_oauth_flow_requests_app_created_scopes(mocker):
    captured = {}

    def fake_from_client_config(config, scopes, state=None):
        captured["scopes"] = scopes

        class FakeFlow:
            def __init__(self, config, scopes, state=None):
                self.scopes = scopes
                self.redirect_uri = None

            def authorization_url(self, *args, **kwargs):
                return ("http://example", "state")

        return FakeFlow(config, scopes, state)

    mocker.patch(
        "google_auth_oauthlib.flow.Flow.from_client_config",
        side_effect=fake_from_client_config,
    )

    # Call the public helper which delegates to the private flow factory
    utils.get_authorization_url()

    assert (
        "https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata"
        in captured["scopes"]
    )
    assert (
        "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata"
        in captured["scopes"]
    )
    # Also include the standard readonly scope to avoid oauthlib scope-change
    # parsing errors when Google returns previously granted scopes
    assert (
        "https://www.googleapis.com/auth/photoslibrary.readonly" in captured["scopes"]
    )