from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from bson import ObjectId

router = APIRouter()

@router.get("/products")
async def get_products(
    request: Request,
    page: int = 1,
    limit: int = 50,
    category: Optional[str] = None,
    search: Optional[str] = None,
    vendor: Optional[str] = None
):
    try:
        from ..core.database import get_collection
        collection = get_collection()
        
        query = {}
        if category:
            query["category"] = {"$regex": category, "$options": "i"}
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"sku": {"$regex": search, "$options": "i"}}
            ]
        if vendor:
            query["manufacturer"] = {"$regex": vendor, "$options": "i"}
        
        total = collection.count_documents(query)
        
        skip = (page - 1) * limit
        cursor = collection.find(query).skip(skip).limit(limit)
        
        products = []
        for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            products.append(doc)
        
        return {
            "success": True,
            "products": products,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": skip + limit < total,
            "has_prev": page > 1
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/products/categories")
async def get_categories(vendor: Optional[str] = None):
    try:
        from ..core.database import get_collection
        collection = get_collection()
        
        query = {}
        if vendor:
            query["manufacturer"] = {"$regex": vendor, "$options": "i"}
        
        categories = collection.distinct("category", query)
        categories = [cat for cat in categories if cat and cat.strip()]
        categories.sort()
        
        return {
            "success": True,
            "categories": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    try:
        from ..core.database import get_collection
        collection = get_collection()
        
        product = collection.find_one({"sku": product_id})
        if not product:
            try:
                product = collection.find_one({"_id": ObjectId(product_id)})
            except:
                pass
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product["id"] = str(product["_id"])
        del product["_id"]
        
        return {"success": True, "product": product}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))