from bson import ObjectId


def serialize_doc(doc):
    """Convert MongoDB document to JSON-safe dict"""
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    for key, val in doc.items():
        if isinstance(val, ObjectId):
            doc[key] = str(val)
    return doc


def serialize_user(user):
    """Convert user doc to safe response (no password)"""
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
    }
