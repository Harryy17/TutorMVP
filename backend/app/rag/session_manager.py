"""
Session Manager — Cloud-Native Session & State Manager powered by pgvector_store.
Handles session lifecycles, topic roadmaps, and message histories in PostgreSQL.
"""
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.rag.pgvector_store import pgvector_store


class SessionManager:
    """Manages session metadata, chat histories, and curriculum topics via PostgreSQL."""

    def __init__(self):
        self.store = pgvector_store

    def create_session(self, subject: Optional[str] = None, title: Optional[str] = None, user_id: str = "default_user") -> Dict[str, Any]:
        """Creates a new study session in PostgreSQL."""
        session_id = f"session_{int(datetime.now().timestamp() * 1000)}"
        clean_sub = (subject or "General Study").strip()
        clean_title = (title or f"{clean_sub} Study Session").strip()

        self.store.ensure_session(session_id=session_id, subject=clean_sub, title=clean_title, user_id=user_id)
        return {
            "session_id": session_id,
            "title": clean_title,
            "subject": clean_sub,
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "last_active": datetime.now().isoformat(),
            "topics_count": 0,
            "messages_count": 0,
        }

    def list_sessions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns all study sessions from PostgreSQL, filtered by user_id."""
        sessions = self.store.get_all_sessions(user_id=user_id)
        formatted = []
        for s in sessions:
            formatted.append({
                "session_id": s.get("id"),
                "title": s.get("title"),
                "subject": s.get("subject"),
                "user_id": s.get("user_id"),
                "created_at": str(s.get("created_at", "")),
                "last_active": str(s.get("updated_at", "")),
                "file_name": s.get("file_name"),
            })
        return formatted

    def get_session_meta(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Gets metadata for a specific session."""
        state = self.store.get_session_state(session_id, user_id=user_id)
        if state and state.get("meta"):
            return {
                "session_id": session_id,
                "title": state["meta"].get("title"),
                "subject": state["meta"].get("subject"),
                "file_name": state["meta"].get("file_name"),
            }
        return None

    def update_session_meta(self, session_id: str, updates: Dict[str, Any], user_id: str = "default_user"):
        """Updates session title or subject."""
        self.store.ensure_session(
            session_id=session_id,
            subject=updates.get("subject", "General"),
            title=updates.get("title"),
            user_id=user_id,
        )

    def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """Deletes a session and cascades deletion to topics, messages, and chunks."""
        return self.store.clear_session(session_id, user_id=user_id)

    def save_session_state(
        self,
        session_id: str,
        messages: Optional[List[Dict[str, Any]]] = None,
        topics: Optional[List[Dict[str, Any]]] = None,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        file_name: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """Persists chat messages, topics, and metadata directly to PostgreSQL."""
        self.store.save_session_state(
            session_id=session_id,
            topics=topics,
            subject=subject,
            title=title,
            messages=messages,
            file_name=file_name,
            user_id=user_id,
        )

    def load_session_state(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Loads all saved messages, topics, and metadata from PostgreSQL."""
        state = self.store.get_session_state(session_id, user_id=user_id)
        if state:
            return state
        return None

    def get_session_state(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Alias for load_session_state."""
        return self.load_session_state(session_id, user_id=user_id)

    def init_session_database(self, session_id: str, user_id: str = "default_user"):
        """Ensures session is provisioned in PostgreSQL."""
        self.store.ensure_session(session_id, user_id=user_id)


# Central singleton instance
session_manager = SessionManager()
