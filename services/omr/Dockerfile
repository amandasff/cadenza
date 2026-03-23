FROM python:3.11-slim

# Install system dependencies:
# - poppler-utils for PDF → PNG conversion (pdftoppm)
# - libgl1 + libglib2 for OpenCV (oemer dependency)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download oemer models so first request isn't slow
RUN python -c "from oemer import MODULE_PATH; print('Models ready at', MODULE_PATH)" 2>/dev/null || true

COPY app.py .

# Railway sets PORT env var automatically
ENV PORT=5000
EXPOSE 5000

# Use gunicorn with extended timeout for long OMR processing
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--timeout", "600", "--workers", "2"]
