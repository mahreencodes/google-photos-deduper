import math
import pprint
import urllib.parse
import re
import flask
from app import utils
from app import tasks
from app import config
from app import server  # required for building URLs
from app.lib.google_api_client import GoogleApiClient
from app.lib.process_duplicates_task import DailyLimitExceededError, SubtasksFailedError
from app import FLASK_APP as flask_app
from app.models.media_items_repository import MediaItemsRepository


@flask_app.route("/auth/me")
def me():
    unauthed_response = flask.jsonify({"logged_in": False})

    user_id = flask.session.get("user_id")
    if not user_id:
        return unauthed_response, 401

    client = GoogleApiClient.from_user_id(user_id)
    user_info = client.get_user_info()

    return flask.jsonify({"logged_in": True, "user_info": user_info})


@flask_app.route("/auth/google")
def auth():
    authorization_url, state = utils.get_authorization_url()

    flask.session["state"] = state

    # Redirect the user to the authorization URL.
    return flask.redirect(authorization_url)


@flask_app.route("/auth/google/callback")
def callback():
    state = flask.session.get("state")

    try:
        credentials = utils.get_credentials(state, flask.request.url)
    except ValueError as e:
        # OAuth token exchange failed (possibly due to scope changes); surface a
        # user-friendly message rather than letting the debugger intercept.
        flask_app.logger.error("Failed to exchange token during callback: %s", e)
        return flask.jsonify({"error": "token_exchange_failed", "message": str(e)}), 400

    client = GoogleApiClient(credentials)
    client.save_credentials()
    flask.session["user_id"] = client.get_user_id()

    return flask.redirect("/task_options")


@flask_app.route("/api/task", methods=["POST"])
def create_task():
    # TODO: Better checking of active user across authed endpoints
    user_id = flask.session.get("user_id")
    assert user_id

    task_args = {
        "refresh_media_items": flask.request.json.get("refresh_media_items"),
    }

    if "resolution" in flask.request.json:
        task_args["resolution"] = int(flask.request.json.get("resolution"))
    if "similarity_threshold" in flask.request.json:
        task_args["similarity_threshold"] = float(
            flask.request.json.get("similarity_threshold")
        )

    # New options: download_original, image_store_path, chunk_size
    if "download_original" in flask.request.json:
        task_args["download_original"] = bool(flask.request.json.get("download_original"))
    if "image_store_path" in flask.request.json:
        image_store_path = flask.request.json.get("image_store_path")
        # Normalize path and attempt to create directory if it doesn't exist
        try:
            import os

            image_store_path = os.path.abspath(os.path.expanduser(image_store_path))
            os.makedirs(image_store_path, exist_ok=True)
            if not os.access(image_store_path, os.W_OK):
                return flask.jsonify({"error": "image_store_path_not_writable"}), 400
        except Exception as e:
            flask_app.logger.error("Invalid image_store_path provided: %s", e)
            return flask.jsonify({"error": "invalid_image_store_path", "message": str(e)}), 400

        task_args["image_store_path"] = image_store_path

    if "chunk_size" in flask.request.json:
        try:
            chunk_size = int(flask.request.json.get("chunk_size"))
            if chunk_size <= 0:
                raise ValueError("chunk_size must be > 0")
            task_args["chunk_size"] = chunk_size
        except Exception as e:
            return flask.jsonify({"error": "invalid_chunk_size", "message": str(e)}), 400

    flask_app.logger.info(
        f"Creating task for user_id {user_id} with options: {task_args}"
    )

    result = tasks.process_duplicates.delay(user_id, **task_args)
    flask.session["active_task_id"] = result.id

    return flask.jsonify({"success": True})


expected_errors = [DailyLimitExceededError, SubtasksFailedError]


@flask_app.route("/api/active_task", methods=["GET"])
def get_active_task():
    result = None
    active_task_id = flask.session.get("active_task_id")
    if active_task_id:
        result = tasks.process_duplicates.AsyncResult(active_task_id)

    if (
        result is None or result.status == "PENDING"
    ):  # PENDING is the default return value of celery.result.AsyncResult, even if that task no longer exists
        return flask.jsonify({"error": "No active task found"}), 404

    response = {"status": result.status}
    if result.status in ["SUCCESS", "PROGRESS"]:
        response["meta"] = result.info["meta"]
    elif result.status == "FAILURE":
        if any(isinstance(result.info, e) for e in expected_errors):
            response["error"] = str(result.info)
    else:
        # Some other state we didn't explictly set.
        flask_app.logger.info(
            f"Excluding result info in active task response,\n\
                status: {result.status}, info: {pprint.pformat(result.info)}"
        )

    return flask.jsonify(response)


@flask_app.route("/api/active_task", methods=["DELETE"])
def cancel_active_task():
    active_task_id = flask.session.get("active_task_id")
    if not active_task_id:
        return flask.jsonify({"error": "No active task found"}), 404

    result = tasks.process_duplicates.AsyncResult(active_task_id)
    result.revoke(terminate=True)

    del flask.session["active_task_id"]

    return flask.Response(status=204)


@flask_app.route("/api/active_task/results", methods=["GET"])
def get_active_task_results():
    active_task_id = flask.session.get("active_task_id")
    if not active_task_id:
        return flask.jsonify({"error": "No active task found"}), 404

    result = tasks.process_duplicates.AsyncResult(active_task_id)
    response = {}
    if result.status == "SUCCESS":
        # If the task completed but returned an error payload, forward it.
        if isinstance(result.info, dict) and "error" in result.info:
            # return the error payload directly so the UI can act (e.g., re-auth)
            return flask.jsonify(result.info)

        # Otherwise, assume normal results structure and format for display
        results = task_results_for_display(result.info["results"])
        response |= results

    return flask.jsonify(response)


@flask_app.route("/api/credentials", methods=["GET"])
def get_credentials():
    user_id = flask.session.get("user_id")
    if not user_id:
        return flask.jsonify({"error": "not_logged_in"}), 401

    # Import here to avoid circular import at module load
    from app.models.credentials_repository import CredentialsRepository

    credentials_repo = CredentialsRepository(user_id)
    creds = credentials_repo.get()
    if not creds:
        return flask.jsonify({
            "has_credentials": False,
            "scopes": None,
            "required_scopes": utils.REQUIRED_SCOPES,
            "missing_scopes": utils.REQUIRED_SCOPES,
        })

    stored_scopes = creds.get("scopes") or []
    # Compute which of the required scopes are not present in the stored token
    missing = [s for s in utils.REQUIRED_SCOPES if s not in stored_scopes]

    return flask.jsonify({
        "has_credentials": True,
        "scopes": stored_scopes,
        "required_scopes": utils.REQUIRED_SCOPES,
        "missing_scopes": missing,
    })


@flask_app.route("/api/media_items/<id>", methods=["POST"])
def update_media_item(id):
    repo = MediaItemsRepository(user_id=flask.session["user_id"])
    media_item = repo.update(id, flask.request.json)

    return flask.jsonify(
        success=True,
        media_item=media_item_for_display(media_item),
    )


@flask_app.route("/api/logout", methods=["POST"])
def logout():
    flask.session.clear()
    return flask.jsonify(success=True)


@flask_app.route("/api/recent_media_items", methods=["GET"])
def get_recent_media_items():
    user_id = flask.session.get("user_id")
    if not user_id:
        return flask.jsonify({"error": "not_logged_in"}), 401

    limit = int(flask.request.args.get("limit", 20))
    repo = MediaItemsRepository(user_id=user_id)
    
    # Get recent media items sorted by fetchedAt descending
    recent_items = list(
        repo.collection.find(
            {"userId": user_id, "storageFilename": {"$exists": True}},
            sort=[("fetchedAt", -1)],
            limit=limit
        )
    )
    
    # Format for display
    items_for_display = []
    for item in recent_items:
        try:
            display_item = media_item_for_display(item)
            items_for_display.append(display_item)
        except Exception as e:
            flask_app.logger.warning(f"Error formatting media item {item.get('id')}: {e}")
            continue
    
    return flask.jsonify({"items": items_for_display, "count": len(items_for_display)})


def task_results_for_display(results):
    repo = MediaItemsRepository(user_id=flask.session["user_id"])
    media_item_ids = [id for g in results["groups"] for id in g["mediaItemIds"]]
    media_items_id_map = repo.get_id_map(media_item_ids)

    results_for_display = {}
    results_for_display["groups"] = {g["id"]: g for g in results["groups"]}
    results_for_display["mediaItems"] = {
        id: media_item_for_display(media_items_id_map[id]) for id in media_item_ids
    }
    results_for_display["similarityMap"] = results["similarityMap"]

    return results_for_display


def media_item_for_display(media_item):
    m = {
        k: media_item.get(k, None)
        for k in (
            "id",
            "productUrl",
            "filename",
            "mimeType",
            "deletedAt",
            "userUrl",
        )
    }

    image_url = urllib.parse.urljoin(
        config.PUBLIC_IMAGE_FOLDER,
        media_item["storageFilename"],
    )
    m["imageUrl"] = image_url

    m["dimensions"] = " x ".join(
        [
            media_item["mediaMetadata"]["width"],
            media_item["mediaMetadata"]["height"],
        ]
    )

    return m


if __name__ == "__main__":
    flask_app.run()
