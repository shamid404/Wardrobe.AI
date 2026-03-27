# Compatibility shim — delegates everything to backend package.
# Run as before: uvicorn main:app --reload
from backend.main import app

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
