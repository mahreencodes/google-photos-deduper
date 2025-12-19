import pytest
from unittest.mock import Mock

from app.lib.store_images_task import StoreImagesTask


def test_store_images_fetches_missing_items(mocker, media_item):
    user_id = "user-1"
    media_id = media_item["id"]

    # Mock repository to return empty map so media item is missing
    repo_cls = mocker.patch("app.lib.store_images_task.MediaItemsRepository")
    repo_instance = repo_cls.return_value
    repo_instance.get_id_map.return_value = {}

    # Mock GooglePhotosClient and its batch method
    gp_cls = mocker.patch("app.lib.store_images_task.GooglePhotosClient")
    gp_client = gp_cls.from_user_id.return_value
    gp_client.get_media_items_by_ids.return_value = {media_id: media_item}

    # Prevent actual downloading of images
    img_store_cls = mocker.patch("app.lib.store_images_task.MediaItemsImageStore")
    img_store = img_store_cls.return_value
    img_store.store_image.return_value = "filename.jpg"

    task = StoreImagesTask(user_id, [media_id], resolution=100, logger=Mock())
    task.run()

    # Ensure create_or_update was called with the fetched media_item
    assert repo_instance.create_or_update.called
    # Ensure update was called to set storageFilename
    assert repo_instance.update.called


def test_store_images_respects_custom_path_and_original_flag(mocker, tmp_path, media_item):
    user_id = "user-1"
    media_id = media_item["id"]

    # Mock repository to return the existing media item
    repo_cls = mocker.patch("app.lib.store_images_task.MediaItemsRepository")
    repo_instance = repo_cls.return_value
    repo_instance.get_id_map.return_value = {media_id: media_item}

    # Prevent actual downloading of images
    img_store_cls = mocker.patch("app.lib.store_images_task.MediaItemsImageStore")
    img_store = img_store_cls.return_value
    img_store.store_image.return_value = f"{media_id}-original.jpg"

    custom_path = str(tmp_path / "images")

    task = StoreImagesTask(
        user_id,
        [media_id],
        resolution=100,
        download_original=True,
        image_store_path=custom_path,
        logger=Mock(),
    )

    task.run()

    # repo.update should be called with storageFilename that indicates original
    repo_instance.update.assert_called()
    args = repo_instance.update.call_args[0]
    assert "storageFilename" in args[1]
    assert args[1]["storageFilename"].endswith("-original.jpg")