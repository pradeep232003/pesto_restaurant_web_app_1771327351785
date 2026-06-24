"""
Documents module — per-location file storage for JKHive.

Files are stored in MongoDB GridFS so they survive container redeploys
without needing any external blob storage (S3 etc.). Metadata lives in a
companion `documents` collection so listing/filtering stays fast.

Endpoints (all under /api/admin/documents):
  GET    /                — list metadata for a site, newest first
  POST   /upload          — multipart upload (file + title + category)
  GET    /{id}/file       — stream the file (for inline preview + download)
  DELETE /{id}            — remove file + metadata (admin only)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

import gridfs
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from auth import get_admin_user, get_staff_or_above
from db import db

router = APIRouter(prefix="/api/admin/documents", tags=["documents"])

# GridFS bucket. Lazily reuse the same db handle from db.py.
_fs = gridfs.GridFS(db, collection="documents_files")
documents = db["documents"]

# Sensible defaults — most policy / certificate PDFs are well under this.
MAX_BYTES = 25 * 1024 * 1024  # 25 MB hard cap

# Categories surfaced in the UI's quick filter; arbitrary strings are still
# accepted on upload so admins can invent new ones.
DEFAULT_CATEGORIES = [
    "Policies", "Certificates", "Training", "Risk Assessments",
    "Suppliers", "HACCP", "Other",
]


def _doc_to_dict(d: dict) -> dict:
    """Strip internal Mongo fields from a document record before returning."""
    out = {k: v for k, v in d.items() if k != "_id"}
    # GridFS id is stored as ObjectId — clients only need it as a string.
    if "file_id" in out and isinstance(out["file_id"], ObjectId):
        out["file_id"] = str(out["file_id"])
    return out


@router.get("/categories")
async def list_categories(user: dict = Depends(get_staff_or_above)):
    """Return the default categories merged with any custom ones the site has used."""
    custom = sorted(set(documents.distinct("category")))
    merged = list(dict.fromkeys([*DEFAULT_CATEGORIES, *[c for c in custom if c]]))
    return {"categories": merged}


@router.get("")
async def list_documents(
    location_id: str = Query(...),
    category: Optional[str] = Query(None),
    user: dict = Depends(get_staff_or_above),
):
    q: dict = {"location_id": location_id}
    if category:
        q["category"] = category
    rows = list(documents.find(q, {"_id": 0}).sort("uploaded_at", -1).limit(500))
    # Stringify any lingering ObjectIds (file_id is stored as ObjectId in GridFS).
    for r in rows:
        if "file_id" in r and isinstance(r["file_id"], ObjectId):
            r["file_id"] = str(r["file_id"])
    return rows


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    location_id: str = Form(...),
    title: str = Form(...),
    category: str = Form("Other"),
    user: dict = Depends(get_staff_or_above),
):
    title = (title or "").strip() or file.filename or "Untitled"
    category = (category or "Other").strip() or "Other"

    # Stream the upload into GridFS to keep memory flat. We rely on FastAPI's
    # SpooledTemporaryFile under the hood (`file.file`).
    content_type = file.content_type or "application/octet-stream"

    # Enforce size cap before we commit anything to GridFS.
    # `file.read()` loads into memory — that's acceptable at 25 MB ceiling.
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file")
    if len(blob) > MAX_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit")

    file_id = _fs.put(
        blob,
        filename=file.filename or title,
        content_type=content_type,
        metadata={"location_id": location_id, "title": title, "category": category},
    )

    doc = {
        "id": str(uuid.uuid4())[:12],
        "location_id": location_id,
        "title": title,
        "category": category,
        "filename": file.filename or title,
        "content_type": content_type,
        "size": len(blob),
        "file_id": str(file_id),  # store as string for JSON safety
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user.get("email", ""),
        "uploaded_by_name": user.get("name", ""),
    }
    documents.insert_one(dict(doc))
    return _doc_to_dict(doc)


@router.get("/{doc_id}/file")
async def download_document(doc_id: str, user: dict = Depends(get_staff_or_above)):
    rec = documents.find_one({"id": doc_id})
    if not rec:
        raise HTTPException(404, "Not found")
    try:
        gridfs_id = rec["file_id"]
        if not isinstance(gridfs_id, ObjectId):
            gridfs_id = ObjectId(gridfs_id)
        gridout = _fs.get(gridfs_id)
    except Exception:
        raise HTTPException(404, "File missing in GridFS")

    headers = {
        # `inline` lets the browser preview PDFs / images in an <iframe>/<img>.
        "Content-Disposition": f'inline; filename="{rec.get("filename", "file")}"',
        "Cache-Control": "private, max-age=300",
    }
    return StreamingResponse(
        gridout,
        media_type=rec.get("content_type", "application/octet-stream"),
        headers=headers,
    )


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_admin_user)):
    rec = documents.find_one({"id": doc_id})
    if not rec:
        raise HTTPException(404, "Not found")
    try:
        gridfs_id = rec["file_id"]
        if not isinstance(gridfs_id, ObjectId):
            gridfs_id = ObjectId(gridfs_id)
        _fs.delete(gridfs_id)
    except Exception:
        pass  # tolerate orphan GridFS; we still want the metadata gone
    documents.delete_one({"id": doc_id})
    return {"deleted": True}
