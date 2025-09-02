from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .core.config import settings
from .core.database import get_mongo_client
from .services.fetch_status import FetchStatus
from .routes import health, products, scraping, shopify, vendors, admin,vendor_history

load_dotenv()

app = FastAPI(
    title="Simple Product API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
client = get_mongo_client()
fetch_status = FetchStatus(client)

app.state.client = client
app.state.fetch_status = fetch_status

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(products.router, prefix="/api", tags=["Products"])
app.include_router(scraping.router, prefix="/api", tags=["Scraping"])
app.include_router(shopify.router, prefix="/api", tags=["Shopify"])
app.include_router(vendors.router, prefix="/api", tags=["Vendors"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])
app.include_router(vendor_history.router, prefix="/api", tags=["Vendor History"])

@app.get("/")
async def root():
    return {"message": "Simple Product API is running", "docs": "/docs"}

print("Backend initialized with MongoDB-based fetch tracking and listing history")
print(f"Database: {settings.MONGO_DATABASE}")
print(f"Collection: {settings.MONGO_COLLECTION}")
print(f"Fetch tracking: MongoDB 'fetch' collection")
print(f"Listing history: MongoDB 'listing_history' collection")