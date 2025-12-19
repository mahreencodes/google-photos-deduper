# Dedup Workflow & Architecture 🔍

This document explains how Google Photos Deduper identifies duplicate images, how the chunked processing works, and how images are stored.

## High-level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Photos Deduper                        │
│                                                                  │
│  1. Fetch Media Items                                            │
│     └─> Google Photos API → MongoDB (metadata storage)         │
│                                                                  │
│  2. Download Images (optional, per chunk if chunked)            │
│     └─> Google Photos API → Local filesystem                    │
│                                                                  │
│  3. Generate Embeddings                                          │
│     └─> MediaPipe ImageEmbedder (MobileNet V3)                  │
│         → Fixed-length vector embeddings (L2-normalized)        │
│                                                                  │
│  4. Compute Similarities                                        │
│     └─> Cosine similarity between all pairs                      │
│         → Similarity map (id → id → score)                      │
│                                                                  │
│  5. Cluster Duplicates                                           │
│     └─> Connected components (Union-Find)                      │
│         → Groups of similar images                              │
│                                                                  │
│  6. Select Originals                                            │
│     └─> Largest dimensions per group → Original candidate       │
│                                                                  │
│  7. User Review & Deletion                                       │
│     └─> UI presents groups → Chrome extension deletes           │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Workflow

### Step 1: Fetch Media Items
```
Google Photos API
      │
      ├─> List all media items (paginated)
      │
      └─> Store metadata in MongoDB
          ├─> Media item ID
          ├─> Filename
          ├─> Dimensions (width × height)
          ├─> Base URL (for downloading)
          └─> Other metadata
```

### Step 2: Image Download & Storage

**Non-chunked mode:**
```
For each media item:
  ├─> Download image (250×250px thumbnail by default)
  ├─> Store to: {IMAGE_STORE_PATH}/{media_item_id}-{resolution}.jpg
  └─> Set storageFilename on media item
```

**Chunked mode:**
```
For each chunk:
  ├─> Create temp directory: {TEMP_PATH}/embeddings-{task_id}/chunk-{N}-images/
  ├─> Download images for chunk only
  ├─> Compute embeddings
  ├─> Save embeddings to disk: chunk-{N}-embeddings.npy
  ├─> Save IDs mapping: chunk-{N}-ids.json
  └─> Delete images (keep embeddings)
```

### Step 3: Embedding Generation

```
┌─────────────────────────────────────────────────────────────┐
│  MediaPipe ImageEmbedder (MobileNet V3 Large)                │
│                                                               │
│  Input: Image file (JPEG)                                    │
│    │                                                          │
│    ├─> Preprocessing                                         │
│    │   └─> Resize, normalize                                 │
│    │                                                          │
│    ├─> MobileNet V3 Feature Extraction                       │
│    │   └─> Deep convolutional network                        │
│    │                                                          │
│    └─> Output: 1024-dimensional vector                       │
│        └─> L2-normalized (unit vector)                      │
└─────────────────────────────────────────────────────────────┘

Memory Optimization:
  - Process images in batches of 32
  - Explicitly free image memory after embedding
  - Use memory-mapped arrays for large embeddings (chunked mode)
```

### Step 4: Similarity Computation

**Non-chunked mode:**
```
All embeddings in memory (torch.Tensor)
      │
      ├─> Compute cosine similarity matrix
      │   └─> cos_sim = embeddings @ embeddings.T
      │       (since embeddings are L2-normalized)
      │
      └─> Extract pairs above threshold (≥0.99 default)
          └─> Similarity map: {id1: {id2: score, ...}, ...}
```

**Chunked mode (optimized):**
```
┌─────────────────────────────────────────────────────────────┐
│  Chunked Pairwise Comparison                                │
│                                                              │
│  Chunk 0 ──┐                                                │
│  Chunk 1 ──┤                                                │
│  Chunk 2 ──┼──> Compare all chunk pairs (i, j) where j≥i   │
│  Chunk 3 ──┤     └─> Vectorized: emb_i @ emb_j.T          │
│  ...       ┘     └─> Use numpy.where() for threshold      │
│                     └─> Memory-mapped arrays (mmap_mode='r')│
└─────────────────────────────────────────────────────────────┘

Example with 3 chunks:
  Comparisons: (0,0), (0,1), (0,2), (1,1), (1,2), (2,2)
  Total: 6 comparisons (n*(n+1)/2 for n=3)
```

### Step 5: Clustering (Group Detection)

```
Similarity Map (id → id → score)
      │
      ├─> Union-Find (Disjoint Set Union)
      │   └─> Connect all pairs with similarity ≥ threshold
      │
      └─> Connected Components
          └─> Each component = one duplicate group

Example:
  Similarity pairs: (A,B), (B,C), (D,E)
  Groups: [A, B, C], [D, E]
```

### Step 6: Original Selection

```
For each group:
  ├─> Calculate dimensions for each image
  │   └─> width × height (pixels)
  │
  └─> Select image with largest dimensions
      └─> Marked as "original" (others are duplicates)
```

## Chunked Processing Deep Dive

### Why Chunking?

For large libraries (10,000+ images), processing everything at once can:
- **Memory**: Require 10GB+ RAM for embeddings alone
- **Disk**: Store thousands of images simultaneously
- **Time**: Long-running processes risk interruption

### Chunked Processing Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: Chunk Processing                                   │
│                                                               │
│  Media Items [1..N]                                           │
│      │                                                        │
│      ├─> Split into chunks of size `chunk_size` (default 500)│
│      │                                                        │
│      Chunk 0: [1..500]    ──┐                                │
│      Chunk 1: [501..1000] ──┤                                │
│      Chunk 2: [1001..1500] ──┼──> For each chunk:            │
│      ...                      │   ├─> Download images        │
│                               │   ├─> Compute embeddings     │
│                               │   ├─> Save to disk (.npy)   │
│                               │   └─> Delete images          │
│                               ┘                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Phase 2: Cross-Chunk Comparison                             │
│                                                               │
│  Load embeddings from disk (memory-mapped)                    │
│      │                                                        │
│      ├─> Compare chunk pairs (i, j) where j ≥ i              │
│      │   └─> Vectorized cosine similarity                    │
│      │       └─> emb_i_norm @ emb_j_norm.T                  │
│      │                                                        │
│      └─> Build similarity map incrementally                   │
│          └─> Only pairs above threshold stored               │
└──────────────────────────────────────────────────────────────┘

Memory Benefits:
  - Peak memory: O(chunk_size × embedding_dim) instead of O(N × embedding_dim)
  - Example: 10,000 images, 500 per chunk
    - Non-chunked: ~40MB embeddings in memory
    - Chunked: ~2MB embeddings in memory (20× reduction)
```

### Performance Optimizations

1. **Vectorized Operations**: Use numpy matrix multiplication instead of nested loops
2. **Memory Mapping**: Load embeddings with `mmap_mode='r'` to avoid full memory load
3. **Batch Processing**: Process embeddings in batches during generation
4. **Early Cleanup**: Delete images immediately after embedding computation
5. **Progress Tracking**: Log chunk progress for user visibility

## Image Storage Options

### Resolution Control
- **Default**: 250×250px thumbnails (fast, low bandwidth)
- **Original**: Full resolution (slower, higher quality embeddings)

### Storage Location
- **Default**: `{IMAGE_STORE_PATH}` (configurable via env var)
- **Custom**: `image_store_path` task option (e.g., external drive)

### File Naming
```
{media_item_id}-{resolution}.jpg    # Thumbnail
{media_item_id}-original.jpg         # Original (if download_original=true)
```

## Embeddings & Matching Algorithm

### Embedding Model
- **Model**: MediaPipe ImageEmbedder (MobileNet V3 Large)
- **Output Dimension**: 1024
- **Normalization**: L2-normalized (unit vectors)
- **Download**: Auto-downloads from Google Cloud Storage if missing

### Similarity Metric
```
Cosine Similarity = (A · B) / (||A|| × ||B||)

Since embeddings are L2-normalized:
  Cosine Similarity = A · B  (dot product)

Range: [-1, 1]
  - 1.0 = Identical
  - 0.99 = Very similar (default threshold)
  - 0.0 = Unrelated
```

### Clustering Algorithm

**Non-chunked**: Fast community detection
- Uses top-k similarity search
- Extracts communities with min_community_size=2
- Removes overlapping communities

**Chunked**: Union-Find (Disjoint Set Union)
```
Algorithm:
  1. Initialize: parent[i] = i for all images
  2. For each pair (i, j) with similarity ≥ threshold:
       union(i, j)
  3. Find connected components
  4. Filter groups with size ≥ 2
```

## Error Cases & Re-authentication

### Insufficient Scopes
```
Error: "insufficient_scopes"
  ├─> Task returns structured error
  ├─> Server exposes /api/credentials endpoint
  └─> UI shows Credentials Diagnostics panel
      └─> Guides user to re-authorize
```

### Rate Limiting
- **429 Errors**: Automatic retry with exponential backoff
- **Daily Quota**: Task fails gracefully with clear message

### Image Download Failures
- **Retry Logic**: 3 attempts with configurable delays
- **Skip on Failure**: Continue processing other images

## Performance Characteristics

### Time Complexity
- **Embedding Generation**: O(N) where N = number of images
- **Similarity Computation**: O(N²) in worst case, but optimized with:
  - Chunking: O((N/C)² × C²) = O(N²) but with lower constant factors
  - Top-k pruning: Reduces comparisons
- **Clustering**: O(N × α(N)) where α is inverse Ackermann (Union-Find)

### Space Complexity
- **Non-chunked**: O(N × D) where D = embedding dimension (1024)
- **Chunked**: O(C × D) where C = chunk_size (typically 500)

### Typical Performance
- **Small library** (<1,000 images): ~2-5 minutes
- **Medium library** (1,000-10,000 images): ~10-30 minutes
- **Large library** (10,000+ images): ~1-3 hours (chunked mode recommended)

---

## Future Enhancements

- **Persistent Embeddings**: Option to save embeddings for resume/audit
- **Incremental Processing**: Only process new images since last run
- **GPU Acceleration**: Optional GPU support for faster embedding computation
- **Parallel Chunk Processing**: Process multiple chunks concurrently
