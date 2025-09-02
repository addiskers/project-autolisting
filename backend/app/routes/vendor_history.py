from fastapi import APIRouter, HTTPException
from typing import Optional
import pymongo
from ..core.database import get_collection
from ..core.config import settings

router = APIRouter()

@router.get("/vendor-web/{vendor}")
async def get_vendor_history(
    vendor: str,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None
):
    """
    Get vendor product history with status filtering
    Status options: NEW, UPDATED, UNCHANGED, DELETED, or ALL
    """
    try:
        # Validate vendor parameter
        if not vendor or len(vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor parameter is required and cannot be empty"
            )
        
        vendor = vendor.strip().lower()
        
        # Get the collection
        collection = get_collection()
        
        # Build base query for vendor - match against manufacturer field
        base_query = {
            "manufacturer": {"$regex": f".*{vendor}.*", "$options": "i"}
        }
        
        # Build main query
        query = base_query.copy()
        
        # Add status filter if provided and not 'ALL'
        if status_filter and status_filter.upper() != 'ALL':
            valid_statuses = ['NEW', 'UPDATED', 'UNCHANGED', 'DELETED']
            if status_filter.upper() in valid_statuses:
                query["status_flag"] = status_filter.upper()
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses + ['ALL'])}"
                )
        
        # Add search filter if provided
        if search and search.strip():
            search_regex = {"$regex": search.strip(), "$options": "i"}
            search_conditions = [
                {"title": search_regex},
                {"sku": search_regex},
                {"category": search_regex}
            ]
            
            # Combine with existing query
            query = {
                "$and": [
                    query,
                    {"$or": search_conditions}
                ]
            }
        
        # Get total count for current query
        total = collection.count_documents(query)
        
        # Get status counts for all products from this vendor (for tabs)
        try:
            status_pipeline = [
                {"$match": base_query},
                {
                    "$group": {
                        "_id": {"$ifNull": ["$status_flag", "UNKNOWN"]},
                        "count": {"$sum": 1}
                    }
                }
            ]
            
            status_results = list(collection.aggregate(status_pipeline))
            status_counts = {
                "NEW": 0,
                "UPDATED": 0,
                "UNCHANGED": 0,
                "DELETED": 0,
                "ALL": 0
            }
            
            for result in status_results:
                status = result["_id"]
                count = result["count"]
                if status in status_counts:
                    status_counts[status] = count
                status_counts["ALL"] += count
        except Exception as e:
            print(f"Error getting status counts: {e}")
            status_counts = {
                "NEW": 0,
                "UPDATED": 0,
                "UNCHANGED": 0,
                "DELETED": 0,
                "ALL": total
            }
        
        # Validate and fix pagination parameters
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 20
            
        skip = (page - 1) * limit
        total_pages = max(1, (total + limit - 1) // limit)
        
        # Get paginated products with proper sorting
        try:
            # Sort by status priority, then by last_updated
            status_priority = {
                "NEW": 1,
                "UPDATED": 2,
                "UNCHANGED": 3,
                "DELETED": 4
            }
            
            cursor = collection.find(query).sort([
                ("last_updated", pymongo.DESCENDING)
            ]).skip(skip).limit(limit)
            
            products = []
            for doc in cursor:
                # Convert ObjectId to string
                doc["id"] = str(doc["_id"])
                del doc["_id"]
                
                # Format dates to ISO strings
                date_fields = ["last_updated", "first_seen", "last_seen", "scraped_at", "deleted_at"]
                for field in date_fields:
                    if doc.get(field):
                        try:
                            if hasattr(doc[field], 'isoformat'):
                                doc[field] = doc[field].isoformat()
                        except (AttributeError, ValueError):
                            pass  # Keep original value if conversion fails
                
                # Ensure status_flag exists
                if not doc.get("status_flag"):
                    doc["status_flag"] = "UNKNOWN"
                
                products.append(doc)
                
        except Exception as e:
            print(f"Error querying products: {e}")
            products = []
        
        # Build response
        response_data = {
            "success": True,
            "data": {
                "vendor": vendor.title(),
                "products": products,
                "status_counts": status_counts,
                "pagination": {
                    "total": total,
                    "page": page,
                    "limit": limit,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                },
                "filters": {
                    "status_filter": status_filter,
                    "search": search
                }
            }
        }
        
        print(f"Vendor history API response: Found {len(products)} products for {vendor}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in vendor history API: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

# Health check endpoint for debugging
@router.get("/vendor-web-test")
async def test_vendor_history():
    """Test endpoint to verify the route is working"""
    try:
        collection = get_collection()
        count = collection.count_documents({})
        return {
            "success": True, 
            "message": "Vendor history API is working",
            "total_products": count,
            "database": settings.MONGO_DATABASE,
            "collection": settings.MONGO_COLLECTION
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }