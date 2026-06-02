"""Initial schema — all FilmIQ tables

Revision ID: 001_initial
Revises: 
Create Date: 2025-05-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id",              sa.Integer(),     primary_key=True),
        sa.Column("email",           sa.String(255),   nullable=False, unique=True),
        sa.Column("username",        sa.String(100),   nullable=True,  unique=True),
        sa.Column("hashed_password", sa.String(255),   nullable=False),
        sa.Column("full_name",       sa.String(200),   nullable=True),
        sa.Column("role",            sa.String(50),    nullable=False, server_default="filmmaker"),
        sa.Column("organisation",    sa.String(200),   nullable=True),
        sa.Column("country",         sa.String(100),   nullable=True, server_default="Uganda"),
        sa.Column("is_active",       sa.Boolean(),     nullable=False, server_default="true"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_email",    "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # genres
    op.create_table(
        "genres",
        sa.Column("id",              sa.Integer(), primary_key=True),
        sa.Column("name",            sa.String(100), nullable=False, unique=True),
        sa.Column("slug",            sa.String(100), nullable=True,  unique=True),
        sa.Column("avg_revenue",     sa.Float(), server_default="0"),
        sa.Column("avg_roi",         sa.Float(), server_default="0"),
        sa.Column("mlr_coefficient", sa.Float(), server_default="0"),
        sa.Column("risk_score",      sa.Float(), server_default="50"),
    )

    # persons
    op.create_table(
        "persons",
        sa.Column("id",                   sa.Integer(), primary_key=True),
        sa.Column("tmdb_person_id",       sa.Integer(), unique=True, nullable=True),
        sa.Column("name",                 sa.String(300), nullable=False),
        sa.Column("known_for_department", sa.String(100), nullable=True),
        sa.Column("nationality",          sa.String(100), nullable=True),
        sa.Column("popularity_score",     sa.Float(), server_default="0"),
        sa.Column("avg_film_revenue",     sa.Float(), server_default="0"),
        sa.Column("avg_roi",              sa.Float(), server_default="0"),
        sa.Column("total_box_office",     sa.Float(), server_default="0"),
        sa.Column("film_count",           sa.Integer(), server_default="0"),
        sa.Column("awards_count",         sa.Integer(), server_default="0"),
        sa.Column("mlr_contribution",     sa.Float(), server_default="0"),
    )
    op.create_index("ix_persons_name", "persons", ["name"])

    # movies
    op.create_table(
        "movies",
        sa.Column("id",                   sa.Integer(), primary_key=True),
        sa.Column("tmdb_id",              sa.Integer(), unique=True, nullable=True),
        sa.Column("title",                sa.String(500), nullable=False),
        sa.Column("original_title",       sa.String(500), nullable=True),
        sa.Column("overview",             sa.Text(),      nullable=True),
        sa.Column("tagline",              sa.String(500), nullable=True),
        sa.Column("budget",               sa.Float(), server_default="0"),
        sa.Column("revenue",              sa.Float(), server_default="0"),
        sa.Column("roi",                  sa.Float(), nullable=True),
        sa.Column("runtime",              sa.Integer(), nullable=True),
        sa.Column("release_date",         sa.String(20), nullable=True),
        sa.Column("original_language",    sa.String(10), nullable=True),
        sa.Column("vote_average",         sa.Float(), server_default="0"),
        sa.Column("vote_count",           sa.Integer(), server_default="0"),
        sa.Column("popularity",           sa.Float(), server_default="0"),
        sa.Column("poster_path",          sa.String(300), nullable=True),
        sa.Column("is_ip_adaptation",     sa.Boolean(), server_default="false"),
        sa.Column("production_countries", postgresql.JSON(), nullable=True),
        sa.Column("production_companies", postgresql.JSON(), nullable=True),
        sa.Column("heat_index",           sa.Float(), nullable=True),
        sa.Column("intended_audience",    sa.Integer(), nullable=True),
        sa.Column("sentiment_score",      sa.Float(), nullable=True),
        sa.Column("first_day_box_office", sa.Float(), nullable=True),
        sa.Column("positive_comments",    sa.Integer(), nullable=True),
        sa.Column("neutral_comments",     sa.Integer(), nullable=True),
        sa.Column("negative_comments",    sa.Integer(), nullable=True),
        sa.Column("is_african_content",   sa.Boolean(), server_default="false"),
        sa.Column("african_region",       sa.String(100), nullable=True),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",           sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_movies_title",   "movies", ["title"])
    op.create_index("ix_movies_tmdb_id", "movies", ["tmdb_id"])

    # movie_genres
    op.create_table(
        "movie_genres",
        sa.Column("movie_id", sa.Integer(), sa.ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("genre_id", sa.Integer(), sa.ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
    )

    # movie_cast
    op.create_table(
        "movie_cast",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("movie_id",   sa.Integer(), sa.ForeignKey("movies.id",   ondelete="CASCADE")),
        sa.Column("person_id",  sa.Integer(), sa.ForeignKey("persons.id",  ondelete="CASCADE")),
        sa.Column("character",  sa.String(300), nullable=True),
        sa.Column("cast_order", sa.Integer(), nullable=True),
    )

    # movie_crew
    op.create_table(
        "movie_crew",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("movie_id",   sa.Integer(), sa.ForeignKey("movies.id",  ondelete="CASCADE")),
        sa.Column("person_id",  sa.Integer(), sa.ForeignKey("persons.id", ondelete="CASCADE")),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("job",        sa.String(200), nullable=True),
    )

    # predictions
    op.create_table(
        "predictions",
        sa.Column("id",                        sa.Integer(), primary_key=True),
        sa.Column("user_id",                   sa.Integer(), sa.ForeignKey("users.id",  ondelete="SET NULL"), nullable=True),
        sa.Column("movie_id",                  sa.Integer(), sa.ForeignKey("movies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("input_budget",              sa.Float(), nullable=True),
        sa.Column("input_genre",               sa.String(100), nullable=True),
        sa.Column("input_director_score",      sa.Float(), nullable=True),
        sa.Column("input_cast_score",          sa.Float(), nullable=True),
        sa.Column("input_season",              sa.String(50), nullable=True),
        sa.Column("input_market",              sa.String(100), nullable=True),
        sa.Column("input_logline",             sa.Text(), nullable=True),
        sa.Column("predicted_revenue",         sa.Float(), nullable=True),
        sa.Column("predicted_opening_weekend", sa.Float(), nullable=True),
        sa.Column("predicted_roi",             sa.Float(), nullable=True),
        sa.Column("confidence_score",          sa.Float(), nullable=True),
        sa.Column("model_used",                sa.String(50), server_default="CNN-C"),
        sa.Column("genre_multiplier",          sa.Float(), nullable=True),
        sa.Column("sentiment_boost",           sa.Float(), nullable=True),
        sa.Column("seasonal_multiplier",       sa.Float(), nullable=True),
        sa.Column("cast_multiplier",           sa.Float(), nullable=True),
        sa.Column("ai_analysis",               sa.Text(), nullable=True),
        sa.Column("risk_level",                sa.String(20), nullable=True),
        sa.Column("status",                    sa.String(20), server_default="completed"),
        sa.Column("created_at",                sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # audience_sentiment
    op.create_table(
        "audience_sentiment",
        sa.Column("id",                  sa.Integer(), primary_key=True),
        sa.Column("movie_id",            sa.Integer(), sa.ForeignKey("movies.id", ondelete="CASCADE")),
        sa.Column("source",              sa.String(50), nullable=True),
        sa.Column("raw_text",            sa.Text(), nullable=True),
        sa.Column("label",               sa.String(20), nullable=True),
        sa.Column("score",               sa.Float(), nullable=True),
        sa.Column("tfidf_weight",        sa.Float(), nullable=True),
        sa.Column("weighted_score",      sa.Float(), nullable=True),
        sa.Column("days_before_release", sa.Integer(), nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # streaming_stats
    op.create_table(
        "streaming_stats",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("movie_id",     sa.Integer(), sa.ForeignKey("movies.id", ondelete="CASCADE")),
        sa.Column("platform",     sa.String(100), nullable=True),
        sa.Column("region",       sa.String(100), nullable=True),
        sa.Column("views_count",  sa.Integer(), server_default="0"),
        sa.Column("watch_hours",  sa.Float(),   server_default="0"),
        sa.Column("peak_rank",    sa.Integer(), nullable=True),
        sa.Column("revenue_usd",  sa.Float(),   server_default="0"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # investors
    op.create_table(
        "investors",
        sa.Column("id",                   sa.Integer(), primary_key=True),
        sa.Column("user_id",              sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True),
        sa.Column("portfolio_value_usd",  sa.Float(), server_default="0"),
        sa.Column("risk_tolerance",       sa.String(20), server_default="moderate"),
        sa.Column("preferred_genres",     postgresql.JSON(), nullable=True),
        sa.Column("preferred_regions",    postgresql.JSON(), nullable=True),
        sa.Column("total_invested",       sa.Float(), server_default="0"),
        sa.Column("total_returns",        sa.Float(), server_default="0"),
        sa.Column("roi_to_date",          sa.Float(), server_default="0"),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # reports
    op.create_table(
        "reports",
        sa.Column("id",            sa.Integer(), primary_key=True),
        sa.Column("user_id",       sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title",         sa.String(300), nullable=True),
        sa.Column("report_type",   sa.String(100), nullable=True),
        sa.Column("filters",       postgresql.JSON(), nullable=True),
        sa.Column("data_snapshot", postgresql.JSON(), nullable=True),
        sa.Column("file_path",     sa.String(500), nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in [
        "reports", "investors", "streaming_stats", "audience_sentiment",
        "predictions", "movie_crew", "movie_cast", "movie_genres",
        "movies", "persons", "genres", "users",
    ]:
        op.drop_table(table)
