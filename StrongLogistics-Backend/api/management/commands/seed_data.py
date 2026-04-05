from django.core.management.base import BaseCommand
from api.models import User, Resource, DeliveryPoint, StockItem, Order, StatusHistoryEntry


class Command(BaseCommand):
    help = 'Seed initial data'

    def handle(self, *args, **kwargs):
        # Users
        admin, created = User.objects.get_or_create(email='admin@stronglogistics.com', defaults={
            'full_name': 'Admin User', 'role': 'admin', 'is_staff': True, 'is_superuser': True
        })
        if created or not admin.has_usable_password():
            admin.set_password('admin123')
            admin.save()

        dispatcher, created = User.objects.get_or_create(email='dispatcher@stronglogistics.com', defaults={
            'full_name': 'Main Dispatcher', 'role': 'dispatcher'
        })
        if created:
            dispatcher.set_password('dispatcher123')
            dispatcher.save()

        driver1, created = User.objects.get_or_create(email='driver1@stronglogistics.com', defaults={
            'full_name': 'João Silva', 'role': 'driver', 'vehicle_plate': '34-AB-56'
        })
        if created:
            driver1.set_password('driver123')
            driver1.save()

        driver2, created = User.objects.get_or_create(email='driver2@stronglogistics.com', defaults={
            'full_name': 'Maria Santos', 'role': 'driver', 'vehicle_plate': '78-CD-90'
        })
        if created:
            driver2.set_password('driver123')
            driver2.save()

        # Resources
        fuel, _ = Resource.objects.get_or_create(name='Fuel', defaults={'unit': 'litres', 'description': 'Diesel fuel'})
        water, _ = Resource.objects.get_or_create(name='Water', defaults={'unit': 'litres', 'description': 'Drinking water'})
        medical, _ = Resource.objects.get_or_create(name='Medical Supplies', defaults={'unit': 'kits', 'description': 'First aid kits'})
        food, _ = Resource.objects.get_or_create(name='Food Rations', defaults={'unit': 'boxes', 'description': 'Emergency food'})
        parts, _ = Resource.objects.get_or_create(name='Spare Parts', defaults={'unit': 'units', 'description': 'Vehicle spare parts'})

        # Delivery Points in Portugal
        points_data = [
            ('Lisbon Depot', 'Av. da Liberdade 1, Lisboa', '38.716314', '-9.142449'),
            ('Porto Hub', 'Rua de Santa Catarina 1, Porto', '41.149640', '-8.610876'),
            ('Coimbra Center', 'Largo da Portagem, Coimbra', '40.209268', '-8.423543'),
            ('Faro South', 'Rua de Santo António, Faro', '37.014380', '-7.935123'),
            ('Braga North', 'Praça da República, Braga', '41.545454', '-8.426507'),
            ('Setubal Coast', 'Av. Luísa Todi, Setúbal', '38.524170', '-8.893130'),
        ]

        points = []
        for name, address, lat, lon in points_data:
            p, _ = DeliveryPoint.objects.get_or_create(name=name, defaults={
                'address': address, 'latitude': lat, 'longitude': lon
            })
            points.append(p)

        # Stock items
        stock_config = [
            (points[0], [(fuel, 500), (water, 200), (medical, 50)]),
            (points[1], [(fuel, 300), (food, 100), (parts, 30)]),
            (points[2], [(water, 150), (medical, 40), (food, 80)]),
            (points[3], [(fuel, 200), (water, 100), (parts, 20)]),
            (points[4], [(medical, 60), (food, 120), (fuel, 180)]),
            (points[5], [(water, 250), (parts, 45), (food, 90)]),
        ]

        for point, items in stock_config:
            for resource, qty in items:
                StockItem.objects.get_or_create(
                    delivery_point=point, resource=resource,
                    defaults={'quantity': qty}
                )

        # Orders
        orders_data = [
            (points[0], fuel, 100, 'critical', 'pending', None),
            (points[1], water, 50, 'elevated', 'dispatched', driver1),
            (points[2], medical, 20, 'normal', 'in_transit', driver2),
            (points[3], food, 30, 'elevated', 'delivered', driver1),
            (points[4], parts, 10, 'normal', 'pending', None),
            (points[5], fuel, 80, 'critical', 'in_transit', driver2),
            (points[0], water, 60, 'normal', 'delivered', driver1),
            (points[1], medical, 15, 'elevated', 'cancelled', None),
        ]

        for dp, resource, qty, priority, st, driver in orders_data:
            if Order.objects.filter(delivery_point=dp, resource=resource, quantity=qty, priority=priority).exists():
                continue
            order = Order.objects.create(
                delivery_point=dp, resource=resource, quantity=qty,
                priority=priority, status=st, driver=driver
            )
            StatusHistoryEntry.objects.create(
                order=order, status='pending', changed_by='seed_data'
            )
            if st != 'pending':
                StatusHistoryEntry.objects.create(
                    order=order, status=st, changed_by='seed_data'
                )

        self.stdout.write(self.style.SUCCESS('Seed data created successfully'))
