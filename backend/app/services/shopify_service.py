import requests
import os
import tempfile
from urllib.parse import urlparse
import pymongo
from typing import List, Dict, Any, Optional
import json
import time
from dotenv import load_dotenv

load_dotenv()


class ShopifySyncService:
    def __init__(self):
        """Initialize the Shopify sync service with environment variables"""
        self.shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
        self.access_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        # MongoDB connection using environment variables
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        collection_name = os.getenv("MONGO_COLLECTION", "products")
        
        self.mongo_client = pymongo.MongoClient(mongo_uri)
        self.db = self.mongo_client[db_name]
        self.collection = self.db[collection_name]

    def download_image_from_url(self, image_url: str) -> tuple[str, str]:
        """Download image from URL with retry logic"""
        try:
            print(f"⬇️  Downloading image: {image_url}")

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

            # Get filename from URL
            parsed_url = urlparse(image_url)
            filename = os.path.basename(parsed_url.path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time())}.jpg"

            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}")

            # Download file content
            total_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    temp_file.write(chunk)
                    total_size += len(chunk)

            temp_file.close()
            print(f"✅ Downloaded {total_size} bytes")
            return temp_file.name, filename

        except Exception as e:
            print(f"❌ Error downloading image: {str(e)}")
            raise

    def create_staged_upload(self, filename: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """Create staged upload URL for Shopify"""
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
        """Upload image to Shopify S3"""
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

            # Clean up temp file
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
        """Process list of image URLs"""
        if not image_urls:
            return []

        resource_urls = []
        for i, image_url in enumerate(image_urls):
            try:
                temp_file_path, filename = self.download_image_from_url(image_url)
                resource_url = self.upload_image_to_shopify_s3(temp_file_path, filename)
                resource_urls.append(resource_url)
                time.sleep(1)  # Rate limiting
            except Exception as e:
                print(f"❌ Failed to process image {i+1}: {str(e)}")
                continue

        return resource_urls

    def link_images_to_product(self, product_id: str, resource_urls: List[str], product_title: str = "") -> bool:
        """Link uploaded images to Shopify product"""
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
            print(f"❌ Error linking images: {str(e)}")
            return False

    def update_variant_with_sku(self, product_id: str, variants_data: List[Dict], mongo_doc: Dict[str, Any]) -> bool:
        """Update variant with pricing and SKU"""
        try:
            if not variants_data:
                return False

            default_variant = variants_data[0].get("node", {})
            variant_id = default_variant.get("id")

            if not variant_id:
                return False

            # Get pricing from environment or use defaults
            price = float(os.getenv("DEFAULT_PRICE", "179.00"))
            compare_at_price = float(os.getenv("DEFAULT_COMPARE_PRICE", "224.00"))
            cost_per_item = float(os.getenv("DEFAULT_COST", "95.00"))

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
                "price": str(price),
                "compareAtPrice": str(compare_at_price),
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
            print(f"❌ Error updating variant: {str(e)}")
            return False

    def create_shopify_product(self, mongo_doc: Dict[str, Any]) -> Optional[str]:
        """Create product in Shopify from MongoDB document"""
        try:
            # Format description
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

            # Generate tags
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

            # Update variant with SKU and pricing
            variants_data = product.get("variants", {}).get("edges", [])
            self.update_variant_with_sku(product_id, variants_data, mongo_doc)

            return product_id

        except Exception as e:
            print(f"❌ Error creating product: {str(e)}")
            return None

    def sync_product_by_sku(self, sku: str) -> Dict[str, Any]:
        """Sync a product to Shopify by SKU"""
        try:
            # Find product in MongoDB
            mongo_doc = self.collection.find_one({"sku": sku})
            
            if not mongo_doc:
                return {
                    "success": False,
                    "error": "Product not found",
                    "message": f"No product found with SKU: {sku}"
                }

            product_title = mongo_doc.get("title", "Untitled")

            # Create product in Shopify
            product_id = self.create_shopify_product(mongo_doc)
            
            if not product_id:
                return {
                    "success": False,
                    "error": "Failed to create product",
                    "message": "Could not create product in Shopify"
                }

            # Process images
            image_urls = mongo_doc.get("images", [])
            images_processed = 0
            
            if image_urls:
                resource_urls = self.process_images(image_urls)
                if resource_urls:
                    if self.link_images_to_product(product_id, resource_urls, product_title):
                        images_processed = len(resource_urls)

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
                    "manufacturer": mongo_doc.get("manufacturer")
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": "Sync failed",
                "message": str(e)
            }

    def close_connection(self):
        """Close MongoDB connection"""
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()