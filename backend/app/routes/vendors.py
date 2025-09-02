from fastapi import APIRouter, HTTPException, Request
from typing import Optional

router = APIRouter()

@router.get("/vendors")
async def get_vendors():
    return {
        "success": True,
        "vendors": [
            {
                "value": "phoenix",
                "label": "Phoenix Tapware",
                "website": "https://phoenixtapware.com.au",
                "active": True
            },
            {
                "value": "hansgrohe", 
                "label": "Hansgrohe",
                "website": "https://hansgrohe.com",
                "active": True
            },
            {
                "value": "moen",
                "label": "Moen", 
                "website": "https://moen.com",
                "active": True
            },
            {
                "value": "kohler",
                "label": "Kohler",
                "website": "https://kohler.com", 
                "active": True
            }
        ]
    }

@router.get("/vendors/{vendor}/status")
async def get_vendor_status(vendor: str, request: Request):
    try:
        vendor = vendor.strip().lower()
        fetch_status = request.app.state.fetch_status
        
        is_scraping_active = fetch_status.is_fetch_active("scrape", vendor)
        is_shopify_active = fetch_status.is_fetch_active("shopify", vendor)
        
        last_scrape_date = fetch_status.get_last_fetch_date("scrape", vendor)
        last_shopify_date = fetch_status.get_last_fetch_date("shopify", vendor)
        
        return {
            "success": True,
            "vendor": vendor,
            "isScrapingActive": is_scraping_active,
            "isShopifyActive": is_shopify_active,
            "lastScrape": last_scrape_date.isoformat() if last_scrape_date else None,
            "lastShopifyFetch": last_shopify_date.isoformat() if last_shopify_date else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting vendor status: {str(e)}"
        )