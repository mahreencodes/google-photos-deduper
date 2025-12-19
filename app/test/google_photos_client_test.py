import pytest
from unittest.mock import Mock
import requests

from app.lib.google_photos_client import GooglePhotosClient


class TestRefreshCredentialsIfInvalid:
    @pytest.mark.skip(reason="TODO private method now, test behavior in other methods")
    def test_refresh_credentials_if_invalid__valid_credentials(self, credentials):
        func = Mock()

        # TODO: Test retry on 401
        # mock_response = Mock(spec=requests.Response, status_code=401)
        # error = requests.exceptions.HTTPError(response=mock_response)
        # assert error.response.status_code == 401

        # mocker.patch.multiple(
        #     "app.lib.google_api_client.GoogleApiClient",
        #     # First call raises unauthorized error, second call succeeds
        #     get_user_info=Mock(side_effect=[error, user_info]),
        #     refresh_credentials=Mock(return_value=new_credentials),
        # )

        refreshed, returned_credentials = refresh_credentials_if_invalid(
            credentials, func
        )

        func.assert_called_once_with(credentials)
        assert refreshed is False
        assert returned_credentials == credentials

    def test_get_media_items_by_ids(self, mocker, credentials, media_item):
        client = GooglePhotosClient(credentials, logger=mocker.Mock())

        response_json = {
            "mediaItemResults": [
                {"mediaItem": media_item}
            ]
        }

        mock_resp = mocker.Mock()
        mock_resp.json.return_value = response_json
        mocker.patch.object(client.session, "post", return_value=mock_resp)

        result = client.get_media_items_by_ids([media_item["id"]])
        assert media_item["id"] in result
        assert result[media_item["id"]]["id"] == media_item["id"]

    def test_fetch_media_items_uses_fields_param(self, mocker, credentials):
        client = GooglePhotosClient(credentials, logger=mocker.Mock())

        mock_resp = mocker.Mock()
        mock_resp.json.return_value = {"mediaItems": []}
        called = {}

        def fake_get(url, params=None):
            called['url'] = url
            called['params'] = params
            return mock_resp

        mocker.patch.object(client.session, "get", side_effect=fake_get)

        # call fetch_media_items (it should exit quickly because no mediaItems)
        client.fetch_media_items()

        assert called['url'] == "https://photoslibrary.googleapis.com/v1/mediaItems"
        assert 'fields' in called['params']
        assert 'pageSize' in called['params']
        assert "mediaItems(id,baseUrl,filename,mediaMetadata,mimeType)" in called['params']['fields']
