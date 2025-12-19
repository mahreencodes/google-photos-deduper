import copy
import datetime
import logging
import time
import os
from typing import Literal, Optional
import celery.result
import requests
import app.config
from app.lib.duplicate_image_detector import DuplicateImageDetector
from app.lib.google_photos_client import GooglePhotosClient
from app import CELERY_APP as celery_app
from app.models.media_items_repository import MediaItemsRepository
from app.lib.media_items_image_store import MediaItemsImageStore
from enum import Enum


class Steps:
    FETCH_MEDIA_ITEMS = "fetch_media_items"
    PROCESS_DUPLICATES = "process_duplicates"

    all = [FETCH_MEDIA_ITEMS, PROCESS_DUPLICATES]


class Subtask:
    class Type(Enum):
        STORE_IMAGES = "store_images"

    types = [Type.STORE_IMAGES]
    type_type = Literal[Type.STORE_IMAGES]

    def __init__(self, type: type_type, result: celery.result.AsyncResult):
        self._type = type
        self._result = result

    @property
    def type(self):
        return self._type

    @property
    def result(self):
        return self._result


class DailyLimitExceededError(Exception):
    pass


class SubtasksFailedError(Exception):
    pass


class ProcessDuplicatesTask:
    SUBTASK_BATCH_SIZE = 100

    def __init__(
        self,
        task: celery.Task,
        user_id: str,
        refresh_media_items: bool = False,
        resolution: int = 250,
        similarity_threshold: float = 0.99,
        download_original: bool = False,
        image_store_path: Optional[str] = None,
        chunk_size: Optional[int] = None,
        logger: logging.Logger = logging,
    ):
        self.task = task
        self.user_id = user_id
        self.refresh_media_items = refresh_media_items
        self.resolution = resolution
        self.similarity_threshold = similarity_threshold
        self.download_original = download_original
        self.image_store_path = image_store_path
        self.chunk_size = chunk_size
        self.logger = logger

        # Initialize meta structure
        self.meta = {"logMessage": None}
        self.meta["steps"] = {
            step: {"startedAt": None, "completedAt": None} for step in Steps.all
        }

        # Initialize subtasks structure for async results
        self.fetched_media_item_ids: list[dict] = []
        self.subtasks: list[Subtask] = []

    def run(self):
        self.start_step(Steps.FETCH_MEDIA_ITEMS)
        try:
            client = GooglePhotosClient.from_user_id(
                self.user_id,
                logger=self.logger,
            )
        except ValueError as e:
            self.logger.error("No credentials for user %s: %s", self.user_id, e)
            self.update_meta(log_message="No credentials found; please re-authorize the app")
            return {"error": "no_credentials", "user_id": self.user_id}

        try:
            if self.refresh_media_items or client.local_media_items_count() == 0:
                # Create mongo indexes if they haven't been created yet
                MediaItemsRepository.create_indexes()
                self._fetch_media_items(client)
                self._await_subtask_completion()
        except Exception as e:
            # If a subtask failed due to insufficient scopes, return a clear result
            from app.lib.google_api_client import InsufficientScopesError

            if isinstance(e, InsufficientScopesError):
                self.logger.error(
                    "Insufficient authentication scopes for user %s", self.user_id
                )
                self.update_meta(log_message="Insufficient scopes; ask user to re-authorize")
                return {
                    "error": "insufficient_scopes",
                    "user_id": self.user_id,
                    "scopes": getattr(client.credentials_obj, "scopes", None),
                }
            # Re-raise other exceptions
            raise

        media_items_count = client.local_media_items_count()
        self.complete_step(Steps.FETCH_MEDIA_ITEMS, count=media_items_count)
        self.start_step(Steps.PROCESS_DUPLICATES)

        # Determine default chunk size if not set
        if not self.chunk_size:
            # Default to 500 items per chunk for reasonable memory usage
            self.chunk_size = app.config.CHUNK_SIZE_DEFAULT if hasattr(app.config, "CHUNK_SIZE_DEFAULT") else 500

        self.logger.info(
            f"Processing duplicates for {media_items_count:,} media items..."
        )

        media_items = list(client.get_local_media_items())

        # Skip videos for now. We don't get video length from metadata and size
        #   is not a good enough indicator of similarity; treat items as photos
        #   unless they explicitly contain 'video' metadata.
        media_items = list(filter(lambda m: "video" not in m.get("mediaMetadata", {}), media_items))

        # If a chunk_size is provided, process embeddings in chunks to avoid
        # storing the entire library at once. Otherwise, use the existing
        # embedding flow.
        if self.chunk_size:
            similarity_map = self._chunked_similarity_map(media_items)
            groups = self._groups_from_similarity_map(similarity_map, media_items)
        else:
            duplicate_detector = DuplicateImageDetector(
                media_items,
                logger=self.logger,
                threshold=self.similarity_threshold,
            )
            similarity_map = duplicate_detector.calculate_similarity_map()
            groups = duplicate_detector.calculate_groups()

        result = {
            "similarityMap": similarity_map,
            "groups": [],
        }

        for group_index, media_item_indices in enumerate(groups):
            group_media_items = [media_items[i] for i in media_item_indices]

            group_dimensions = [
                int(m["mediaMetadata"]["width"]) * int(m["mediaMetadata"]["height"])
                for m in group_media_items
            ]

            # Choose the media item with largest dimensions as the original
            #   (we don't get created/uploaded times from the AP).
            largest = group_dimensions.index(max(group_dimensions))
            original_media_item_id = group_media_items[largest]["id"]

            result["groups"].append(
                {
                    "id": str(group_index),
                    "mediaItemIds": [m["id"] for m in group_media_items],
                    "originalMediaItemId": original_media_item_id,
                }
            )

        self.complete_step(Steps.PROCESS_DUPLICATES, count=len(result["groups"]))

        return result

    def _chunked_similarity_map(self, media_items: list[dict]) -> dict:
        """Compute similarity map by processing images in chunks and comparing
        embeddings across chunk pairs to limit memory usage."""
        import numpy as np
        import json
        import shutil

        task_id = getattr(self.task, "request", None)
        task_id = getattr(task_id, "id", None) or str(time.time_ns())
        embeddings_dir = os.path.join(app.config.TEMP_PATH, f"embeddings-{task_id}")
        os.makedirs(embeddings_dir, exist_ok=True)

        chunk_paths = []  # list of (chunk_index, ids_path, emb_path)
        total_chunks = (len(media_items) + self.chunk_size - 1) // self.chunk_size

        # Partition media_items into chunks
        for idx in range(0, len(media_items), self.chunk_size):
            chunk = media_items[idx : idx + self.chunk_size]
            chunk_index = idx // self.chunk_size
            
            self.logger.info(
                f"Processing chunk {chunk_index + 1}/{total_chunks} "
                f"({len(chunk)} items)"
            )
            self.update_meta(
                log_message=f"Processing chunk {chunk_index + 1}/{total_chunks} "
                           f"({len(chunk)} items)"
            )

            # Create a temporary directory for this chunk's images
            images_dir = os.path.join(embeddings_dir, f"chunk-{chunk_index}-images")
            os.makedirs(images_dir, exist_ok=True)

            # Use MediaItemsImageStore to store images to images_dir
            image_store = MediaItemsImageStore(
                resolution=self.resolution,
                base_path=images_dir,
                download_original=self.download_original,
            )

            # Store images and set storageFilename on media items
            stored_chunk = []
            for m in chunk:
                try:
                    filename = image_store.store_image(m)
                    # Clone media item dict so we don't mutate original
                    mi = dict(m)
                    mi["storageFilename"] = filename
                    stored_chunk.append(mi)
                except Exception as e:
                    self.logger.warning("Failed to store image for media_item %s: %s", m.get("id"), e)
                    continue

            if len(stored_chunk) == 0:
                continue

            # Compute embeddings for this chunk
            detector = DuplicateImageDetector(stored_chunk, logger=self.logger, threshold=self.similarity_threshold, image_store=image_store)
            detector._calculate_embeddings()

            # Save embeddings to disk as numpy for later pairwise comparison
            emb_np = detector.embeddings.numpy()
            emb_path = os.path.join(embeddings_dir, f"chunk-{chunk_index}-embeddings.npy")
            np.save(emb_path, emb_np)

            # Save media ids mapping
            ids_path = os.path.join(embeddings_dir, f"chunk-{chunk_index}-ids.json")
            with open(ids_path, "w") as f:
                json.dump([m["id"] for m in stored_chunk], f)

            # Optionally delete images to save disk (we keep embeddings)
            try:
                shutil.rmtree(images_dir)
            except Exception:
                pass

            chunk_paths.append((chunk_index, ids_path, emb_path))

        # Now compute pairwise similarities across chunk pairs
        from collections import defaultdict

        similarity_map = defaultdict(dict)
        total_comparisons = len(chunk_paths) * (len(chunk_paths) + 1) // 2
        comparison_count = 0
        
        self.logger.info(
            f"Computing pairwise similarities across {len(chunk_paths)} chunks "
            f"({total_comparisons} comparisons)"
        )
        self.update_meta(
            log_message=f"Computing similarities: {len(chunk_paths)} chunks, "
                       f"{total_comparisons} comparisons"
        )

        for i, ids_i_path, emb_i_path in chunk_paths:
            ids_i = json.load(open(ids_i_path))
            # Use memory mapping for large embeddings to reduce memory usage
            emb_i = np.load(emb_i_path, mmap_mode='r')
            # Normalize emb_i (create a copy for normalization to avoid modifying mmap)
            emb_i_norm = emb_i / np.linalg.norm(emb_i, axis=1, keepdims=True)

            for j, ids_j_path, emb_j_path in chunk_paths:
                # Only compute j >= i to avoid duplicating work
                if j < i:
                    continue
                
                comparison_count += 1
                progress_pct = int((comparison_count / total_comparisons) * 100)
                self.logger.info(
                    f"Comparing chunks {i} vs {j} ({comparison_count}/{total_comparisons}, {progress_pct}%)"
                )
                self.update_meta(
                    log_message=f"Comparing chunks: {comparison_count}/{total_comparisons} ({progress_pct}%)"
                )
                
                ids_j = json.load(open(ids_j_path))
                # Use memory mapping for large embeddings
                emb_j = np.load(emb_j_path, mmap_mode='r')
                emb_j_norm = emb_j / np.linalg.norm(emb_j, axis=1, keepdims=True)

                # Vectorized cosine similarity computation
                scores = emb_i_norm @ emb_j_norm.T

                # Use vectorized operations to find pairs above threshold
                # This is much faster than nested loops
                above_threshold = scores >= self.similarity_threshold
                
                # Get indices where similarity is above threshold
                a_indices, b_indices = np.where(above_threshold)
                
                # Filter out self-comparisons in same chunk
                if i == j:
                    mask = a_indices != b_indices
                    a_indices = a_indices[mask]
                    b_indices = b_indices[mask]
                
                # Add pairs to similarity map
                for a_ind, b_ind in zip(a_indices, b_indices):
                    id_a = ids_i[a_ind]
                    id_b = ids_j[b_ind]
                    score = float(scores[a_ind, b_ind])
                    similarity_map[id_a][id_b] = score
                    similarity_map[id_b][id_a] = score

        # Cleanup embeddings if desired
        try:
            shutil.rmtree(embeddings_dir)
        except Exception:
            pass

        return dict(similarity_map)

    def _groups_from_similarity_map(self, similarity_map: dict, media_items: list[dict]) -> list:
        """Generate groups (connected components) from the similarity map.

        Returns a list of groups where each group is a list of indices into `media_items`.
        This keeps the output consistent with `DuplicateImageDetector.calculate_groups`.
        """
        # Union-Find (Disjoint Set) to build connected components
        parent = {}

        def find(x):
            parent.setdefault(x, x)
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        # Map media ids to indices
        media_id_to_index = {m["id"]: idx for idx, m in enumerate(media_items)}

        for a, neigh in similarity_map.items():
            if a not in media_id_to_index:
                continue
            for b in neigh.keys():
                if b not in media_id_to_index:
                    continue
                union(media_id_to_index[a], media_id_to_index[b])

        groups_map = {}
        for node in parent.keys():
            root = find(node)
            groups_map.setdefault(root, []).append(node)

        # Filter groups with at least 2 members and return lists of indices
        groups = []
        for group_indices in groups_map.values():
            if len(group_indices) < 2:
                continue
            groups.append(sorted(group_indices))

        return groups

    # Celery's `update_state` method overwrites the `info`/`meta` field.
    #   Store our own local meta so we don't have to read it from Redis for
    #   every update
    def update_meta(
        self,
        log_message=None,
        start_step_name=None,
        complete_step_name=None,
        count=None,
    ):
        """
        Update local meta, then call celery method to update task state.
        """
        if log_message:
            self.meta["logMessage"] = log_message

        now = datetime.datetime.now().astimezone().isoformat()
        if start_step_name:
            self.meta["steps"][start_step_name]["startedAt"] = now
            if count:
                self.meta["steps"][start_step_name]["count"] = count
        if complete_step_name:
            self.meta["steps"][complete_step_name]["completedAt"] = now
            if count:
                self.meta["steps"][complete_step_name]["count"] = count

        self.task.update_state(
            # If we don't pass a state, it gets updated to blank.
            # Let's use PROGRESS to differentiate from PENDING.
            state="PROGRESS",
            # `meta` field comes through as the `info` field on task async result.
            meta={"meta": self.meta},
        )

    def get_meta(self):
        return copy.deepcopy(self.meta)

    def start_step(self, step):
        self.update_meta(start_step_name=step)

    def complete_step(self, step, count=None):
        self.update_meta(complete_step_name=step, count=count)

    def _fetch_media_items(self, client: GooglePhotosClient):
        def fetch_callback(media_item_json):
            self.fetched_media_item_ids.append(media_item_json["id"])
            if len(self.fetched_media_item_ids) >= self.SUBTASK_BATCH_SIZE:
                self._postprocess_fetched_media_items()

        # Fetch media items, passing success callback
        client.fetch_media_items(callback=fetch_callback)

        # Fetch any remaining media items
        self._postprocess_fetched_media_items()

    def _postprocess_fetched_media_items(self):
        media_item_ids = self.fetched_media_item_ids
        if len(media_item_ids) == 0:
            return

        # When chunked processing is enabled, we'll not schedule the usual
        # store_images subtasks for the full dataset upfront. Chunked
        # processing stores images per-chunk in temporary directories.
        if self.chunk_size:
            # Just record fetched ids; chunked stage will handle storing
            # and processing later.
            self.subtasks.append(Subtask(Subtask.Type.STORE_IMAGES, None))
        else:
            import app.tasks
            store_images_result = app.tasks.store_images.delay(
                self.user_id,
                media_item_ids,
                self.resolution,
                download_original=self.download_original,
                image_store_path=self.image_store_path,
                chunk_size=self.chunk_size,
            )
            self.subtasks.append(Subtask(Subtask.Type.STORE_IMAGES, store_images_result))

        self.fetched_media_item_ids = []

        self.fetched_media_item_ids = []

    def _await_subtask_completion(self):
        """
        Wait for all subtasks to complete.
        """
        # If chunked processing is enabled, we don't create actual store image
        # subtasks for the whole dataset; skip waiting in that case.
        if self.chunk_size:
            return

        while True:
            subtask_classes = {s.type.name for s in self.subtasks}
            subtask_results = [s.result for s in self.subtasks]
            num_completed = [r.ready() for r in subtask_results].count(True)
            num_successful = [r.successful() for r in subtask_results].count(True)
            failed_subtasks = [s for s in self.subtasks if s.result.failed()]
            num_failed = len(failed_subtasks)
            num_total = len(self.subtasks)

            if num_failed > 0:
                self.logger.error(f"{num_failed} subtasks failed")
                subtask_errors = [
                    s.result.get(disable_sync_subtasks=False, propagate=False)
                    for s in failed_subtasks
                ]
                from app.lib.google_api_client import InsufficientScopesError

                if any(
                    isinstance(e, InsufficientScopesError)
                    for e in subtask_errors
                ):
                    # If any subtask failed due to insufficient scopes, surface that
                    self.logger.error("Subtask failed due to insufficient scopes")
                    raise InsufficientScopesError("One or more subtasks failed due to insufficient authentication scopes")

                if any(
                    isinstance(e, requests.exceptions.HTTPError)
                    and "429 Client Error" in str(e)
                    for e in subtask_errors
                ):
                    raise DailyLimitExceededError(
                        f"Successfully completed {num_successful} of {num_completed} "
                        f"subtasks to store images before exceeding daily baseUrl "
                        f"request quota. Restart tomorrow to resume. "
                        f"For more details on quota usage, visit "
                        f"https://console.cloud.google.com/apis/api/photoslibrary.googleapis.com/quotas"
                    )
                else:
                    raise SubtasksFailedError(
                        f"{num_failed} of {num_total} subtasks failed. "
                        f"View {app.config.CELERY_WORKER_LOG_PATH} for more details. "
                        f"Restart to try again."
                    )

            if num_completed == num_total:
                # All done.
                break
            else:
                message = (
                    f"Waiting for {', '.join(subtask_classes)} subtasks to complete... "
                    f"({num_completed} / {num_total})"
                )
                self.logger.info(message)
                time.sleep(app.config.PROCESS_DUPLICATE_SUBTASK_POLL_INTERVAL)
