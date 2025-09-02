import os
import subprocess
import threading
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

@router.post("/scrape/{vendor}")
async def start_vendor_scraping(vendor: str, request: Request):
    try:
        from ..core.config import settings
        
        if not vendor or len(vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor parameter is required and cannot be empty"
            )
        
        vendor = vendor.strip().lower()
        
        valid_vendors = ['phoenix', 'hansgrohe', 'moen', 'kohler']
        if vendor not in valid_vendors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid vendor. Must be one of: {', '.join(valid_vendors)}"
            )
        
        fetch_status = request.app.state.fetch_status
        
        if fetch_status.is_fetch_active("scrape", vendor):
            return {
                "success": False,
                "error": "Scraping already active",
                "message": f"Scraping is already in progress for {vendor}"
            }
        
        doc_id = fetch_status.save_fetch_start("scrape", vendor)
        
        scrapy_path = "../"
        
        scrapy_cfg = os.path.join(scrapy_path, "scrapy.cfg")
        if not os.path.exists(scrapy_cfg):
            fetch_status.save_fetch_complete("scrape", vendor, success=False, error="Scrapy project not found", doc_id=str(doc_id))
            return {
                "success": False,
                "error": f"Scrapy project not found at {scrapy_path}",
                "message": "Make sure scrapy.cfg exists in parent directory"
            }
        
        scrapy_command = [
            "scrapy", "crawl", f"{vendor}_spider",
            "-s", f"MONGO_DATABASE={settings.MONGO_DATABASE}",
            "-s", f"MONGO_COLLECTION={settings.MONGO_COLLECTION}", 
            "-s", f"MONGO_URI={settings.MONGO_URI}",
            "-s", f"VENDOR={vendor.upper()}"
        ]
        
        if vendor == 'phoenix':
            scrapy_command = [
                "scrapy", "crawl", "integrated_product",
                "-s", f"MONGO_DATABASE={settings.MONGO_DATABASE}",
                "-s", f"MONGO_COLLECTION={settings.MONGO_COLLECTION}", 
                "-s", f"MONGO_URI={settings.MONGO_URI}",
                "-s", f"VENDOR=PHOENIX"
            ]
        
        def run_scraping():
            try:
                result = subprocess.run(
                    scrapy_command,
                    cwd=scrapy_path,
                    capture_output=True, 
                    text=True, 
                    timeout=3000
                )
                
                if result.returncode == 0:
                    fetch_status.save_fetch_complete("scrape", vendor, success=True, doc_id=str(doc_id))
                else:
                    fetch_status.save_fetch_complete("scrape", vendor, success=False, error=result.stderr, doc_id=str(doc_id))
                
            except subprocess.TimeoutExpired:
                fetch_status.save_fetch_complete("scrape", vendor, success=False, error="Timeout", doc_id=str(doc_id))
            except Exception as e:
                fetch_status.save_fetch_complete("scrape", vendor, success=False, error=str(e), doc_id=str(doc_id))
        
        scraping_thread = threading.Thread(target=run_scraping)
        scraping_thread.daemon = True
        scraping_thread.start()
        
        return {
            "success": True,
            "message": f"Scraping started for {vendor}",
            "vendor": vendor,
            "timestamp": datetime.now().isoformat(),
            "operation_id": str(doc_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error starting scraping: {str(e)}"
        )

@router.get("/scrape/active/{vendor}")
async def check_scraping_active(vendor: str, request: Request):
    try:
        vendor = vendor.strip().lower()
        fetch_status = request.app.state.fetch_status
        is_active = fetch_status.is_fetch_active("scrape", vendor)
        
        return {
            "success": True,
            "vendor": vendor,
            "active": is_active
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking scraping status: {str(e)}"
        )

@router.get("/scrape/info/{vendor}")
async def get_last_scrape_info(vendor: str, request: Request):
    try:
        vendor = vendor.strip().lower()
        fetch_status = request.app.state.fetch_status
        
        scrape_status_doc = fetch_status.get_fetch_status("scrape", vendor)
        shopify_status_doc = fetch_status.get_fetch_status("shopify", vendor)
        
        scrape_info = None
        shopify_info = None
        
        if scrape_status_doc:
            scrape_info = {
                "timestamp": scrape_status_doc.get("completed_at", scrape_status_doc.get("started_at")).isoformat() if scrape_status_doc.get("completed_at") or scrape_status_doc.get("started_at") else None,
                "success": scrape_status_doc.get("status") == "completed",
                "status": scrape_status_doc.get("status"),
                "error": scrape_status_doc.get("error")
            }
        
        if shopify_status_doc:
            shopify_info = {
                "timestamp": shopify_status_doc.get("completed_at", shopify_status_doc.get("started_at")).isoformat() if shopify_status_doc.get("completed_at") or shopify_status_doc.get("started_at") else None,
                "success": shopify_status_doc.get("status") == "completed",
                "status": shopify_status_doc.get("status"),
                "error": shopify_status_doc.get("error")
            }
        
        return {
            "success": True,
            "vendor": vendor,
            "lastScrape": scrape_info.get("timestamp") if scrape_info else None,
            "scrapeSuccess": scrape_info.get("success") if scrape_info else None,
            "scrapeInfo": scrape_info,
            "lastShopifyFetch": shopify_info.get("timestamp") if shopify_info else None,
            "shopifyInfo": shopify_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting scrape info: {str(e)}"
        )