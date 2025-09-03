import os
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from openai import OpenAI
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Request/Response Models
class ProductData(BaseModel):
    sku: str
    title: str
    category: str
    manufacturer: Optional[str] = None
    main_color: Optional[str] = None
    colors: Optional[List[str]] = []
    description: Optional[List[str]] = []
    features: Optional[List[str]] = []
    warranty: Optional[List[str]] = []
    breadcrumbs: Optional[List[str]] = []
    status: Optional[str] = None

class BatchProductRequest(BaseModel):
    products: List[ProductData]

class GeneratedContent(BaseModel):
    sku: str
    original_title: str
    generated_title: str
    generated_description: str
    category: str
    prompt_used: str

class DescriptionResponse(BaseModel):
    success: bool
    data: GeneratedContent
    message: Optional[str] = None

class BatchDescriptionResponse(BaseModel):
    success: bool
    data: List[GeneratedContent]
    processed_count: int
    failed_count: int
    message: Optional[str] = None

# Prompt loading functions
def get_prompts_directory():
    """Get the prompts directory path"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, "..", "prompts")

def load_category_prompt(category: str) -> Dict[str, str]:
    """Load prompts for a specific category from the prompts folder"""
    prompts_dir = get_prompts_directory()
    category_file = os.path.join(prompts_dir, f"{category.lower().replace(' ', '_')}.txt")
    
    # Try to load category-specific prompt
    if os.path.exists(category_file):
        try:
            with open(category_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                
            # Split content into title and description prompts
            if "---TITLE---" in content and "---DESCRIPTION---" in content:
                parts = content.split("---TITLE---")
                if len(parts) == 2:
                    description_part = parts[0].strip()
                    title_part = parts[1].replace("---DESCRIPTION---", "").strip()
                    return {
                        "title": title_part,
                        "description": description_part
                    }
            
            # If no split found, use entire content as description prompt
            return {
                "title": get_default_title_prompt(),
                "description": content
            }
            
        except Exception as e:
            logger.warning(f"Error loading category prompt for {category}: {e}")
            return get_default_prompts()
    
    # Return default prompts if category file not found
    logger.info(f"No specific prompt found for category: {category}, using default")
    return get_default_prompts()

def get_default_prompts() -> Dict[str, str]:
    """Get default prompts when category-specific ones aren't available"""
    return {
        "title": get_default_title_prompt(),
        "description": get_default_description_prompt()
    }

def get_default_title_prompt() -> str:
    """Default title generation prompt"""
    return """
Generate a concise, SEO-friendly product title following this format:
BRAND | SERIES/COLLECTION | PRODUCT TYPE | MAIN COLOR | SIZE

Rules:
1. Use pipe separators (|) between main elements
2. Keep it under 70 characters when possible
3. Include the most important product identifiers
4. Make it search-engine friendly
5. Ensure it's more descriptive than the original title

Product data will be provided in JSON format.
Return only the title, no explanation.
"""

def get_default_description_prompt() -> str:
    """Default description generation prompt"""
    return """
You are a product HTML description generator.

Generate a clean HTML product description using ONLY basic HTML tags: <p>, <ul>, <li>, <strong>, and <em>.

Follow these formatting rules:
1. Start with product name in uppercase using <p><strong> tags
2. Include "Also available in" line if multiple colors exist
3. Add Product Features section with relevant details
4. Add Warranty section if warranty information is present
5. End with a marketing paragraph highlighting key benefits

DO NOT include CSS classes, inline styles, or external links.
Return only the HTML content, no JSON wrapper.
"""

def generate_content(product_data: ProductData, prompts: Dict[str, str]) -> Dict[str, str]:
    """Generate both title and description for a product"""
    
    # Prepare product data for the prompts
    product_json = {
        "sku": product_data.sku,
        "title_raw": product_data.title,
        "manufacturer": product_data.manufacturer,
        "category": product_data.category,
        "main_color": product_data.main_color,
        "colors": product_data.colors or [],
        "description": product_data.description or [],
        "features": product_data.features or [],
        "warranty": product_data.warranty or [],
        "breadcrumbs": product_data.breadcrumbs or [],
        "status": product_data.status
    }
    
    product_data_str = json.dumps(product_json, indent=2)
    
    try:
        # Generate title
        title_prompt = prompts["title"] + "\n\nProduct data:\n" + product_data_str
        title_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Return only the requested title, no explanation or formatting."},
                {"role": "user", "content": title_prompt}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        generated_title = title_response.choices[0].message.content.strip()
        
        # Generate description
        description_prompt = prompts["description"] + "\n\nProduct data:\n" + product_data_str
        description_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Return only clean HTML content using basic tags. No JSON, no code blocks, just the HTML."},
                {"role": "user", "content": description_prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        generated_description = description_response.choices[0].message.content.strip()
        
        # Clean up any potential code block markers
        if generated_description.startswith("```html"):
            generated_description = generated_description[7:]
        if generated_description.endswith("```"):
            generated_description = generated_description[:-3]
        
        return {
            "title": generated_title.strip(),
            "description": generated_description.strip()
        }
        
    except Exception as e:
        logger.error(f"Error generating content for SKU {product_data.sku}: {e}")
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")

# API Routes
@router.post("/generate-description", response_model=DescriptionResponse)
async def generate_single_description(product: ProductData):
    """Generate description and title for a single product"""
    try:
        # Load prompts for the product category
        prompts = load_category_prompt(product.category)
        
        # Generate content
        generated_content = generate_content(product, prompts)
        
        result = GeneratedContent(
            sku=product.sku,
            original_title=product.title,
            generated_title=generated_content["title"],
            generated_description=generated_content["description"],
            category=product.category,
            prompt_used=f"{product.category.lower().replace(' ', '_')}.txt"
        )
        
        return DescriptionResponse(
            success=True,
            data=result,
            message="Description generated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_single_description: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate description: {str(e)}")

@router.post("/generate-descriptions/batch", response_model=BatchDescriptionResponse)
async def generate_batch_descriptions(request: BatchProductRequest):
    """Generate descriptions and titles for multiple products"""
    if not request.products:
        raise HTTPException(status_code=400, detail="No products provided")
    
    if len(request.products) > 100:  # Limit batch size
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 100 products")
    
    results = []
    failed_count = 0
    
    for product in request.products:
        try:
            # Load prompts for the product category
            prompts = load_category_prompt(product.category)
            
            # Generate content
            generated_content = generate_content(product, prompts)
            
            result = GeneratedContent(
                sku=product.sku,
                original_title=product.title,
                generated_title=generated_content["title"],
                generated_description=generated_content["description"],
                category=product.category,
                prompt_used=f"{product.category.lower().replace(' ', '_')}.txt"
            )
            
            results.append(result)
            
        except Exception as e:
            logger.error(f"Error processing product {product.sku}: {e}")
            failed_count += 1
            continue
    
    processed_count = len(results)
    
    return BatchDescriptionResponse(
        success=True,
        data=results,
        processed_count=processed_count,
        failed_count=failed_count,
        message=f"Processed {processed_count} products successfully, {failed_count} failed"
    )

@router.get("/categories")
async def get_available_categories():
    """Get list of categories that have custom prompts available"""
    try:
        prompts_dir = get_prompts_directory()
        
        if not os.path.exists(prompts_dir):
            return {
                "success": True,
                "categories": [],
                "message": "Prompts directory not found, using default prompts only"
            }
        
        categories = []
        for filename in os.listdir(prompts_dir):
            if filename.endswith('.txt'):
                category_name = filename[:-4].replace('_', ' ').title()
                categories.append({
                    "name": category_name,
                    "filename": filename,
                    "has_custom_prompt": True
                })
        
        return {
            "success": True,
            "categories": categories,
            "total": len(categories),
            "message": f"Found {len(categories)} categories with custom prompts"
        }
        
    except Exception as e:
        logger.error(f"Error listing categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to list categories")

@router.get("/categories/{category}/prompt")
async def get_category_prompt(category: str):
    """Get the prompt content for a specific category"""
    try:
        prompts = load_category_prompt(category)
        
        return {
            "success": True,
            "category": category,
            "prompts": prompts,
            "message": "Prompts retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error getting prompt for category {category}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve category prompt")

