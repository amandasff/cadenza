"""
OMR (Optical Music Recognition) microservice.

Accepts an image or PDF of sheet music, runs it through oemer (deep learning OMR),
and returns MusicXML. Designed to run on Railway/Render as a Docker container.

Endpoint:
  POST /recognize
    - multipart/form-data with "file" field (PNG, JPG, PDF)
    - Returns JSON: { "musicxml": "...", "success": true }
    - Or on failure: { "success": false, "error": "..." }

  GET /health
    - Returns { "status": "ok" } for health checks
"""

import os
import subprocess
import tempfile
import traceback

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "tiff", "tif", "pdf"}
MAX_FILE_SIZE = 32 * 1024 * 1024  # 32 MB


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def pdf_to_images(pdf_path: str, out_dir: str) -> list[str]:
    """Convert PDF pages to PNG images using pdftoppm (poppler-utils)."""
    prefix = os.path.join(out_dir, "page")
    subprocess.run(
        ["pdftoppm", "-png", "-r", "300", pdf_path, prefix],
        check=True,
        capture_output=True,
    )
    pages = sorted(
        [os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.startswith("page") and f.endswith(".png")]
    )
    return pages


def run_oemer(image_path: str) -> str | None:
    """Run oemer on a single image and return MusicXML content, or None on failure."""
    result = subprocess.run(
        ["oemer", image_path],
        capture_output=True,
        text=True,
        timeout=300,  # 5 minute max per page
    )

    # oemer outputs .musicxml next to the input file
    base = os.path.splitext(image_path)[0]
    xml_path = base + ".musicxml"

    if os.path.exists(xml_path):
        with open(xml_path, "r", encoding="utf-8") as f:
            return f.read()

    # Some versions of oemer output to a different location
    # Check for any .musicxml in the same directory
    directory = os.path.dirname(image_path)
    for fname in os.listdir(directory):
        if fname.endswith(".musicxml"):
            with open(os.path.join(directory, fname), "r", encoding="utf-8") as f:
                return f.read()

    return None


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/recognize", methods=["POST"])
def recognize():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"success": False, "error": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    if file.content_length and file.content_length > MAX_FILE_SIZE:
        return jsonify({"success": False, "error": "File too large (max 32 MB)"}), 400

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            filename = secure_filename(file.filename)
            filepath = os.path.join(tmpdir, filename)
            file.save(filepath)

            ext = filename.rsplit(".", 1)[1].lower()

            if ext == "pdf":
                # Convert PDF to images, process each page
                pages = pdf_to_images(filepath, tmpdir)
                if not pages:
                    return jsonify({"success": False, "error": "Could not extract pages from PDF"}), 400

                # Process first page (most common case: single-page sheet music)
                # For multi-page, we'd need to merge MusicXML — complex, so start with page 1
                musicxml = run_oemer(pages[0])
                page_count = len(pages)
            else:
                musicxml = run_oemer(filepath)
                page_count = 1

            if not musicxml:
                return jsonify({"success": False, "error": "OMR engine could not extract notation from this image"}), 422

            return jsonify({
                "success": True,
                "musicxml": musicxml,
                "pages_processed": 1,
                "pages_total": page_count,
            })

    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Processing timed out (>5 minutes)"}), 504
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
