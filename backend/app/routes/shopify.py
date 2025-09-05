import time
import threading
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from ..models.requests import ShopifyFetchRequest, BulkListRequest, AIGenerationRequest
from ..services.shopify_fetch import ShopifyFetchService
from ..services.shopify_sync import ShopifySyncService

router = APIRouter()

@router.get("/delta/{vendor}")
async def get_delta_products(vendor: str, request: Request):
    try:
        from ..core.database import get_mongo_client
        from ..core.config import settings
        
        if not vendor or len(vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor parameter is required and cannot be empty"
            )
        
        vendor = vendor.strip().lower()
        
        client = get_mongo_client()
        db = client[settings.MONGO_DATABASE]
        
        scraped_collection_name = settings.MONGO_COLLECTION
        shopify_collection_name = f"auspek_{vendor}"
        
        scraped_collection = db[scraped_collection_name]
        shopify_collection = db[shopify_collection_name]
        
        collection_names = db.list_collection_names()
        
        if scraped_collection_name not in collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Scraped collection '{scraped_collection_name}' not found"
            )
        
        if shopify_collection_name not in collection_names:
            print(f"Shopify collection '{shopify_collection_name}' not found, returning all scraped products")
            scraped_products = list(scraped_collection.find(
                {}, 
                {
                    "sku": 1, 
                    "title": 1, 
                    "category": 1, 
                    "manufacturer": 1, 
                    "status": 1,
                    "images": 1,
                    "description": 1,
                    "main_color": 1,
                    "features": 1,
                    "warranty": 1,
                    "url": 1,
                    "listed_on_shopify": 1,
                    "shopify_product_id": 1,
                    "listed_at": 1,
                    "gen_description": 1,
                    "gen_title": 1,
                    "gen_tags": 1,
                    "gen_collection": 1,
                    "ai_generated_at": 1
                }
            ))
            
            for product in scraped_products:
                product["id"] = str(product["_id"])
                del product["_id"]
                if "listed_on_shopify" not in product:
                    product["listed_on_shopify"] = False
                if "shopify_product_id" not in product:
                    product["shopify_product_id"] = None
                if "listed_at" not in product:
                    product["listed_at"] = None
                product["has_ai_content"] = all(key in product for key in ["gen_description", "gen_title", "gen_tags", "gen_collection"])
            
            return {
                "success": True,
                "message": f"Shopify collection not found. Returning all {len(scraped_products)} scraped products",
                "data": {
                    "vendor": vendor,
                    "scraped_collection": scraped_collection_name,
                    "shopify_collection": shopify_collection_name,
                    "total_scraped": len(scraped_products),
                    "total_in_shopify": 0,
                    "delta_count": len(scraped_products),
                    "products_not_in_shopify": scraped_products
                }
            }
        
        scraped_products = list(scraped_collection.find(
            {"sku": {"$exists": True, "$ne": None, "$ne": ""}},
            {
                "sku": 1, 
                "title": 1, 
                "category": 1, 
                "manufacturer": 1, 
                "status": 1,
                "images": 1,
                "description": 1,
                "main_color": 1,
                "features": 1,
                "warranty": 1,
                "url": 1,
                "colors": 1,
                "breadcrumbs": 1,
                "listed_on_shopify": 1,
                "shopify_product_id": 1,
                "listed_at": 1,
                "gen_description": 1,
                "gen_title": 1,
                "gen_tags": 1,
                "gen_collection": 1,
                "ai_generated_at": 1
            }
        ))
        
        scraped_skus = set()
        scraped_sku_to_product = {}
        
        for product in scraped_products:
            sku = product.get("sku")
            if sku:
                sku = str(sku).strip()
                if sku:
                    scraped_skus.add(sku)
                    product["id"] = str(product["_id"])
                    del product["_id"]
                    if "listed_on_shopify" not in product:
                        product["listed_on_shopify"] = False
                    if "shopify_product_id" not in product:
                        product["shopify_product_id"] = None
                    if "listed_at" not in product:
                        product["listed_at"] = None
                    product["has_ai_content"] = all(key in product for key in ["gen_description", "gen_title", "gen_tags", "gen_collection"])
                    scraped_sku_to_product[sku] = product
        
        shopify_products = list(shopify_collection.find(
            {"variants.edges": {"$exists": True}},
            {"variants.edges.node.sku": 1}
        ))
        
        shopify_skus = set()
        
        for product in shopify_products:
            variants = product.get("variants", {}).get("edges", [])
            for variant in variants:
                node = variant.get("node", {})
                sku = node.get("sku")
                if sku:
                    sku = str(sku).strip()
                    if sku:
                        shopify_skus.add(sku)
        
        delta_skus = scraped_skus - shopify_skus
        
        delta_products = []
        for sku in delta_skus:
            if sku in scraped_sku_to_product:
                product = scraped_sku_to_product[sku]
                
                if "images" in product and product["images"]:
                    if isinstance(product["images"], str):
                        product["images"] = [product["images"]]
                    elif not isinstance(product["images"], list):
                        product["images"] = []
                else:
                    product["images"] = []
                
                if "description" in product and product["description"]:
                    if isinstance(product["description"], list):
                        product["description_text"] = ". ".join(product["description"])
                    else:
                        product["description_text"] = str(product["description"])
                else:
                    product["description_text"] = ""
                
                if "main_color" in product and product["main_color"]:
                    product["color"] = product["main_color"]
                elif "colors" in product and product["colors"] and len(product["colors"]) > 0:
                    product["color"] = product["colors"][0]
                else:
                    product["color"] = ""
                
                delta_products.append(product)
        
        delta_products.sort(key=lambda x: x.get("title", "").lower())
        
        ai_content_stats = {
            "total_with_ai": sum(1 for p in delta_products if p["has_ai_content"]),
            "total_without_ai": sum(1 for p in delta_products if not p["has_ai_content"])
        }
        
        return {
            "success": True,
            "message": f"Found {len(delta_products)} products not in Shopify",
            "data": {
                "vendor": vendor,
                "scraped_collection": scraped_collection_name,
                "shopify_collection": shopify_collection_name,
                "total_scraped": len(scraped_skus),
                "total_in_shopify": len(shopify_skus),
                "delta_count": len(delta_products),
                "ai_content_stats": ai_content_stats,
                "products_not_in_shopify": delta_products
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting delta products: {str(e)}"
        )

@router.post("/ai/regenerate/{sku}")
async def force_regenerate_ai_content(sku: str):
    """Generate AI content for a single product (always regenerates)"""
    try:
        if not sku or len(sku.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="SKU parameter is required and cannot be empty"
            )
        
        sku = sku.strip()
        
        print(f"DEBUG: AI regeneration request - SKU: {sku} (always regenerates)")
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        
        try:
            result = await enhanced_service.generate_and_store_ai_content(sku, force_regenerate=True)
            return {
                "success": True,
                "message": "AI content regenerated successfully",
                "data": result
            }
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error regenerating AI content: {str(e)}"
        )

@router.post("/ai/regenerate/bulk")
async def force_regenerate_bulk_ai_content(request_body: BulkListRequest):
    """Generate AI content for multiple products (always regenerates)"""
    try:
        if not request_body.skus or len(request_body.skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one SKU is required"
            )
        
        unique_skus = list(set(sku.strip() for sku in request_body.skus if sku.strip()))
        
        if len(unique_skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid SKUs provided"
            )
        
        if len(unique_skus) > 50:
            raise HTTPException(
                status_code=400,
                detail="Cannot process more than 50 products at once"
            )
        
        print(f"DEBUG: Bulk AI regeneration - SKUs: {len(unique_skus)} (always regenerates)")
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        
        try:
            result = await enhanced_service.generate_bulk_ai_content(unique_skus, force_regenerate=True)
            return {
                "success": True,
                "message": "AI content regenerated for all products",
                "data": result
            }
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error regenerating bulk AI content: {str(e)}"
        )

@router.post("/myweb/{website_name}")
async def fetch_shopify_products_for_vendor(website_name: str, request_body: ShopifyFetchRequest, request: Request):
    try:
        if not website_name or len(website_name.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Website name is required and cannot be empty"
            )
        
        if not request_body.vendor or len(request_body.vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor name is required and cannot be empty"
            )
        
        website_name = website_name.strip().lower()
        vendor = request_body.vendor.strip()
        
        fetch_status = request.app.state.fetch_status
        
        if fetch_status.is_fetch_active("shopify", vendor):
            return {
                "success": False,
                "error": "Shopify fetch already active",
                "message": f"Shopify fetch is already in progress for {vendor}"
            }
        
        doc_id = fetch_status.save_fetch_start("shopify", vendor)
        
        try:
            fetch_service = ShopifyFetchService()
        except ValueError as e:
            fetch_status.save_fetch_complete("shopify", vendor, success=False, error=str(e), doc_id=str(doc_id))
            raise HTTPException(
                status_code=500,
                detail=f"Shopify configuration error: {str(e)}"
            )
        except Exception as e:
            fetch_status.save_fetch_complete("shopify", vendor, success=False, error=str(e), doc_id=str(doc_id))
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Shopify fetch service: {str(e)}"
            )
        
        def run_shopify_fetch():
            try:
                total_products = fetch_service.sync_all_shopify_products(vendor, website_name)
                fetch_status.save_fetch_complete("shopify", vendor, success=True, doc_id=str(doc_id))
                print(f"Shopify fetch completed: {total_products} products")
                
            except Exception as e:
                print(f"Shopify fetch failed: {str(e)}")
                fetch_status.save_fetch_complete("shopify", vendor, success=False, error=str(e), doc_id=str(doc_id))
            finally:
                fetch_service.close_connection()
        
        thread = threading.Thread(target=run_shopify_fetch)
        thread.daemon = True
        thread.start()
        
        return {
            "success": True,
            "message": f"Shopify fetch started for vendor '{vendor}'",
            "data": {
                "vendor": vendor,
                "website_name": website_name,
                "collection_name": f"auspek_{website_name}",
                "status": "running",
                "timestamp": datetime.now().isoformat(),
                "operation_id": str(doc_id)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during fetch: {str(e)}"
        )

@router.get("/list/status/{sku}")
async def check_product_listing_status(sku: str):
    """Check if a product is already listed on Shopify"""
    try:
        if not sku or len(sku.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="SKU parameter is required and cannot be empty"
            )
        
        sku = sku.strip()
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize service: {str(e)}"
            )
        
        try:
            status = enhanced_service.check_product_listing_status(sku)
            return {
                "success": True,
                "data": status
            }
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking listing status: {str(e)}"
        )

@router.post("/list/status/bulk")
async def check_multiple_products_listing_status(request_body: BulkListRequest):
    """Check listing status for multiple products"""
    try:
        if not request_body.skus or len(request_body.skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one SKU is required"
            )
        
        unique_skus = list(set(sku.strip() for sku in request_body.skus if sku.strip()))
        
        if len(unique_skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid SKUs provided"
            )
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize service: {str(e)}"
            )
        
        try:
            status_map = enhanced_service.get_multiple_listing_status(unique_skus)
            return {
                "success": True,
                "data": status_map
            }
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking multiple listing statuses: {str(e)}"
        )
@router.post("/list/bulk")
async def sync_multiple_products_to_shopify(request_body: BulkListRequest, request: Request):
    """Sync multiple products to Shopify - ALWAYS regenerates AI content"""
    try:
        from ..core.database import get_collection
        
        if not request_body.skus or len(request_body.skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one SKU is required"
            )
        
        unique_skus = list(set(sku.strip() for sku in request_body.skus if sku.strip()))
        
        if len(unique_skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid SKUs provided"
            )
        
        if len(unique_skus) > 50:
            raise HTTPException(
                status_code=400,
                detail="Cannot process more than 50 products at once"
            )
        
        collection = get_collection()
        fetch_status = request.app.state.fetch_status
        
        force_relist = getattr(request_body, 'force_relist', False)
        
        
        existing_products = list(collection.find(
            {"sku": {"$in": unique_skus}},
            {
                "sku": 1, "title": 1, "manufacturer": 1, "listed_on_shopify": 1, 
                "shopify_product_id": 1, "category": 1, "gen_description": 1,
                "gen_title": 1, "gen_tags": 1, "gen_collection": 1, "ai_generated_at": 1
            }
        ))
        
        existing_skus = {product["sku"]: product for product in existing_products}
        missing_skus = [sku for sku in unique_skus if sku not in existing_skus]
        
        if missing_skus:
            return {
                "success": False,
                "error": "Products not found",
                "message": f"The following SKUs were not found in database: {', '.join(missing_skus)}",
                "missing_skus": missing_skus,
                "found_skus": list(existing_skus.keys())
            }
        
        invalid_categories = []
        for product in existing_products:
            category = product.get("category", "").strip()
            if not category or category.lower() == 'none':
                invalid_categories.append({
                    "sku": product["sku"],
                    "category": category or "None"
                })
        
        if invalid_categories:
            return {
                "success": False,
                "error": "Invalid categories",
                "message": "Products with invalid or None categories found",
                "invalid_categories": invalid_categories
            }
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize service: {str(e)}"
            )
        
        results = []
        successful_syncs = 0
        failed_syncs = 0
        already_listed = 0
        sku_data = []
        ai_regeneration_count = 0  
        
        vendor = "unknown"
        if existing_products:
            vendor = existing_products[0].get("manufacturer", "unknown").lower()
        
        try:
            for i, sku in enumerate(existing_skus.keys()):
                product_info = existing_skus[sku]
                sku_record = {
                    "sku": sku,
                    "title": product_info.get("title", "Unknown Product"),
                    "vendor": product_info.get("manufacturer", "Unknown"),
                    "success": False,
                    "error": None,
                    "shopify_product_id": None,
                    "already_listed": product_info.get("listed_on_shopify", False),
                    "ai_regenerated": False  
                }
                
                try:
                    print(f"DEBUG: Processing product {i+1}/{len(existing_skus)}: {sku}")
                    
                    if product_info.get("listed_on_shopify", False) and not force_relist:
                        
                        ai_result = await enhanced_service.generate_and_store_ai_content(sku, force_regenerate=True)
                        if ai_result["success"]:
                            ai_regeneration_count += 1
                            sku_record["ai_regenerated"] = True
                            print(f"DEBUG: AI content regenerated for already listed product {sku}")
                        
                        already_listed += 1
                        sku_record["already_listed"] = True
                        sku_record["shopify_product_id"] = product_info.get("shopify_product_id")
                        
                        results.append({
                            "sku": sku,
                            "success": False, 
                            "already_listed": True,
                            "message": "Product is already listed on Shopify (AI content regenerated)",
                            "shopify_product_id": product_info.get("shopify_product_id"),
                            "ai_regenerated": sku_record.get("ai_regenerated", False)
                        })
                    else:
                        print(f"DEBUG: Proceeding with listing for {sku} (AI always regenerated)")
                        result = await enhanced_service.sync_product_by_sku(
                            sku, 
                            force_relist=force_relist,
                            force_regenerate_ai=True  
                        )
                        
                        if result["success"]:
                            successful_syncs += 1
                            sku_record["success"] = True
                            sku_record["shopify_product_id"] = result["data"]["shopify_product_id"]
                            
                            ai_regeneration_count += 1
                            sku_record["ai_regenerated"] = True
                            
                            print(f"DEBUG: Successfully synced {sku} with regenerated AI content")
                            
                            results.append({
                                "sku": sku,
                                "success": True,
                                "message": "Product synced successfully with freshly generated AI content",
                                "shopify_product_id": result["data"]["shopify_product_id"],
                                "ai_content": result["data"].get("ai_content", {}),
                                "ai_regenerated": True 
                            })
                        else:
                            failed_syncs += 1
                            sku_record["error"] = result.get("error", "Unknown error")
                            
                            print(f"DEBUG: Failed to sync {sku}: {result.get('error')}")
                            
                            results.append({
                                "sku": sku,
                                "success": False,
                                "error": result.get("error", "Unknown error"),
                                "message": result.get("message", "Sync failed")
                            })
                    
                    # Rate limiting
                    if i < len(existing_skus) - 1: 
                        time.sleep(2)
                        
                except Exception as e:
                    failed_syncs += 1
                    sku_record["error"] = str(e)
                    
                    print(f"ERROR: Error processing {sku}: {str(e)}")
                    
                    results.append({
                        "sku": sku,
                        "success": False,
                        "error": "Processing error",
                        "message": str(e)
                    })
                
                sku_data.append(sku_record)
        
        finally:
            enhanced_service.close_connection()
        
        try:
            fetch_status.save_listing_operation(
                operation_type="bulk",
                vendor=vendor,
                sku_data=sku_data,
                success_count=successful_syncs,
                failed_count=failed_syncs,
                results=results
            )
        except Exception as e:
            print(f"WARNING: Failed to save listing history: {str(e)}")
        
        overall_success = failed_syncs == 0
        
        print(f"DEBUG: Bulk operation completed - Success: {successful_syncs}, Failed: {failed_syncs}, Already listed: {already_listed}, AI regenerated: {ai_regeneration_count}")
        
        return {
            "success": overall_success,
            "message": f"Bulk sync completed: {successful_syncs} successful, {failed_syncs} failed, {already_listed} already listed, {ai_regeneration_count} AI content regenerated",
            "summary": {
                "total_requested": len(unique_skus),
                "total_processed": len(existing_skus),
                "successful": successful_syncs,
                "failed": failed_syncs,
                "already_listed": already_listed,
                "ai_content_regenerated": ai_regeneration_count,  
                "success_rate": f"{(successful_syncs / len(existing_skus) * 100):.1f}%" if existing_skus else "0%"
            },
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR: Unexpected error during bulk sync: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during bulk sync: {str(e)}"
        )

@router.post("/list/{sku}")
async def sync_product_to_shopify(sku: str, request: Request):
    """Sync single product to Shopify - ALWAYS regenerates AI content"""
    try:
        from ..core.database import get_collection
        
        if not sku or len(sku.strip()) == 0:
            raise HTTPException(
                status_code=400, 
                detail="SKU parameter is required and cannot be empty"
            )
        
        sku = sku.strip()
        force_relist = request.headers.get('X-Force-Relist', 'false').lower() == 'true'
        # AI is always regenerated now, so we don't need to check the header
        
        print(f"DEBUG: Single product sync - SKU: {sku}, force_relist: {force_relist} (AI always regenerated)")
        
        collection = get_collection()
        fetch_status = request.app.state.fetch_status
        
        product = collection.find_one({"sku": sku})
        if not product:
            raise HTTPException(
                status_code=404, 
                detail=f"Product not found in database with SKU: {sku}"
            )
        
        # Validate category
        category = product.get("category", "").strip()
        if not category or category.lower() == 'none':
            raise HTTPException(
                status_code=400,
                detail=f"Product has invalid category: '{category}'. Category cannot be None or empty."
            )
        
        vendor = product.get("manufacturer", "unknown").lower()
        product_title = product.get("title", "Unknown Product")
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize service: {str(e)}"
            )
        
        sku_record = {
            "sku": sku,
            "title": product_title,
            "vendor": product.get("manufacturer", "Unknown"),
            "success": False,
            "error": None,
            "shopify_product_id": None,
            "already_listed": product.get("listed_on_shopify", False),
            "ai_regenerated": False
        }
        
        try:
            result = await enhanced_service.sync_product_by_sku(
                sku, 
                force_relist=force_relist,
                force_regenerate_ai=True  # Always True now
            )
            
            if result["success"]:
                sku_record["success"] = True
                sku_record["shopify_product_id"] = result["data"]["shopify_product_id"]
                sku_record["ai_regenerated"] = True  # AI is always regenerated
                
                try:
                    fetch_status.save_listing_operation(
                        operation_type="single",
                        vendor=vendor,
                        sku_data=[sku_record],
                        success_count=1,
                        failed_count=0,
                        results=[{
                            "sku": sku,
                            "success": True,
                            "message": "Product synced successfully with freshly generated AI content",
                            "shopify_product_id": result["data"]["shopify_product_id"],
                            "ai_content": result["data"].get("ai_content", {}),
                            "ai_regenerated": True
                        }]
                    )
                except Exception as e:
                    print(f"Warning: Failed to save listing history: {str(e)}")
                
                return {
                    "success": True,
                    "message": f"Product '{sku}' successfully synced to Shopify with freshly generated AI content",
                    "data": result["data"]
                }
            else:
                sku_record["error"] = result.get("message", "Unknown error")
                
                # Handle already listed case
                if result.get("already_listed"):
                    ai_regenerated = result.get("ai_content_regenerated", False)
                    sku_record["ai_regenerated"] = ai_regenerated
                    
                    return {
                        "success": False,
                        "already_listed": True,
                        "message": result.get("message", "Product is already listed") + f" (AI content {'regenerated' if ai_regenerated else 'regeneration failed'})",
                        "shopify_product_id": result.get("shopify_product_id"),
                        "listed_at": result.get("listed_at"),
                        "ai_content_regenerated": ai_regenerated
                    }
                
                try:
                    fetch_status.save_listing_operation(
                        operation_type="single",
                        vendor=vendor,
                        sku_data=[sku_record],
                        success_count=0,
                        failed_count=1,
                        results=[{
                            "sku": sku,
                            "success": False,
                            "error": result.get("error", "Unknown error"),
                            "message": result.get("message", "Sync failed")
                        }]
                    )
                except Exception as e:
                    print(f"Warning: Failed to save listing history: {str(e)}")
                
                raise HTTPException(
                    status_code=400,
                    detail=f"Sync failed: {result.get('message', 'Unknown error')}"
                )
                
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during sync: {str(e)}"
        )
    try:
        from ..core.database import get_collection
        
        if not sku or len(sku.strip()) == 0:
            raise HTTPException(
                status_code=400, 
                detail="SKU parameter is required and cannot be empty"
            )
        
        sku = sku.strip()
        force_relist = request.headers.get('X-Force-Relist', 'false').lower() == 'true'
        force_regenerate_ai = request.headers.get('X-Force-Regenerate-AI', 'false').lower() == 'true'
        
        collection = get_collection()
        fetch_status = request.app.state.fetch_status
        
        product = collection.find_one({"sku": sku})
        if not product:
            raise HTTPException(
                status_code=404, 
                detail=f"Product not found in database with SKU: {sku}"
            )
        
        # Validate category
        category = product.get("category", "").strip()
        if not category or category.lower() == 'none':
            raise HTTPException(
                status_code=400,
                detail=f"Product has invalid category: '{category}'. Category cannot be None or empty."
            )
        
        vendor = product.get("manufacturer", "unknown").lower()
        product_title = product.get("title", "Unknown Product")
        
        try:
            enhanced_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize service: {str(e)}"
            )
        
        sku_record = {
            "sku": sku,
            "title": product_title,
            "vendor": product.get("manufacturer", "Unknown"),
            "success": False,
            "error": None,
            "shopify_product_id": None,
            "already_listed": product.get("listed_on_shopify", False),
            "ai_generated": False
        }
        
        try:
            result = await enhanced_service.sync_product_by_sku(
                sku, 
                force_relist=force_relist,
                force_regenerate_ai=force_regenerate_ai
            )
            
            if result["success"]:
                sku_record["success"] = True
                sku_record["shopify_product_id"] = result["data"]["shopify_product_id"]
                
                # Check if AI content was involved
                if result["data"].get("ai_content"):
                    sku_record["ai_generated"] = True
                
                try:
                    fetch_status.save_listing_operation(
                        operation_type="single",
                        vendor=vendor,
                        sku_data=[sku_record],
                        success_count=1,
                        failed_count=0,
                        results=[{
                            "sku": sku,
                            "success": True,
                            "message": "Product synced successfully with AI content",
                            "shopify_product_id": result["data"]["shopify_product_id"],
                            "ai_content": result["data"].get("ai_content", {})
                        }]
                    )
                except Exception as e:
                    print(f"Warning: Failed to save listing history: {str(e)}")
                
                return {
                    "success": True,
                    "message": f"Product '{sku}' successfully synced to Shopify with AI-generated content",
                    "data": result["data"]
                }
            else:
                sku_record["error"] = result.get("message", "Unknown error")
                
                # Handle already listed case
                if result.get("already_listed"):
                    return {
                        "success": False,
                        "already_listed": True,
                        "message": result.get("message", "Product is already listed"),
                        "shopify_product_id": result.get("shopify_product_id"),
                        "listed_at": result.get("listed_at")
                    }
                
                try:
                    fetch_status.save_listing_operation(
                        operation_type="single",
                        vendor=vendor,
                        sku_data=[sku_record],
                        success_count=0,
                        failed_count=1,
                        results=[{
                            "sku": sku,
                            "success": False,
                            "error": result.get("error", "Unknown error"),
                            "message": result.get("message", "Sync failed")
                        }]
                    )
                except Exception as e:
                    print(f"Warning: Failed to save listing history: {str(e)}")
                
                raise HTTPException(
                    status_code=400,
                    detail=f"Sync failed: {result.get('message', 'Unknown error')}"
                )
                
        finally:
            enhanced_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during sync: {str(e)}"
        )

@router.get("/list/history")
async def get_listing_history(
    request: Request,
    page: int = 1,
    limit: int = 50,
    vendor_filter: str = None,
    operation_filter: str = None
):
    try:
        fetch_status = request.app.state.fetch_status
        result = fetch_status.get_listing_history(
            page=page, 
            limit=limit, 
            vendor_filter=vendor_filter, 
            operation_filter=operation_filter
        )
        
        stats = fetch_status.get_listing_stats()
        
        return {
            "success": True,
            **result,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting listing history: {str(e)}"
        )

@router.get("/list/stats")
async def get_listing_stats(request: Request):
    try:
        fetch_status = request.app.state.fetch_status
        stats = fetch_status.get_listing_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting listing stats: {str(e)}"
        )