import logging
import os
import time
import app.config
from typing import Optional
import requests


class MediaItemsImageStore:
    """Stores images on the filesystem.
    When and if hosted publicly, encapsulating here will make it easy
    to move to a cloud storage provider like S3.
    """

    def __init__(self, resolution=250, base_path: Optional[str] = None, download_original: bool = False):
        self.resolution = resolution
        self.base_path = base_path
        self.download_original = download_original

        # Ensure the base path exists and is writable if provided
        if self.base_path:
            self.base_path = os.path.abspath(os.path.expanduser(self.base_path))
            os.makedirs(self.base_path, exist_ok=True)
            if not os.access(self.base_path, os.W_OK):
                raise PermissionError(f"Image store path not writable: {self.base_path}")

    def store_image(self, media_item) -> str:
        url = self._image_url(media_item)
        path = self._storage_path(media_item)
        # If we already have a local copy, don't download it again
        if not os.path.isfile(path):
            attempts = 3
            success = False
            while not success:
                try:
                    response = requests.get(url, timeout=5)
                    response.raise_for_status()
                    with open(path, "wb") as file:
                        file.write(response.content)
                    success = True
                except requests.exceptions.RequestException as error:
                    attempts -= 1
                    sleep_time = app.config.RESPONSE_FAILURE_RETRY_SECONDS
                    if error.response is not None and error.response.status_code == 429:
                        sleep_time = app.config.RESPONSE_429_RETRY_SECONDS
                    logging.warning(
                        f"Received {error} downloading image\n"
                        f"media_item: {media_item}\n"
                        f"url: {url}\n"
                        f"attempts left: {attempts}\n"
                        f"sleeping for {sleep_time} seconds before retrying"
                    )
                    time.sleep(sleep_time)
                    if attempts <= 0:
                        raise error

        return self._storage_filename(media_item)

    def get_storage_path(self, storage_filename: str) -> str:
        base = self.base_path if self.base_path else app.config.IMAGE_STORE_PATH
        return os.path.join(
            base,
            storage_filename,
        )


    def _storage_filename(self, media_item) -> str:
        # These are all JPEG images (baseUrl for movies is a thumbnail)
        if self.download_original:
            return f"{media_item['id']}-original.jpg"
        return f"{media_item['id']}-{self.resolution}.jpg"

    def _storage_path(self, media_item) -> str:
        base = self.base_path if self.base_path else app.config.IMAGE_STORE_PATH
        return os.path.join(
            base,
            self._storage_filename(media_item),
        )

    def _image_url(self, media_item) -> str:
        if self.download_original:
            # Request the original image (no size query)
            return f"{media_item['baseUrl']}"
        return f"{media_item['baseUrl']}=w{self.resolution}-h{self.resolution}"
