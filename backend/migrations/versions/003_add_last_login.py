"""Add last_login to users

Revision ID: 003_last_login
Revises: 002_indexes
Create Date: 2025-05-29
"""

from alembic import op
import sqlalchemy as sa

revision      = "003_last_login"
down_revision = "002_indexes"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login")
