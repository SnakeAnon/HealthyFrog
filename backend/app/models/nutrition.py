import enum

from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    calories_per_100g = Column(Float, nullable=False)
    protein_per_100g = Column(Float, default=0.0)
    fat_per_100g = Column(Float, default=0.0)
    carbs_per_100g = Column(Float, default=0.0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    meal_items = relationship("MealItem", back_populates="product")


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    meal_type = Column(Enum(MealType), nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="meals")
    items = relationship("MealItem", back_populates="meal", cascade="all, delete-orphan")


class MealItem(Base):
    __tablename__ = "meal_items"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    amount_grams = Column(Float, nullable=False)

    meal = relationship("Meal", back_populates="items")
    product = relationship("Product", back_populates="meal_items")
