import uvicorn

if __name__ == "__main__":
    print("Starting Simple Product API...")
    print("API will be available at: http://localhost:8000")
    print("Docs at: http://localhost:8000/docs")
    print("-" * 40)
    
    uvicorn.run(
        "app.main:app",
        host="localhost",
        port=8000,
        reload=False,
        log_level="info"
    )