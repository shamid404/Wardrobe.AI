from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .db.memory_store import USERS_DB

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # In production: verify JWT token here
    # For demo, any Bearer token returns demo user
    if credentials is None:
        return USERS_DB["user_demo"]
    return USERS_DB["user_demo"]
