# Development & Testing Notes 🛠️

This project contains optional, heavy dependencies used for image embedding and ML ops (MediaPipe, Torch, JAX, etc.). The test suite includes unit tests that mock heavy operations where possible, but running the full project locally may require installing all optional dependencies.

## Installing dependencies

- Recommended: create and activate a Python venv in the repo root (the repo's automation assumes `.venv`):

  python -m venv .venv
  source .venv/bin/activate
  python -m pip install --upgrade pip

- Install main requirements (this will attempt to install heavy packages like `torch`, `mediapipe`, `jax`):

  python -m pip install -r requirements.txt

If `pip install -r requirements.txt` fails (e.g., due to platform-specific `jaxlib` or other heavy native wheels), try installing only the light-weight test/runtime deps first and add heavy packages as needed:

python -m pip install pytest pytest-mock requests pymongo flask

and then install `mediapipe` / `torch` / `jax` when you run embedding-related code.

## Running tests

- To run the full test suite:

  .venv/bin/python -m pytest -q

- If you want to run only fast unit tests that don't hit heavy native libs, use focused test files (e.g., `app/test/process_duplicates_task_test.py`).

## Notes

- The embedding code (MediaPipe) and similarity calculations require `mediapipe` and `torch` respectively. These are imported lazily to avoid forcing them on all users and tests.
- If you plan to run full integrations (download model files, compute embeddings), ensure you have sufficient disk space and the appropriate native wheels for your OS/arch.

If you'd like, I can add an optional `extras_require` entry (e.g., `pip install .[ml]`) and a small script to perform an environment check (missing packages and guidance).
