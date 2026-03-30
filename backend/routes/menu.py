from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from typing import Optional
from datetime import datetime, timezone
import uuid
import base64
import io
from PIL import Image as PILImage

from db import menu_items_collection, images_collection
from auth import get_admin_user
from models import MenuItemCreate, MenuItemUpdate
from helpers import serialize_doc

router = APIRouter(tags=["menu"])


# ============== PUBLIC MENU ENDPOINTS ==============

@router.get("/api/menu-items")
async def get_menu_items(location_id: Optional[str] = None, category: Optional[str] = None):
    """Get menu items, optionally filtered by location and category"""
    query = {"is_available": True}
    if location_id:
        query["location_id"] = location_id
    if category and category != "all":
        query["$or"] = [{"category": category}, {"categories": category}]
    items = list(menu_items_collection.find(query).sort("name", 1))
    return [serialize_doc(item) for item in items]


@router.get("/api/menu-items/{item_id}")
async def get_menu_item(item_id: str):
    """Get a single menu item by ID"""
    item = menu_items_collection.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return serialize_doc(item)


@router.get("/api/featured-items")
async def get_featured_items(location_id: Optional[str] = None, limit: int = 8):
    """Get featured menu items"""
    query = {"is_available": True, "featured": True}
    if location_id:
        query["location_id"] = location_id
    items = list(menu_items_collection.find(query).limit(limit))
    return [serialize_doc(item) for item in items]


# ============== ADMIN MENU CRUD ==============

@router.get("/api/admin/menu-items")
async def admin_get_menu_items(location_id: Optional[str] = None, user: dict = Depends(get_admin_user)):
    """Admin: Get all menu items (including unavailable) for a location"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    items = list(menu_items_collection.find(query).sort("name", 1))
    return [serialize_doc(item) for item in items]


@router.post("/api/admin/menu-items", status_code=201)
async def admin_create_menu_item(item: MenuItemCreate, user: dict = Depends(get_admin_user)):
    """Admin: Create a new menu item"""
    item_id = str(uuid.uuid4())[:8]
    item_dict = item.model_dump()
    item_dict["id"] = item_id
    item_dict["rating"] = 4.0
    item_dict["review_count"] = 0
    item_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    result = menu_items_collection.insert_one(item_dict)
    created_item = menu_items_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created_item)


@router.put("/api/admin/menu-items/{item_id}")
async def admin_update_menu_item(item_id: str, item: MenuItemUpdate, user: dict = Depends(get_admin_user)):
    """Admin: Update an existing menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    menu_items_collection.update_one({"id": item_id}, {"$set": update_data})
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)


@router.patch("/api/admin/menu-items/{item_id}/availability")
async def admin_toggle_availability(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Toggle menu item availability"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    new_availability = not existing.get("is_available", True)
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": {"is_available": new_availability, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)


@router.delete("/api/admin/menu-items/{item_id}")
async def admin_delete_menu_item(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Delete a menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    menu_items_collection.delete_one({"id": item_id})
    return {"message": "Menu item deleted successfully", "id": item_id}


# ============== IMAGE UPLOAD & SERVING ==============

def generate_thumbnail_bytes(image_bytes, size=(400, 400)):
    """Generate a consistent square thumbnail from image bytes."""
    try:
        with PILImage.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            w, h = img.size
            min_dim = min(w, h)
            left = (w - min_dim) // 2
            top = (h - min_dim) // 2
            img = img.crop((left, top, left + min_dim, top + min_dim))
            img = img.resize(size, PILImage.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85, optimize=True)
            return buf.getvalue()
    except Exception:
        return None


@router.post("/api/admin/menu-items/{item_id}/upload-image")
async def admin_upload_menu_image(item_id: str, file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Admin: Upload an image for a menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")

    file_bytes = await file.read()
    thumb_bytes = generate_thumbnail_bytes(file_bytes)

    image_id = f"{item_id}_{uuid.uuid4().hex[:8]}"
    thumb_id = f"{image_id}_thumb"

    images_collection.delete_many({"item_id": item_id})

    images_collection.insert_one({
        "image_id": image_id, "item_id": item_id,
        "content_type": file.content_type,
        "data": base64.b64encode(file_bytes).decode("utf-8"),
        "type": "original",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    if thumb_bytes:
        images_collection.insert_one({
            "image_id": thumb_id, "item_id": item_id,
            "content_type": "image/jpeg",
            "data": base64.b64encode(thumb_bytes).decode("utf-8"),
            "type": "thumbnail",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    image_url = f"/api/images/{image_id}"
    thumb_url = f"/api/images/{thumb_id}" if thumb_bytes else image_url

    update_fields = {
        "image_url": image_url, "thumbnail_url": thumb_url,
        "show_image": True, "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    menu_items_collection.update_one({"id": item_id}, {"$set": update_fields})

    updated_item = menu_items_collection.find_one({"id": item_id})
    return {"message": "Image uploaded successfully", "image_url": image_url, "thumbnail_url": thumb_url, "item": serialize_doc(updated_item)}


@router.patch("/api/admin/menu-items/{item_id}/toggle-image")
async def admin_toggle_image_visibility(item_id: str, user: dict = Depends(get_admin_user)):
    """Admin: Toggle show/hide image for a menu item"""
    existing = menu_items_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    new_show = not existing.get("show_image", True)
    menu_items_collection.update_one(
        {"id": item_id},
        {"$set": {"show_image": new_show, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated_item = menu_items_collection.find_one({"id": item_id})
    return serialize_doc(updated_item)


@router.get("/api/images/{image_id}")
async def get_image(image_id: str):
    """Serve an image stored in MongoDB"""
    doc = images_collection.find_one({"image_id": image_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    image_bytes = base64.b64decode(doc["data"])
    return Response(content=image_bytes, media_type=doc.get("content_type", "image/jpeg"), headers={"Cache-Control": "public, max-age=31536000"})
