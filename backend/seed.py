"""
Seed script — populates the database with demo data.
Run after migrations:  python seed.py
"""
import asyncio
from datetime import datetime, timedelta, date, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.booking import Booking, BookingStatus, TimeSlot
from app.models.chat import Message
from app.models.metrics import WeightLog
from app.models.nutrition import Meal, MealItem, MealType, Product
from app.models.user import User, UserRole
from app.services.auth import hash_password

ADMIN_EMAIL = "admin@healthyfrog.local"
ADMIN_PASSWORD = "admin123"


async def ensure_admin_user(db) -> User:
    """Always ensure the dev admin exists (password from ADMIN_PASSWORD).

    The bulk seed below is skipped when demo data is present, but that skip
    used to leave no admin if someone registered before running ``seed.py``.
    """
    result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
    admin = result.scalar_one_or_none()
    if admin is None:
        admin = User(
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
            name="Administrator",
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        print(f"Created admin: {ADMIN_EMAIL}  (password: {ADMIN_PASSWORD})")
    return admin


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        admin = await ensure_admin_user(db)

        # Full demo dataset only once (marker: demo user John).
        demo_present = (
            await db.execute(select(User.id).where(User.email == "john@example.com"))
        ).scalar_one_or_none()
        if demo_present:
            print("Demo data already present — skipping bulk seed.")
            print(f"  {ADMIN_EMAIL}    — admin   (password: {ADMIN_PASSWORD})")
            return

        # ── Trainers ──────────────────────────────────────────────────────────
        trainer1 = User(
            email="alex@example.com",
            hashed_password=hash_password("password123"),
            role=UserRole.trainer,
            name="Alex Trainer",
            bio="Certified fitness trainer with 5+ years of experience in weight management.",
            specialty="Weight loss & cardio",
        )
        trainer2 = User(
            email="maria@example.com",
            hashed_password=hash_password("password123"),
            role=UserRole.trainer,
            name="Maria Coach",
            bio="Nutrition specialist and strength coach focused on body recomposition.",
            specialty="Muscle building & nutrition",
        )
        db.add_all([trainer1, trainer2])
        await db.flush()

        # ── Users ─────────────────────────────────────────────────────────────
        user1 = User(
            email="john@example.com",
            hashed_password=hash_password("password123"),
            role=UserRole.user,
            name="John Smith",
            age=28,
            height=180.0,
            weight=82.0,
            goal="Lose 10 kg",
            trainer_id=trainer1.id,
        )
        user2 = User(
            email="anna@example.com",
            hashed_password=hash_password("password123"),
            role=UserRole.user,
            name="Anna Lee",
            age=25,
            height=165.0,
            weight=58.0,
            goal="Build muscle",
            trainer_id=trainer2.id,
        )
        db.add_all([user1, user2])
        await db.flush()

        # ── Products ──────────────────────────────────────────────────────────
        products_data = [
            dict(name="Chicken Breast",  calories_per_100g=165, protein_per_100g=31.0, fat_per_100g=3.6,  carbs_per_100g=0.0),
            dict(name="Brown Rice",      calories_per_100g=112, protein_per_100g=2.6,  fat_per_100g=0.9,  carbs_per_100g=23.0),
            dict(name="Broccoli",        calories_per_100g=34,  protein_per_100g=2.8,  fat_per_100g=0.4,  carbs_per_100g=7.0),
            dict(name="Eggs",            calories_per_100g=155, protein_per_100g=13.0, fat_per_100g=11.0, carbs_per_100g=1.1),
            dict(name="Oatmeal",         calories_per_100g=389, protein_per_100g=17.0, fat_per_100g=7.0,  carbs_per_100g=66.0),
            dict(name="Banana",          calories_per_100g=89,  protein_per_100g=1.1,  fat_per_100g=0.3,  carbs_per_100g=23.0),
            dict(name="Greek Yogurt",    calories_per_100g=59,  protein_per_100g=10.0, fat_per_100g=0.4,  carbs_per_100g=3.6),
            dict(name="Salmon",          calories_per_100g=208, protein_per_100g=20.0, fat_per_100g=13.0, carbs_per_100g=0.0),
            dict(name="Sweet Potato",    calories_per_100g=86,  protein_per_100g=1.6,  fat_per_100g=0.1,  carbs_per_100g=20.0),
            dict(name="Almonds",         calories_per_100g=579, protein_per_100g=21.0, fat_per_100g=50.0, carbs_per_100g=22.0),
            dict(name="Cottage Cheese",  calories_per_100g=98,  protein_per_100g=11.0, fat_per_100g=4.3,  carbs_per_100g=3.4),
            dict(name="Olive Oil",       calories_per_100g=884, protein_per_100g=0.0,  fat_per_100g=100.0,carbs_per_100g=0.0),
            dict(name="Tuna (canned)",   calories_per_100g=132, protein_per_100g=29.0, fat_per_100g=1.0,  carbs_per_100g=0.0),
            dict(name="Whole Wheat Bread",calories_per_100g=247,protein_per_100g=9.0,  fat_per_100g=4.2,  carbs_per_100g=41.0),
            dict(name="Apple",           calories_per_100g=52,  protein_per_100g=0.3,  fat_per_100g=0.2,  carbs_per_100g=14.0),
        ]
        products = []
        for p in products_data:
            product = Product(**p, created_by=trainer1.id)
            db.add(product)
            products.append(product)
        await db.flush()

        # Map by name for readability
        by_name = {p.name: p for p in products}

        # ── Meals for John (today) ────────────────────────────────────────────
        today = date.today()
        breakfast = Meal(user_id=user1.id, date=today, meal_type=MealType.breakfast, name="Morning Oats")
        lunch     = Meal(user_id=user1.id, date=today, meal_type=MealType.lunch,     name="Chicken & Rice")
        snack     = Meal(user_id=user1.id, date=today, meal_type=MealType.snack,     name="Afternoon Snack")
        db.add_all([breakfast, lunch, snack])
        await db.flush()

        db.add(MealItem(meal_id=breakfast.id, product_id=by_name["Oatmeal"].id,      amount_grams=100))
        db.add(MealItem(meal_id=breakfast.id, product_id=by_name["Banana"].id,       amount_grams=120))
        db.add(MealItem(meal_id=breakfast.id, product_id=by_name["Greek Yogurt"].id, amount_grams=150))
        db.add(MealItem(meal_id=lunch.id,     product_id=by_name["Chicken Breast"].id, amount_grams=200))
        db.add(MealItem(meal_id=lunch.id,     product_id=by_name["Brown Rice"].id,   amount_grams=150))
        db.add(MealItem(meal_id=lunch.id,     product_id=by_name["Broccoli"].id,     amount_grams=100))
        db.add(MealItem(meal_id=snack.id,     product_id=by_name["Almonds"].id,      amount_grams=30))
        db.add(MealItem(meal_id=snack.id,     product_id=by_name["Apple"].id,        amount_grams=150))

        # ── Chat messages ─────────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        messages = [
            Message(sender_id=trainer1.id, receiver_id=user1.id,
                    content="Hi John! How are you feeling today? Ready for your workout? 💪"),
            Message(sender_id=user1.id,    receiver_id=trainer1.id,
                    content="Hi Alex! Feeling great — just finished breakfast. What's the plan?"),
            Message(sender_id=trainer1.id, receiver_id=user1.id,
                    content="30 min cardio followed by strength training. Don't forget to log your meals!"),
            Message(sender_id=user1.id,    receiver_id=trainer1.id,
                    content="Already logged breakfast. Oatmeal + banana + yogurt. See you at 6pm!"),
        ]
        db.add_all(messages)

        # ── Time slots ────────────────────────────────────────────────────────
        slots = [
            TimeSlot(trainer_id=trainer1.id,
                     start_time=now + timedelta(days=1, hours=8),
                     end_time=now   + timedelta(days=1, hours=9)),
            TimeSlot(trainer_id=trainer1.id,
                     start_time=now + timedelta(days=1, hours=10),
                     end_time=now   + timedelta(days=1, hours=11)),
            TimeSlot(trainer_id=trainer1.id,
                     start_time=now + timedelta(days=2, hours=9),
                     end_time=now   + timedelta(days=2, hours=10)),
            TimeSlot(trainer_id=trainer2.id,
                     start_time=now + timedelta(days=1, hours=14),
                     end_time=now   + timedelta(days=1, hours=15)),
            TimeSlot(trainer_id=trainer2.id,
                     start_time=now + timedelta(days=3, hours=10),
                     end_time=now   + timedelta(days=3, hours=11)),
        ]
        db.add_all(slots)

        # ── Weight history for John (last 14 days, gentle downtrend) ────────
        for offset, kg in enumerate([83.0, 82.7, 82.5, 82.4, 82.0, 81.7, 81.5]):
            db.add(
                WeightLog(
                    user_id=user1.id,
                    date=today - timedelta(days=offset * 2),
                    weight=kg,
                )
            )
        # Reflect the most recent measurement on the profile too.
        user1.weight = 81.5

        # ── Audit log demo entries ──────────────────────────────────────────
        now_utc = datetime.now(timezone.utc)
        demo_events = [
            (admin.id, "user.register", "user", admin.id, None),
            (trainer1.id, "user.register", "user", trainer1.id, None),
            (user1.id, "user.register", "user", user1.id, None),
            (user1.id, "user.login", "user", user1.id, None),
            (
                user1.id,
                "meal.create",
                "meal",
                breakfast.id,
                {"date": today.isoformat(), "meal_type": "breakfast"},
            ),
        ]
        for uid, action, etype, eid, payload in demo_events:
            db.add(
                AuditLog(
                    user_id=uid,
                    action=action,
                    entity_type=etype,
                    entity_id=eid,
                    payload=payload,
                    created_at=now_utc,
                )
            )

        await db.commit()

        print("Seed data created successfully!\n")
        print("Demo accounts (password: password123, except admin):")
        print("  john@example.com           — user    (trainer: Alex)")
        print("  anna@example.com           — user    (trainer: Maria)")
        print("  alex@example.com           — trainer")
        print("  maria@example.com          — trainer")
        print(f"  {ADMIN_EMAIL}    — admin   (password: {ADMIN_PASSWORD})")


if __name__ == "__main__":
    asyncio.run(seed())
