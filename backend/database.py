"""
FilmIQ — Async Database Connection
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings


engine = create_async_engine(
    settings.sqlalchemy_url,
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """
    FastAPI dependency: yields an async DB session.

    Commit policy: each router is responsible for calling await db.commit()
    after its own writes. This dependency only handles rollback on unhandled
    exceptions — it does NOT auto-commit so routers that commit explicitly
    don't trigger a double-commit error.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
