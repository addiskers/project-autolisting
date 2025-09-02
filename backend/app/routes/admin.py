from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.get("/admin/history")
async def get_fetch_history(
    request: Request,
    page: int = 1,
    limit: int = 50,
    type_filter: Optional[str] = None,
    vendor_filter: Optional[str] = None,
    status_filter: Optional[str] = None
):
    try:
        from ..core.database import get_mongo_client
        from ..core.config import settings
        
        client = get_mongo_client()
        db = client[settings.MONGO_DATABASE]
        fetch_collection = db["fetch"]
        
        query = {}
        if type_filter:
            query["type"] = type_filter
        if vendor_filter:
            query["name"] = {"$regex": vendor_filter, "$options": "i"}
        if status_filter:
            query["status"] = status_filter
        
        total = fetch_collection.count_documents(query)
        
        skip = (page - 1) * limit
        cursor = fetch_collection.find(query).sort("updated_at", -1).skip(skip).limit(limit)
        
        history = []
        for doc in cursor:
            duration = None
            if doc.get("completed_at") and doc.get("started_at"):
                start_time = doc["started_at"]
                end_time = doc["completed_at"]
                duration_seconds = (end_time - start_time).total_seconds()
                
                if duration_seconds < 60:
                    duration = f"{int(duration_seconds)}s"
                elif duration_seconds < 3600:
                    duration = f"{int(duration_seconds / 60)}m {int(duration_seconds % 60)}s"
                else:
                    duration = f"{int(duration_seconds / 3600)}h {int((duration_seconds % 3600) / 60)}m"
            
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            
            doc["duration"] = duration
            
            if doc.get("started_at"):
                doc["started_at"] = doc["started_at"].isoformat()
            if doc.get("completed_at"):
                doc["completed_at"] = doc["completed_at"].isoformat()
            if doc.get("updated_at"):
                doc["updated_at"] = doc["updated_at"].isoformat()
            
            history.append(doc)
        
        total_scrapes = fetch_collection.count_documents({"type": "scrape"})
        total_shopify = fetch_collection.count_documents({"type": "shopify"})
        completed_today = fetch_collection.count_documents({
            "status": "completed",
            "completed_at": {
                "$gte": datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            }
        })
        
        return {
            "success": True,
            "history": history,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": skip + limit < total,
            "has_prev": page > 1,
            "stats": {
                "total_operations": total,
                "total_scrapes": total_scrapes,
                "total_shopify_fetches": total_shopify,
                "completed_today": completed_today
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting fetch history: {str(e)}"
        )