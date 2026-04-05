from rest_framework import serializers
from .models import User, Resource, DeliveryPoint, StockItem, Order, StatusHistoryEntry, RouteBlockage, DemandSetting


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active']


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'is_available', 'vehicle_plate']


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ['id', 'name', 'unit', 'description']


class StockItemSerializer(serializers.ModelSerializer):
    resource_id = serializers.IntegerField(source='resource.id')
    resource_name = serializers.CharField(source='resource.name')

    class Meta:
        model = StockItem
        fields = ['resource_id', 'resource_name', 'quantity']


class DeliveryPointSerializer(serializers.ModelSerializer):
    stock = StockItemSerializer(many=True, read_only=True)

    class Meta:
        model = DeliveryPoint
        fields = ['id', 'name', 'address', 'latitude', 'longitude', 'stock']


class StatusHistoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistoryEntry
        fields = ['status', 'timestamp', 'changed_by', 'notes']


class OrderSerializer(serializers.ModelSerializer):
    delivery_point = DeliveryPointSerializer(read_only=True)
    resource = ResourceSerializer(read_only=True)
    driver = DriverSerializer(read_only=True)
    status_history = StatusHistoryEntrySerializer(many=True, read_only=True)
    weight = serializers.SerializerMethodField()

    delivery_point_id = serializers.PrimaryKeyRelatedField(
        queryset=DeliveryPoint.objects.all(), source='delivery_point', write_only=True
    )
    resource_id = serializers.PrimaryKeyRelatedField(
        queryset=Resource.objects.all(),
        source='resource', write_only=True
    )

    class Meta:
        model = Order
        fields = [
            'id', 'order_id', 'delivery_point', 'resource', 'quantity',
            'priority', 'status', 'driver', 'notes', 'created_at', 'updated_at',
            'status_history', 'weight',
            'delivery_point_id', 'resource_id',
        ]
        read_only_fields = ['id', 'order_id', 'created_at', 'updated_at']

    def get_weight(self, obj):
        return obj.quantity * 10.0


class RouteBlockageSerializer(serializers.ModelSerializer):
    point_id = serializers.IntegerField(source='point.id', read_only=True)
    point = serializers.PrimaryKeyRelatedField(queryset=DeliveryPoint.objects.all(), write_only=True)

    class Meta:
        model = RouteBlockage
        fields = ['id', 'point_id', 'point', 'reason', 'created_at']


class DemandSettingSerializer(serializers.ModelSerializer):
    point_id = serializers.IntegerField(source='point.id', read_only=True)
    resource_id = serializers.IntegerField(source='resource.id', read_only=True)
    point = serializers.PrimaryKeyRelatedField(queryset=DeliveryPoint.objects.all(), write_only=True)
    resource = serializers.PrimaryKeyRelatedField(queryset=Resource.objects.all(), write_only=True)

    class Meta:
        model = DemandSetting
        fields = ['id', 'point_id', 'resource_id', 'point', 'resource', 'level', 'updated_at']
