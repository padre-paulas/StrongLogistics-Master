import math
import uuid

from asgiref.sync import async_to_sync
from django.contrib.auth import authenticate
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User, Resource, DeliveryPoint, StockItem, Order,
    StatusHistoryEntry, AutoAssignPlan, RouteBlockage, DemandSetting
)
from .serializers import (
    UserSerializer, DriverSerializer, ResourceSerializer,
    DeliveryPointSerializer, OrderSerializer,
    RouteBlockageSerializer, DemandSettingSerializer, StockItemSerializer
)
from .permissions import IsAdmin, IsAdminOrDispatcher

# Logistics constants
DEPOT_LAT = 38.7
DEPOT_LON = -9.14
AVERAGE_SPEED_KMH = 60.0
DISTANCE_SAVINGS_FACTOR = 0.3  # Estimated fraction of distance saved by interception rerouting


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlambda = math.radians(float(lon2) - float(lon1))
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(get_tokens(user))


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        full_name = request.data.get('full_name')
        role = request.data.get('role', 'driver')
        password = request.data.get('password')
        if not all([email, full_name, password]):
            return Response({'detail': 'email, full_name, password required'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'detail': 'Email already registered'}, status=400)
        user = User.objects.create_user(email=email, full_name=full_name, role=role, password=password)
        return Response(get_tokens(user), status=201)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        active_statuses = ['pending', 'dispatched', 'in_transit']
        total_active = Order.objects.filter(status__in=active_statuses).count()
        critical = Order.objects.filter(priority='critical', status__in=active_statuses).count()
        pending_dispatch = Order.objects.filter(status='pending').count()
        available_drivers = User.objects.filter(role='driver', is_available=True, is_active=True).count()
        recent_orders = Order.objects.order_by('-created_at')[:5]
        return Response({
            'total_active_orders': total_active,
            'critical_priority': critical,
            'pending_dispatch': pending_dispatch,
            'available_drivers': available_drivers,
            'recent_orders': OrderSerializer(recent_orders, many=True).data,
        })


class OrderPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Order.objects.select_related('delivery_point', 'resource', 'driver').prefetch_related(
            'status_history', 'delivery_point__stock__resource'
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        priority_filter = request.query_params.get('priority')
        search = request.query_params.get('search')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if priority_filter:
            qs = qs.filter(priority=priority_filter)
        if search:
            qs = qs.filter(Q(order_id__icontains=search) | Q(notes__icontains=search))

        paginator = OrderPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = OrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        data = request.data.copy()
        serializer = OrderSerializer(data=data)
        if serializer.is_valid():
            order = serializer.save()
            StatusHistoryEntry.objects.create(
                order=order,
                status='pending',
                changed_by=request.user.full_name,
            )
            return Response(OrderSerializer(order).data, status=201)
        return Response(serializer.errors, status=400)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_order(self, pk):
        try:
            return Order.objects.select_related('delivery_point', 'resource', 'driver').prefetch_related(
                'status_history', 'delivery_point__stock__resource'
            ).get(pk=pk)
        except Order.DoesNotExist:
            return None

    def get(self, request, pk):
        order = self._get_order(pk)
        if order is None:
            return Response({'detail': 'Not found'}, status=404)
        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        from .consumers import broadcast_notification

        order = self._get_order(pk)
        if order is None:
            return Response({'detail': 'Not found'}, status=404)

        new_status = request.data.get('status')
        if new_status:
            order.status = new_status
            order.save()
            StatusHistoryEntry.objects.create(
                order=order,
                status=new_status,
                changed_by=request.user.full_name,
                notes=request.data.get('notes'),
            )
            try:
                async_to_sync(broadcast_notification)(
                    'order_status_update',
                    f"Order {order.order_id} status changed to {new_status}"
                )
            except Exception:
                pass

        return Response(OrderSerializer(self._get_order(pk)).data)


class AutoAssignView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrDispatcher]

    def post(self, request):
        pending_orders = list(
            Order.objects.filter(status='pending')
            .select_related('delivery_point', 'resource')
            .order_by('-priority', 'created_at')
        )
        available_drivers = list(
            User.objects.filter(role='driver', is_available=True, is_active=True)
        )

        if not available_drivers:
            return Response({'detail': 'No available drivers'}, status=400)
        if not pending_orders:
            return Response({'detail': 'No pending orders'}, status=400)

        priority_order = {'critical': 0, 'elevated': 1, 'normal': 2}
        pending_orders.sort(key=lambda o: priority_order.get(o.priority, 2))

        driver_assignments = {d.id: {'driver': d, 'orders': []} for d in available_drivers}
        driver_list = list(available_drivers)

        for i, order in enumerate(pending_orders):
            driver = driver_list[i % len(driver_list)]
            driver_assignments[driver.id]['orders'].append(order)

        assignments_result = []
        total_dist = 0.0
        total_time = 0.0

        for driver_id, data in driver_assignments.items():
            if not data['orders']:
                continue
            dist = 0.0
            for order in data['orders']:
                dp = order.delivery_point
                dist += haversine(DEPOT_LAT, DEPOT_LON, float(dp.latitude), float(dp.longitude))
            time_est = (dist / AVERAGE_SPEED_KMH) * 60
            total_dist += dist
            total_time = max(total_time, time_est)

            assignments_result.append({
                'driver': DriverSerializer(data['driver']).data,
                'orders': OrderSerializer(data['orders'], many=True).data,
                'total_distance_km': round(dist, 2),
                'estimated_time_minutes': round(time_est, 0),
            })

        plan = AutoAssignPlan.objects.create(
            assignments_json=assignments_result,
            total_distance_km=round(total_dist, 2),
            estimated_time_minutes=round(total_time, 0),
        )

        return Response({
            'plan_id': str(plan.plan_id),
            'assignments': assignments_result,
            'total_distance_km': round(total_dist, 2),
            'estimated_time_minutes': round(total_time, 0),
        })


class AutoAssignConfirmView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrDispatcher]

    def post(self, request):
        from .consumers import broadcast_notification

        plan_id = request.data.get('plan_id')
        try:
            plan = AutoAssignPlan.objects.get(plan_id=plan_id)
        except AutoAssignPlan.DoesNotExist:
            return Response({'detail': 'Plan not found'}, status=404)

        if plan.is_confirmed:
            return Response({'detail': 'Plan already confirmed'}, status=400)

        for assignment in plan.assignments_json:
            driver_data = assignment['driver']
            try:
                driver = User.objects.get(pk=driver_data['id'])
            except User.DoesNotExist:
                continue
            for order_data in assignment['orders']:
                try:
                    order = Order.objects.get(pk=order_data['id'])
                    order.driver = driver
                    order.status = 'dispatched'
                    order.save()
                    StatusHistoryEntry.objects.create(
                        order=order,
                        status='dispatched',
                        changed_by=request.user.full_name,
                        notes='Auto-assigned',
                    )
                except Order.DoesNotExist:
                    continue

        plan.is_confirmed = True
        plan.save()

        try:
            async_to_sync(broadcast_notification)(
                'auto_assign_confirmed',
                f"Auto-assign plan {plan_id} confirmed"
            )
        except Exception:
            pass

        return Response({'detail': 'Plan confirmed'})


class ScanInterceptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        urgent_order_id = request.data.get('urgent_order_id')
        try:
            urgent_order = Order.objects.select_related('delivery_point', 'resource').get(pk=urgent_order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found'}, status=404)

        in_transit_orders = Order.objects.filter(
            status='in_transit',
            resource=urgent_order.resource
        ).select_related('delivery_point', 'resource', 'driver').prefetch_related('status_history')

        candidates = []
        for order in in_transit_orders:
            if order.quantity <= 0:
                continue
            redirected_qty = min(order.quantity, urgent_order.quantity)
            dist_to_critical = haversine(
                order.delivery_point.latitude, order.delivery_point.longitude,
                urgent_order.delivery_point.latitude, urgent_order.delivery_point.longitude
            )
            candidates.append({
                'transit_order': OrderSerializer(order).data,
                'redirected_quantity': redirected_qty,
                'distance_to_critical_km': round(dist_to_critical, 2),
                'distance_saved_km': round(dist_to_critical * DISTANCE_SAVINGS_FACTOR, 2),
            })

        plan_id = str(uuid.uuid4())
        return Response({
            'plan_id': plan_id,
            'urgent_order': OrderSerializer(urgent_order).data,
            'candidates': candidates,
            'algorithm': 'ALNS',
        })


class ConfirmInterceptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get('plan_id')
        urgent_order_id = request.data.get('urgent_order_id')
        transit_order_id = request.data.get('transit_order_id')

        try:
            urgent_order = Order.objects.get(pk=urgent_order_id)
            transit_order = Order.objects.get(pk=transit_order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found'}, status=404)

        urgent_order.status = 'dispatched'
        urgent_order.driver = transit_order.driver
        urgent_order.save()
        StatusHistoryEntry.objects.create(
            order=urgent_order,
            status='dispatched',
            changed_by=request.user.full_name,
            notes=f'Intercepted from order {transit_order.order_id}',
        )

        return Response({'detail': 'Interception confirmed', 'plan_id': plan_id})


class DeliveryPointListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        points = DeliveryPoint.objects.prefetch_related('stock__resource').all()
        return Response(DeliveryPointSerializer(points, many=True).data)


class DeliveryPointOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            point = DeliveryPoint.objects.get(pk=pk)
        except DeliveryPoint.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        orders = Order.objects.filter(delivery_point=point).select_related(
            'delivery_point', 'resource', 'driver'
        ).prefetch_related('status_history', 'delivery_point__stock__resource')
        return Response(OrderSerializer(orders, many=True).data)


class NearbyPointsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        point_id = request.query_params.get('point_id')
        resource_id = request.query_params.get('resource_id')
        radius_km = float(request.query_params.get('radius_km', 50))

        try:
            center = DeliveryPoint.objects.get(pk=point_id)
        except DeliveryPoint.DoesNotExist:
            return Response({'detail': 'Point not found'}, status=404)

        all_points = DeliveryPoint.objects.exclude(pk=point_id).prefetch_related('stock__resource')
        result = []
        for p in all_points:
            dist = haversine(center.latitude, center.longitude, p.latitude, p.longitude)
            if dist <= radius_km:
                available_qty = 0
                if resource_id:
                    try:
                        stock = p.stock.get(resource_id=resource_id)
                        available_qty = stock.quantity
                    except StockItem.DoesNotExist:
                        pass
                result.append({
                    **DeliveryPointSerializer(p).data,
                    'distance_km': round(dist, 2),
                    'available_quantity': available_qty,
                })
        result.sort(key=lambda x: x['distance_km'])
        return Response(result)


class ResourceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        resources = Resource.objects.all()
        return Response(ResourceSerializer(resources, many=True).data)


class RouteBlockageListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blockages = RouteBlockage.objects.select_related('point').all()
        return Response(RouteBlockageSerializer(blockages, many=True).data)

    def post(self, request):
        serializer = RouteBlockageSerializer(data=request.data)
        if serializer.is_valid():
            blockage = serializer.save()
            return Response(RouteBlockageSerializer(blockage).data, status=201)
        return Response(serializer.errors, status=400)


class RouteBlockageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            blockage = RouteBlockage.objects.get(pk=pk)
        except RouteBlockage.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        blockage.delete()
        return Response(status=204)


class IsBlockedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        point_id = request.query_params.get('point_id')
        blocked = RouteBlockage.objects.filter(point_id=point_id).exists()
        return Response({'blocked': blocked})


class AdminUserListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        email = request.data.get('email')
        full_name = request.data.get('full_name')
        role = request.data.get('role', 'driver')
        password = request.data.get('password')
        if not all([email, full_name, password]):
            return Response({'detail': 'email, full_name, password required'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'detail': 'Email already registered'}, status=400)
        user = User.objects.create_user(email=email, full_name=full_name, role=role, password=password)
        return Response(UserSerializer(user).data, status=201)


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        role = request.data.get('role')
        is_active = request.data.get('is_active')
        if role is not None:
            user.role = role
        if is_active is not None:
            user.is_active = is_active
        user.save()
        return Response(UserSerializer(user).data)


class AdminResourceListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return Response(ResourceSerializer(Resource.objects.all(), many=True).data)

    def post(self, request):
        serializer = ResourceSerializer(data=request.data)
        if serializer.is_valid():
            resource = serializer.save()
            return Response(ResourceSerializer(resource).data, status=201)
        return Response(serializer.errors, status=400)


class AdminResourceDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk):
        try:
            resource = Resource.objects.get(pk=pk)
        except Resource.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        resource.delete()
        return Response(status=204)


class AdminPointListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        points = DeliveryPoint.objects.prefetch_related('stock__resource').all()
        return Response(DeliveryPointSerializer(points, many=True).data)

    def post(self, request):
        serializer = DeliveryPointSerializer(data=request.data)
        if serializer.is_valid():
            point = serializer.save()
            return Response(DeliveryPointSerializer(point).data, status=201)
        return Response(serializer.errors, status=400)


class AdminPointDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            point = DeliveryPoint.objects.get(pk=pk)
        except DeliveryPoint.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        serializer = DeliveryPointSerializer(point, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        try:
            point = DeliveryPoint.objects.get(pk=pk)
        except DeliveryPoint.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        point.delete()
        return Response(status=204)


class AdminDemandListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        settings = DemandSetting.objects.select_related('point', 'resource').all()
        return Response(DemandSettingSerializer(settings, many=True).data)

    def post(self, request):
        serializer = DemandSettingSerializer(data=request.data)
        if serializer.is_valid():
            setting = serializer.save()
            return Response(DemandSettingSerializer(setting).data, status=201)
        return Response(serializer.errors, status=400)
