import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

# Define database directory and file path
DB_DIRECTORY = "./db_data"
DB_FILE = "api_keys.db"
DATABASE_URL = f"sqlite:///{DB_DIRECTORY}/{DB_FILE}"

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models with specific configuration to avoid typing issues
Base = declarative_base()


def get_db():
    """
    Get a database session.
    This function is used as a dependency in FastAPI endpoints.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database sessions.
    This function is used for scripts and non-FastAPI contexts.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize the database by creating all tables.
    Ensures the database directory exists before creating tables.
    """
    # Ensure the database directory exists
    os.makedirs(DB_DIRECTORY, exist_ok=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)