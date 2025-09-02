from fastapi import APIRouter, HTTPException
import os

router = APIRouter()

@router.get("/health")
async def health():
    try:
        from ..core.database import get_mongo_client, get_collection
        
        client = get_mongo_client()
        collection = get_collection()
        
        client.admin.command('ping')
        product_count = collection.count_documents({})
        
        shopify_status = "not_configured"
        try:
            shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
            shopify_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
            if shopify_url and shopify_token:
                shopify_status = "configured"
            else:
                shopify_status = "missing_credentials"
        except:
            shopify_status = "error"
        
        return {
            "status": "healthy",
            "database": "connected",
            "products": product_count,
            "shopify": shopify_status,
            "fetch_tracking": "mongodb"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }