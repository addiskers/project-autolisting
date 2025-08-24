from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pymongo
import subprocess
import os
from typing import Optional

# Simple FastAPI app
app = FastAPI(
    title="Simple Product API",
    version="1.0.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["phoenix_products"]
collection = db["products"]

@app.get("/")
async def root():
    """API root"""
    return {"message": "Simple Product API is running", "docs": "/docs"}

@app.get("/health")
async def health():
    """Health check"""
    try:
        # Test MongoDB connection
        client.admin.command('ping')
        product_count = collection.count_documents({})
        return {
            "status": "healthy",
            "database": "connected",
            "products": product_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/api/products")
async def get_products(
    page: int = 1,
    limit: int = 50,
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get products with basic filtering"""
    try:
        # Build query
        query = {}
        if category:
            query["category"] = {"$regex": category, "$options": "i"}
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"sku": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get products with pagination
        skip = (page - 1) * limit
        cursor = collection.find(query).skip(skip).limit(limit)
        
        products = []
        for doc in cursor:
            # Convert MongoDB _id to string
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

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    """Get single product by ID or SKU"""
    try:
        # Try to find by SKU first
        product = collection.find_one({"sku": product_id})
        if not product:
            # Try by MongoDB _id
            try:
                from bson import ObjectId
                product = collection.find_one({"_id": ObjectId(product_id)})
            except:
                pass
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Convert _id to string
        product["id"] = str(product["_id"])
        del product["_id"]
        
        return {"success": True, "product": product}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scrape")
async def start_scraping():
    """Start scraping Phoenix products"""
    try:
        # Path to your scrapy project (adjust if needed)
        scrapy_path = "../"  # Since backend is inside webscraper folder
        
        # Check if scrapy project exists
        scrapy_cfg = os.path.join(scrapy_path, "scrapy.cfg")
        if not os.path.exists(scrapy_cfg):
            return {
                "success": False,
                "error": f"Scrapy project not found at {scrapy_path}",
                "message": "Make sure scrapy.cfg exists in parent directory"
            }
        
        # Run scrapy command
        result = subprocess.run([
            "scrapy", "crawl", "integrated_product",
            "-s", "MONGO_DATABASE=phoenix_products",
            "-s", "MONGO_COLLECTION=products", 
            "-s", f"MONGO_URI=mongodb://localhost:27017"
        ], 
        cwd=scrapy_path,
        capture_output=True, 
        text=True, 
        timeout=300  # 5 minutes timeout
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Scraping completed successfully",
                "output": result.stdout[-500:] if result.stdout else None  # Last 500 chars
            }
        else:
            return {
                "success": False,
                "error": "Scraping failed",
                "message": result.stderr or result.stdout,
                "return_code": result.returncode
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Scraping timed out",
            "message": "Scraping took longer than 5 minutes"
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "Scrapy command not found",
            "message": "Install scrapy with: pip install scrapy"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Unexpected error during scraping"
        }