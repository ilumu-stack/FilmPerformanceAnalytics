"""Add risk_level to predictions, performance indexes

Revision ID: 002_indexes
Revises: 001_initial
Create Date: 2025-05-29
"""

from alembic import op
import sqlalchemy as sa

revision      = "002_indexes"
down_revision = "001_initial"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # Add risk_level column to predictions (safe: nullable, no default required)
    op.add_column("predictions", sa.Column("risk_level", sa.String(20), nullable=True))

    # Performance indexes for common query patterns
    op.create_index("ix_predictions_user_id",    "predictions",        ["user_id"])
    op.create_index("ix_predictions_created_at", "predictions",        ["created_at"])
    op.create_index("ix_movies_revenue",         "movies",             ["revenue"])
    op.create_index("ix_movies_release_date",    "movies",             ["release_date"])
    op.create_index("ix_sentiment_movie_id",     "audience_sentiment", ["movie_id"])
    op.create_index("ix_sentiment_created_at",   "audience_sentiment", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_sentiment_created_at",   "audience_sentiment")
    op.drop_index("ix_sentiment_movie_id",     "audience_sentiment")
    op.drop_index("ix_movies_release_date",    "movies")
    op.drop_index("ix_movies_revenue",         "movies")
    op.drop_index("ix_predictions_created_at", "predictions")
    op.drop_index("ix_predictions_user_id",    "predictions")
    op.drop_column("predictions", "risk_level")
