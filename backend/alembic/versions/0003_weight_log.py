from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0003_weight_log"
down_revision: Union[str, None] = "0002_admin_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weight_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_weight_logs_user_date"),
    )
    op.create_index(op.f("ix_weight_logs_id"), "weight_logs", ["id"], unique=False)
    op.create_index(op.f("ix_weight_logs_user_id"), "weight_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_weight_logs_date"), "weight_logs", ["date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_weight_logs_date"), table_name="weight_logs")
    op.drop_index(op.f("ix_weight_logs_user_id"), table_name="weight_logs")
    op.drop_index(op.f("ix_weight_logs_id"), table_name="weight_logs")
    op.drop_table("weight_logs")
