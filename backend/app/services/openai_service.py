import os
import json
import asyncio
import aiofiles
import httpx
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
from pathlib import Path
from ..core.config import settings
import time
import random

class OpenAIContentService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            max_retries=3   
        )
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    def extract_response_text(self, response) -> str:
        """Extract text content from OpenAI response object"""
        try:
            if hasattr(response, 'choices') and response.choices:
                choice = response.choices[0]
                if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                    return choice.message.content
                elif hasattr(choice, 'text'):
                    return choice.text
            
            return str(response)
            
        except Exception as e:
            print(f"ERROR: Failed to extract text from response: {str(e)}")
            return str(response)
    
    async def read_prompt_file(self, filename: str) -> str:
        """Read prompt file content with caching"""
        try:
            if not hasattr(self, '_prompt_cache'):
                self._prompt_cache = {}
            
            if filename in self._prompt_cache:
                return self._prompt_cache[filename]
            
            file_path = self.prompts_dir / filename
            if not file_path.exists():
                raise FileNotFoundError(f"Prompt file not found: {filename}")
            
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
                content = await file.read()
                self._prompt_cache[filename] = content.strip()
                return self._prompt_cache[filename]
                
        except Exception as e:
            print(f"ERROR: Error reading prompt file {filename}: {str(e)}")
            raise
    
    def extract_title_from_description(self, description_html: str) -> str:
        """Extract title from first <p><b> or <p><strong> tag in description"""
        try:
            import re
            patterns = [
                r'<p><strong>(.*?)</strong></p>',
                r'<p><b>(.*?)</b></p>',
                r'<strong>(.*?)</strong>',
                r'<b>(.*?)</b>'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, description_html, re.IGNORECASE | re.DOTALL)
                if match:
                    title = match.group(1).strip()
                    return title
            
            return ""
        except Exception as e:
            print(f"ERROR: Error extracting title: {str(e)}")
            return ""
    
    def parse_collections_and_tags(self, ai_response: str) -> Dict[str, Any]:
        """Parse AI response to extract collections and tags"""
        try:
            collections = []
            tags = []
            
            cleaned_response = ai_response.strip()
            
            if cleaned_response.startswith('```json') and cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[7:-3].strip()
            elif cleaned_response.startswith('```') and cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[3:-3].strip()
            
            try:
                data = json.loads(cleaned_response)
                return {
                    "collections": data.get("collections", []),
                    "tags": data.get("tags", [])
                }
            except json.JSONDecodeError:
                pass
            
            import re
            
            collections_match = re.search(r'"?collections"?\s*:\s*\[(.*?)\]', cleaned_response, re.IGNORECASE | re.DOTALL)
            if collections_match:
                collections_text = collections_match.group(1)
                collections = []
                for item in collections_text.split(','):
                    clean_item = item.strip().strip('"\'').strip()
                    if clean_item:
                        collections.append(clean_item)
            
            tags_match = re.search(r'"?tags"?\s*:\s*\[(.*?)\]', cleaned_response, re.IGNORECASE | re.DOTALL)
            if tags_match:
                tags_text = tags_match.group(1)
                tags = []
                for item in tags_text.split(','):
                    clean_item = item.strip().strip('"\'').strip()
                    if clean_item:
                        tags.append(clean_item)
            
            return {
                "collections": collections,
                "tags": tags
            }
            
        except Exception as e:
            print(f"ERROR: Failed to parse collections and tags: {e}")
            return {
                "collections": [],
                "tags": []
            }
    
    async def _make_api_call_with_retry(self, messages: List[Dict], max_retries: int = 3) -> str:
        """Make API call with exponential backoff retry"""
        for attempt in range(max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model="gpt-5",  
                    messages=messages,
                    response_format={"type": "text"},
                    reasoning_effort="medium",  
                )
                
                return self.extract_response_text(response)
                
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"API call failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time:.2f}s: {str(e)}")
                await asyncio.sleep(wait_time)
        
        raise Exception("Max retries exceeded")
    
    async def generate_description(self, product_data: Dict[str, Any], category: str) -> str:
        """Generate product description using optimized API calls"""
        try:
            if not category or category.lower() == 'none':
                raise ValueError("Category cannot be None or empty")
            
            prompt_file = f"{category.lower()}_des.txt"
            system_prompt = await self.read_prompt_file(prompt_file)
            
            ai_input = {
                "category": product_data.get("category", ""),
                "manufacturer": product_data.get("manufacturer", ""),
                "features": product_data.get("features", []),
                "colors": product_data.get("colors", []),
                "description": product_data.get("description", []),
                "main_color": product_data.get("main_color", ""),
                "title": product_data.get("title", ""),
                "sku": product_data.get("sku", "")
            }
            
            full_prompt = f"{system_prompt}\n\nProduct Data: {json.dumps(ai_input, indent=2)}"

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": full_prompt
                        }
                    ]
                }
            ]
            
            description = await self._make_api_call_with_retry(messages)
            return description.strip()
            
        except FileNotFoundError as e:
            raise ValueError(f"Prompt file not found for category '{category}': {str(e)}")
        except Exception as e:
            print(f"ERROR: Error generating description: {str(e)}")
            raise
    
    async def generate_tags_and_collections(self, product_data: Dict[str, Any], category: str) -> Dict[str, Any]:
        """Generate product tags and collections using optimized API calls"""
        try:
            if not category or category.lower() == 'none':
                raise ValueError("Category cannot be None or empty")
            
            prompt_file = f"{category.lower()}_tag.txt"
            system_prompt = await self.read_prompt_file(prompt_file)
            
            ai_input = {
                "category": product_data.get("category", ""),
                "manufacturer": product_data.get("manufacturer", ""),
                "features": product_data.get("features", []),
                "colors": product_data.get("colors", []),
                "description": product_data.get("description", []),
                "main_color": product_data.get("main_color", ""),
                "title": product_data.get("title", ""),
                "sku": product_data.get("sku", "")
            }
            
            full_prompt = f"{system_prompt}\n\nProduct Data: {json.dumps(ai_input, indent=2)}"
            
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": full_prompt
                        }
                    ]
                }
            ]
            
            ai_response = await self._make_api_call_with_retry(messages)
            result = self.parse_collections_and_tags(ai_response.strip())
            return result
            
        except FileNotFoundError as e:
            error_msg = f"Prompt file not found for category '{category}': {str(e)}"
            print(f"ERROR: {error_msg}")
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Error generating tags and collections: {str(e)}"
            print(f"ERROR: {error_msg}")
            raise
    
    async def generate_all_content(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate all AI content for a product using optimized concurrent calls"""
        try:
            category = product_data.get("category", "").strip()
            sku = product_data.get("sku", "Unknown")
            
            if not category or category.lower() == 'none':
                raise ValueError("Product category is required and cannot be None")
            
            print(f"Generating AI content for SKU: {sku}, Category: {category}")
            
            description_task = self.generate_description(product_data, category)
            tags_task = self.generate_tags_and_collections(product_data, category)
            
            gen_description, tags_collections = await asyncio.gather(
                description_task, tags_task
            )
            
            gen_title = self.extract_title_from_description(gen_description)
            
            result = {
                "gen_description": gen_description,
                "gen_title": gen_title,
                "gen_tags": tags_collections.get("tags", []),
                "gen_collection": tags_collections.get("collections", [])
            }
            
            print(f"AI content generated for SKU {sku}: Title='{gen_title}', Tags={len(result['gen_tags'])}, Collections={len(result['gen_collection'])}")
            
            return result
            
        except Exception as e:
            print(f"ERROR: Error generating content for product {sku}: {str(e)}")
            raise

    async def generate_bulk_content(self, products_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate content for multiple products with optimized concurrency"""
        try:
            print(f"Starting bulk AI content generation for {len(products_data)} products")
            
            semaphore = asyncio.Semaphore(10)  #
            
            async def limited_generate(product_data):
                async with semaphore:
                    try:
                        return await self.generate_all_content(product_data)
                    except Exception as e:
                        sku = product_data.get("sku", "unknown")
                        print(f"ERROR: Failed to generate content for SKU {sku}: {e}")
                        return {
                            "error": str(e),
                            "sku": sku
                        }
            
            batch_size = 20  
            all_results = []
            
            for i in range(0, len(products_data), batch_size):
                batch = products_data[i:i + batch_size]
                print(f"Processing batch {i//batch_size + 1}/{(len(products_data)-1)//batch_size + 1} ({len(batch)} products)")
                
                batch_tasks = [limited_generate(product) for product in batch]
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                # Process batch results
                for j, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        sku = batch[j].get("sku", "unknown")
                        print(f"ERROR: Exception for SKU {sku}: {result}")
                        all_results.append({
                            "error": str(result),
                            "sku": sku
                        })
                    else:
                        all_results.append(result)
                
                if i + batch_size < len(products_data):
                    await asyncio.sleep(1)
            
            return all_results
            
        except Exception as e:
            print(f"ERROR: Error generating bulk content: {str(e)}")
            raise
    
    async def close(self):
        """Close the async client"""
        if hasattr(self.client, 'close'):
            await self.client.close()