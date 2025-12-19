import logging
import os
import queue
import time
import numpy as np

import requests
from tqdm import trange

from typing import Optional

from app.lib.media_items_image_store import MediaItemsImageStore
from app import config

# Heavy dependencies (torch, mediapipe) are imported lazily inside
# `_calculate_embeddings` so unit tests and other parts of the code can
# import this module without requiring the full ML stack at import time.


class DuplicateImageDetector:
    """
    Uses https://developers.google.com/mediapipe to calculate image
    embeddings and compute cosine similarities
    """

    MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_large/float32/latest/mobilenet_v3_large.tflite"

    def __init__(
        self,
        media_items: list[dict],
        threshold: float = 0.99,
        logger=logging.getLogger(),
        image_store: Optional[MediaItemsImageStore] = None,
    ):
        self.media_items = media_items
        self.threshold = threshold
        self.logger = logger
        self.image_store = image_store or MediaItemsImageStore()
        # Embeddings will be a torch.Tensor when computed; keep untyped to avoid
        # requiring torch at module import time in test environments.
        self.embeddings = None

    def calculate_groups(self):
        embeddings = self._calculate_embeddings()

        start = time.perf_counter()
        # Two parameters to tune:
        #   min_community_size: Only consider cluster that have at least 2 elements
        #   threshold: Consider sentence pairs with a cosine-similarity larger than threshold as similar
        groups = self._community_detection(
            embeddings,
            min_community_size=2,
            threshold=self.threshold,
        )
        self.logger.info(
            f"Calculated groups in {(time.perf_counter() - start):.2f} seconds"
        )

        return groups

    def calculate_similarity_map(self):
        embeddings = self._calculate_embeddings()

        # Contains a list with triplets (score, image_index1, image_index2) and
        # is sorted in decreasing order by score
        start = time.perf_counter()
        similarity_scores = self._paraphrase_mining_embeddings(embeddings)
        self.logger.info(
            f"Calculated similarity map in {(time.perf_counter() - start):.2f} seconds"
        )

        # Convert these into a dict of dict[image_id1][image_id2] = score
        similarity_map = {}
        for score, image_index1, image_index2 in similarity_scores:
            if score >= self.threshold:
                image_id1 = self.media_items[image_index1]["id"]
                image_id2 = self.media_items[image_index2]["id"]
                if image_id1 not in similarity_map:
                    similarity_map[image_id1] = {}
                similarity_map[image_id1][image_id2] = score
                if image_id2 not in similarity_map:
                    similarity_map[image_id2] = {}
                similarity_map[image_id2][image_id1] = score

        return similarity_map

    def _calculate_embeddings(self):
        if self.embeddings is not None:
            return self.embeddings

        model_path = os.path.join(config.TEMP_PATH, "mobilenet_v3_large.tflite")
        if not os.path.exists(model_path):
            self.logger.info("Downloading mediapipe model to %s", model_path)
            request = requests.get(
                self.MODEL_URL,
                timeout=20,
            )
            with open(model_path, "wb") as file:
                file.write(request.content)

        self.logger.info("Calculating embeddings for %d images", len(self.media_items))
        start = time.perf_counter()
        embeddings = []

        try:
            import mediapipe as mp
        except ImportError as error:
            raise RuntimeError(
                "mediapipe is required to calculate embeddings. "
                "Install it with `pip install mediapipe`"
            ) from error

        BaseOptions = mp.tasks.BaseOptions
        ImageEmbedder = mp.tasks.vision.ImageEmbedder
        ImageEmbedderOptions = mp.tasks.vision.ImageEmbedderOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        options = ImageEmbedderOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            l2_normalize=True,
            running_mode=VisionRunningMode.IMAGE,
        )

        with ImageEmbedder.create_from_options(options) as embedder:
            # Process images in batches to optimize memory usage
            batch_size = 32  # Process 32 images at a time
            total_batches = (len(self.media_items) + batch_size - 1) // batch_size
            for batch_idx, batch_start in enumerate(trange(0, len(self.media_items), batch_size, ascii=False)):
                batch_end = min(batch_start + batch_size, len(self.media_items))
                batch_items = self.media_items[batch_start:batch_end]
                
                # Log progress every batch
                if batch_idx % 5 == 0 or batch_idx == total_batches - 1:
                    self.logger.info(
                        f"Computing embeddings: batch {batch_idx + 1}/{total_batches} "
                        f"({batch_start + len(batch_items)}/{len(self.media_items)} images)"
                    )
                
                for media_item in batch_items:
                    storage_path = self._get_storage_path(media_item)

                    mp_image = None
                    try:
                        mp_image = mp.Image.create_from_file(storage_path)
                    except RuntimeError as error:
                        logging.warning(
                            f"Skipping invalid image file:\n"
                            f"error: {error}\n"
                            f"media_item: {media_item}\n"
                        )
                        continue
                    embedding_result = embedder.embed(mp_image)
                    embeddings.append(embedding_result.embeddings[0].embedding)
                    
                    # Explicitly delete mp_image to free memory immediately
                    del mp_image

        self.logger.info(
            f"Calculated embeddings in {(time.perf_counter() - start):.2f} seconds"
        )

        try:
            import torch
        except ImportError as error:
            raise RuntimeError(
                "torch is required to calculate embeddings. Install it with `pip install torch`"
            ) from error

        self.embeddings = torch.tensor(np.array(embeddings))
        return self.embeddings

    # From https://github.com/UKPLab/sentence-transformers/blob/a458ce79c40fef93d5ecc66931b446ea65fdd017/sentence_transformers/util.py#L346
    def _community_detection(
        self,
        embeddings,
        threshold=0.99,
        min_community_size=2,
        batch_size=128,
    ):
        """
        Function for Fast Community Detection
        Finds in the embeddings all communities, i.e. embeddings that are close (closer than threshold).
        Returns only communities that are larger than min_community_size. The communities are returned
        in decreasing order. The first element in each list is the central point in the community.
        """
        try:
            import torch
        except ImportError as error:
            raise RuntimeError(
                "torch is required for community detection. Install it with `pip install torch`"
            ) from error

        threshold = torch.tensor(threshold, device=embeddings.device)

        extracted_communities = []

        # Maximum size for community
        min_community_size = min(min_community_size, len(embeddings))
        sort_max_size = min(max(2 * min_community_size, 50), len(embeddings))

        for start_idx in range(0, len(embeddings), batch_size):
            # Compute cosine similarity scores
            cos_scores = self._cos_sim(
                embeddings[start_idx : start_idx + batch_size], embeddings
            )

            # Minimum size for a community
            top_k_values, _ = cos_scores.topk(k=min_community_size, largest=True)

            # Filter for rows >= min_threshold
            for i in range(len(top_k_values)):
                if top_k_values[i][-1] >= threshold:
                    new_cluster = []

                    # Only check top k most similar entries
                    top_val_large, top_idx_large = cos_scores[i].topk(
                        k=sort_max_size, largest=True
                    )

                    # Check if we need to increase sort_max_size
                    while top_val_large[-1] > threshold and sort_max_size < len(
                        embeddings
                    ):
                        sort_max_size = min(2 * sort_max_size, len(embeddings))
                        top_val_large, top_idx_large = cos_scores[i].topk(
                            k=sort_max_size, largest=True
                        )

                    for idx, val in zip(top_idx_large.tolist(), top_val_large):
                        if val < threshold:
                            break

                        new_cluster.append(idx)

                    extracted_communities.append(new_cluster)

            del cos_scores

        # Largest cluster first
        extracted_communities = sorted(
            extracted_communities, key=lambda x: len(x), reverse=True
        )

        # Step 2) Remove overlapping communities
        unique_communities = []
        extracted_ids = set()

        for cluster_id, community in enumerate(extracted_communities):
            community = sorted(community)
            non_overlapped_community = []
            for idx in community:
                if idx not in extracted_ids:
                    non_overlapped_community.append(idx)

            if len(non_overlapped_community) >= min_community_size:
                unique_communities.append(non_overlapped_community)
                extracted_ids.update(non_overlapped_community)

        unique_communities = sorted(
            unique_communities, key=lambda x: len(x), reverse=True
        )

        return unique_communities

    def _cos_sim(self, a, b):
        """
        Computes the cosine similarity cos_sim(a[i], b[j]) for all i and j.
        Assumes tensors have already been l2-normalized.
        :return: Matrix with res[i][j]  = cos_sim(a[i], b[j])
        """
        try:
            import torch
        except ImportError as error:
            raise RuntimeError(
                "torch is required to compute cosine similarities. Install it with `pip install torch`"
            ) from error

        return torch.mm(a, b.transpose(0, 1))

    # From https://github.com/UKPLab/sentence-transformers/blob/a458ce79c40fef93d5ecc66931b446ea65fdd017/sentence_transformers/util.py#L136
    def _paraphrase_mining_embeddings(
        self,
        embeddings,
        query_chunk_size: int = 500,
        corpus_chunk_size: int = 10000,
        max_pairs: int = 500000,
        top_k: int = 10,
    ):
        """
        Given a list of sentences / texts, this function performs paraphrase mining. It compares all sentences against all
        other sentences and returns a list with the pairs that have the highest cosine similarity score.

        :param embeddings: A tensor with the embeddings
        :param query_chunk_size: Search for most similar pairs for #query_chunk_size at the same time. Decrease, to lower memory footprint (increases run-time).
        :param corpus_chunk_size: Compare a sentence simultaneously against #corpus_chunk_size other sentences. Decrease, to lower memory footprint (increases run-time).
        :param max_pairs: Maximal number of text pairs returned.
        :param top_k: For each sentence, we retrieve up to top_k other sentences
        :param score_function: Function for computing scores. By default, cosine similarity.
        :return: Returns a list of triplets with the format [score, id1, id2]
        """

        top_k += 1  # A sentence has the highest similarity to itself. Increase +1 as we are interest in distinct pairs

        # Mine for duplicates
        pairs = queue.PriorityQueue()
        min_score = -1
        num_added = 0

        for corpus_start_idx in range(0, len(embeddings), corpus_chunk_size):
            for query_start_idx in range(0, len(embeddings), query_chunk_size):
                scores = self._cos_sim(
                    embeddings[query_start_idx : query_start_idx + query_chunk_size],
                    embeddings[corpus_start_idx : corpus_start_idx + corpus_chunk_size],
                )

                try:
                    import torch
                except ImportError as error:
                    raise RuntimeError(
                        "torch is required to perform similarity mining. Install it with `pip install torch`"
                    ) from error

                scores_top_k_values, scores_top_k_idx = torch.topk(
                    scores,
                    min(top_k, len(scores[0])),
                    dim=1,
                    largest=True,
                    sorted=False,
                )
                scores_top_k_values = scores_top_k_values.tolist()
                scores_top_k_idx = scores_top_k_idx.tolist()

                for query_itr in range(len(scores)):
                    for top_k_idx, corpus_itr in enumerate(scores_top_k_idx[query_itr]):
                        i = query_start_idx + query_itr
                        j = corpus_start_idx + corpus_itr

                        if (
                            i != j
                            and scores_top_k_values[query_itr][top_k_idx] > min_score
                        ):
                            pairs.put((scores_top_k_values[query_itr][top_k_idx], i, j))
                            num_added += 1

                            if num_added >= max_pairs:
                                entry = pairs.get()
                                min_score = entry[0]

        # Get the pairs (moved outside loops to collect all pairs)
        added_pairs = set()  # Used for duplicate detection
        pairs_list = []
        while not pairs.empty():
            score, i, j = pairs.get()
            sorted_i, sorted_j = sorted([i, j])

            if sorted_i != sorted_j and (sorted_i, sorted_j) not in added_pairs:
                added_pairs.add((sorted_i, sorted_j))
                pairs_list.append([score, i, j])

        # Highest scores first
        pairs_list = sorted(pairs_list, key=lambda x: x[0], reverse=True)
        return pairs_list

    def _get_storage_path(self, media_item) -> str:
        return self.image_store.get_storage_path(media_item["storageFilename"])
