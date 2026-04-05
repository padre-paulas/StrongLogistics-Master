import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, full_name, role='driver', password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, full_name, role='admin', password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [('admin', 'Admin'), ('dispatcher', 'Dispatcher'), ('driver', 'Driver')]
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='driver')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    vehicle_plate = models.CharField(max_length=20, blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return self.email


class Resource(models.Model):
    name = models.CharField(max_length=100, unique=True)
    unit = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class DeliveryPoint(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    def __str__(self):
        return self.name


class StockItem(models.Model):
    delivery_point = models.ForeignKey(DeliveryPoint, on_delete=models.CASCADE, related_name='stock')
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=0)

    class Meta:
        unique_together = ('delivery_point', 'resource')

    def __str__(self):
        return f"{self.delivery_point} - {self.resource}"


def generate_order_id():
    """Generate a unique order ID using a short UUID segment."""
    return f"ORD-{uuid.uuid4().hex[:6].upper()}"


class Order(models.Model):
    PRIORITY_CHOICES = [('normal', 'Normal'), ('elevated', 'Elevated'), ('critical', 'Critical')]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('dispatched', 'Dispatched'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]

    order_id = models.CharField(max_length=20, unique=True, default=generate_order_id)
    delivery_point = models.ForeignKey(DeliveryPoint, on_delete=models.CASCADE, related_name='orders')
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    driver = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_orders', limit_choices_to={'role': 'driver'}
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.order_id


class StatusHistoryEntry(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=20)
    timestamp = models.DateTimeField(auto_now_add=True)
    changed_by = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.order} - {self.status}"


class AutoAssignPlan(models.Model):
    plan_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignments_json = models.JSONField()
    total_distance_km = models.FloatField()
    estimated_time_minutes = models.FloatField()
    is_confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.plan_id)


class RouteBlockage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    point = models.ForeignKey(DeliveryPoint, on_delete=models.CASCADE, related_name='blockages')
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Blockage at {self.point}"


class DemandSetting(models.Model):
    LEVEL_CHOICES = [('low', 'Low'), ('normal', 'Normal'), ('high', 'High'), ('surge', 'Surge')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    point = models.ForeignKey(DeliveryPoint, on_delete=models.CASCADE, related_name='demand_settings')
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='normal')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('point', 'resource')

    def __str__(self):
        return f"{self.point} - {self.resource} - {self.level}"
