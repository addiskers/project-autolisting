import os
import time
import tempfile
import requests
import pymongo
from datetime import datetime
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from ..core.config import settings

class ShopifySyncService:
    def __init__(self):
        self.shopify_url = settings.SHOPIFY_GRAPHQL_URL
        self.access_token = settings.SHOPIFY_ACCESS_TOKEN
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        self.mongo_client = pymongo.MongoClient(settings.MONGO_URI)
        self.db = self.mongo_client[settings.MONGO_DATABASE]
        self.collection = self.db[settings.MONGO_COLLECTION]

    def download_image_from_url(self, image_url: str) -> tuple[str, str]:
        try:
            print(f"Downloading image: {image_url}")

            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ]

            response = None
            for i, user_agent in enumerate(user_agents):
                try:
                    headers = {
                        "User-Agent": user_agent,
                        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                    }

                    if i > 0:
                        time.sleep(2)

                    response = requests.get(
                        image_url,
                        stream=True,
                        timeout=30,
                        headers=headers,
                        allow_redirects=True,
                    )
                    response.raise_for_status()
                    break

                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 403 and i < len(user_agents) - 1:
                        continue
                    else:
                        raise
                except requests.exceptions.RequestException:
                    if i < len(user_agents) - 1:
                        continue
                    else:
                        raise

            parsed_url = urlparse(image_url)
            filename = os.path.basename(parsed_url.path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time())}.jpg"

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}")

            total_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    temp_file.write(chunk)
                    total_size += len(chunk)

            temp_file.close()
            print(f"Downloaded {total_size} bytes")
            return temp_file.name, filename

        except Exception as e:
            print(f"Error downloading image: {str(e)}")
            raise

    def create_staged_upload(self, filename: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        mutation = """
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        variables = {
            "input": [
                {
                    "resource": "IMAGE",
                    "filename": filename,
                    "mimeType": mime_type,
                    "httpMethod": "POST",
                }
            ]
        }

        response = requests.post(
            self.shopify_url,
            headers=self.headers,
            json={"query": mutation, "variables": variables},
        )

        data = response.json()

        if data.get("errors") or data["data"]["stagedUploadsCreate"]["userErrors"]:
            raise Exception(f"Error creating staged upload: {data}")

        return data["data"]["stagedUploadsCreate"]["stagedTargets"][0]

    def upload_image_to_shopify_s3(self, temp_file_path: str, filename: str) -> str:
        try:
            target = self.create_staged_upload(filename)
            upload_url = target["url"]
            resource_url = target["resourceUrl"]
            params = {param["name"]: param["value"] for param in target["parameters"]}

            with open(temp_file_path, "rb") as file_data:
                files = {"file": (filename, file_data, "image/jpeg")}
                upload_response = requests.post(
                    upload_url, data=params, files=files, timeout=60
                )

            try:
                os.unlink(temp_file_path)
            except:
                pass

            if upload_response.status_code not in [200, 201, 204]:
                raise Exception(f"S3 upload failed: {upload_response.status_code}")

            return resource_url

        except Exception as e:
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    def process_images(self, image_urls: List[str]) -> List[str]:
        if not image_urls:
            return []

        resource_urls = []
        for i, image_url in enumerate(image_urls):
            try:
                temp_file_path, filename = self.download_image_from_url(image_url)
                resource_url = self.upload_image_to_shopify_s3(temp_file_path, filename)
                resource_urls.append(resource_url)
                time.sleep(1)
            except Exception as e:
                print(f"Failed to process image {i+1}: {str(e)}")
                continue

        return resource_urls

    def link_images_to_product(self, product_id: str, resource_urls: List[str], product_title: str = "") -> bool:
        if not resource_urls:
            return True

        try:
            media_mutation = """
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media {
                  ... on MediaImage {
                    id
                  }
                }
                mediaUserErrors {
                  code
                  field
                  message
                }
              }
            }
            """

            media_items = []
            for i, resource_url in enumerate(resource_urls):
                media_items.append(
                    {
                        "alt": f"{product_title} - Image {i+1}" if product_title else f"Product Image {i+1}",
                        "mediaContentType": "IMAGE",
                        "originalSource": resource_url,
                    }
                )

            variables = {"productId": product_id, "media": media_items}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": media_mutation, "variables": variables},
                timeout=60,
            )

            if response.status_code != 200:
                return False

            data = response.json()
            if data.get("errors"):
                return False

            product_create_media = data.get("data", {}).get("productCreateMedia")
            if not product_create_media:
                return False

            errors = product_create_media.get("mediaUserErrors", [])
            if errors:
                return False

            return True

        except Exception as e:
            print(f"Error linking images: {str(e)}")
            return False

    def update_variant_with_sku(self, product_id: str, variants_data: List[Dict], mongo_doc: Dict[str, Any]) -> bool:
        try:
            if not variants_data:
                return False

            default_variant = variants_data[0].get("node", {})
            variant_id = default_variant.get("id")

            if not variant_id:
                return False

            sku = mongo_doc.get("sku", "")
            if not sku:
                return False

            variant_update_mutation = """
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """

            variant_update = {
                "id": variant_id,
                "price": str(settings.DEFAULT_PRICE),
                "compareAtPrice": str(settings.DEFAULT_COMPARE_PRICE),
                "taxable": True,
                "inventoryPolicy": "DENY",
                "inventoryItem": {"sku": str(sku)},
            }

            variables = {"productId": product_id, "variants": [variant_update]}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": variant_update_mutation, "variables": variables},
                timeout=30,
            )

            if response.status_code != 200 or response.json().get("errors"):
                return False

            return True

        except Exception as e:
            print(f"Error updating variant: {str(e)}")
            return False

    def create_shopify_product(self, mongo_doc: Dict[str, Any]) -> Optional[str]:
        try:
            description_html_parts = []
            if mongo_doc.get("description"):
                description_html_parts.append("<h3>Product Description:</h3><ul>")
                for item in mongo_doc["description"]:
                    description_html_parts.append(f"<li>{item}</li>")
                description_html_parts.append("</ul>")
            if mongo_doc.get("features"):
                description_html_parts.append("<h3>Features:</h3><ul>")
                for feature in mongo_doc["features"]:
                    description_html_parts.append(f"<li>{feature}</li>")
                description_html_parts.append("</ul>")
            if mongo_doc.get("warranty"):
                description_html_parts.append("<h3>Warranty:</h3><ul>")
                for item in mongo_doc["warranty"]:
                    description_html_parts.append(f"<li>{item}</li>")
                description_html_parts.append("</ul>")
            description_html = "".join(description_html_parts)

            tags = []
            if mongo_doc.get("category"):
                tags.append(f"Category_{mongo_doc['category']}")
            if mongo_doc.get("main_color"):
                tags.append(f"Colour_{mongo_doc['main_color']}")
            if mongo_doc.get("manufacturer"):
                tags.append(f"Brand_{mongo_doc['manufacturer']}")

            create_product_mutation = """
            mutation productCreate($product: ProductCreateInput!) {
              productCreate(product: $product) {
                product {
                  id
                  title
                  variants(first: 1) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """

            product_data = {
                "title": str(mongo_doc.get("title", "Untitled Product")),
                "descriptionHtml": description_html,
                "vendor": str(mongo_doc.get("manufacturer", "Unknown")),
                "productType": "All Products",
                "status": "DRAFT",
                "tags": ",".join(tags),
                "productOptions": [
                    {"name": "Title", "values": [{"name": "Default Title"}]}
                ],
            }

            variables = {"product": product_data}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": create_product_mutation, "variables": variables},
                timeout=30,
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if data.get("errors"):
                return None

            product = data.get("data", {}).get("productCreate", {}).get("product")
            if not product:
                return None

            product_id = product.get("id")

            variants_data = product.get("variants", {}).get("edges", [])
            self.update_variant_with_sku(product_id, variants_data, mongo_doc)

            return product_id

        except Exception as e:
            print(f"Error creating product: {str(e)}")
            return None

    def mark_product_as_listed(self, sku: str, shopify_product_id: str) -> bool:
        """Mark a product as listed on Shopify in the database"""
        try:
            result = self.collection.update_one(
                {"sku": sku},
                {
                    "$set": {
                        "listed_on_shopify": True,
                        "shopify_product_id": shopify_product_id,
                        "listed_at": datetime.utcnow(),
                        "last_listed": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error marking product as listed: {str(e)}")
            return False

    def check_product_listing_status(self, sku: str) -> Dict[str, Any]:
        """Check if a product is already listed on Shopify"""
        try:
            product = self.collection.find_one({"sku": sku})
            if not product:
                return {
                    "exists": False,
                    "listed": False,
                    "message": "Product not found"
                }

            return {
                "exists": True,
                "listed": product.get("listed_on_shopify", False),
                "shopify_product_id": product.get("shopify_product_id"),
                "listed_at": product.get("listed_at"),
                "last_listed": product.get("last_listed"),
                "title": product.get("title", "Unknown Product")
            }
        except Exception as e:
            print(f"Error checking product listing status: {str(e)}")
            return {
                "exists": False,
                "listed": False,
                "message": f"Error checking status: {str(e)}"
            }

    def sync_product_by_sku(self, sku: str, force_relist: bool = False) -> Dict[str, Any]:
        try:
            mongo_doc = self.collection.find_one({"sku": sku})
            
            if not mongo_doc:
                return {
                    "success": False,
                    "error": "Product not found",
                    "message": f"No product found with SKU: {sku}"
                }

            if not force_relist:
                listing_status = self.check_product_listing_status(sku)
                if listing_status["listed"]:
                    return {
                        "success": False,
                        "error": "Product already listed",
                        "message": f"Product '{listing_status['title']}' is already listed on Shopify",
                        "already_listed": True,
                        "shopify_product_id": listing_status["shopify_product_id"],
                        "listed_at": listing_status["listed_at"]
                    }

            product_title = mongo_doc.get("title", "Untitled")

            product_id = self.create_shopify_product(mongo_doc)
            
            if not product_id:
                return {
                    "success": False,
                    "error": "Failed to create product",
                    "message": "Could not create product in Shopify"
                }

            image_urls = mongo_doc.get("images", [])
            images_processed = 0
            
            if image_urls:
                resource_urls = self.process_images(image_urls)
                if resource_urls:
                    if self.link_images_to_product(product_id, resource_urls, product_title):
                        images_processed = len(resource_urls)

            # Mark product as listed in database
            self.mark_product_as_listed(sku, product_id)

            return {
                "success": True,
                "message": "Product synced successfully",
                "data": {
                    "shopify_product_id": product_id,
                    "product_title": product_title,
                    "sku": sku,
                    "images_total": len(image_urls),
                    "images_processed": images_processed,
                    "category": mongo_doc.get("category"),
                    "manufacturer": mongo_doc.get("manufacturer"),
                    "listed_at": datetime.utcnow().isoformat()
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": "Sync failed",
                "message": str(e)
            }

    def get_multiple_listing_status(self, skus: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get listing status for multiple SKUs"""
        try:
            products = list(self.collection.find(
                {"sku": {"$in": skus}},
                {"sku": 1, "listed_on_shopify": 1, "shopify_product_id": 1, "listed_at": 1, "title": 1}
            ))
            
            result = {}
            for sku in skus:
                product = next((p for p in products if p.get("sku") == sku), None)
                if product:
                    result[sku] = {
                        "exists": True,
                        "listed": product.get("listed_on_shopify", False),
                        "shopify_product_id": product.get("shopify_product_id"),
                        "listed_at": product.get("listed_at"),
                        "title": product.get("title", "Unknown Product")
                    }
                else:
                    result[sku] = {
                        "exists": False,
                        "listed": False,
                        "message": "Product not found"
                    }
            
            return result
        except Exception as e:
            print(f"Error getting multiple listing status: {str(e)}")
            return {}

    def close_connection(self):
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()