from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),

    # Dashboard
    path('dashboard/stats/', views.DashboardView.as_view(), name='dashboard'),

    # Orders - specific paths BEFORE parameterized paths
    path('orders/auto-assign/confirm/', views.AutoAssignConfirmView.as_view(), name='auto-assign-confirm'),
    path('orders/auto-assign/', views.AutoAssignView.as_view(), name='auto-assign'),
    path('orders/scan-interception/', views.ScanInterceptionView.as_view(), name='scan-interception'),
    path('orders/confirm-interception/', views.ConfirmInterceptionView.as_view(), name='confirm-interception'),
    path('orders/', views.OrderListCreateView.as_view(), name='order-list'),
    path('orders/<int:pk>/', views.OrderDetailView.as_view(), name='order-detail'),

    # Points - specific paths BEFORE parameterized paths
    path('points/nearby/', views.NearbyPointsView.as_view(), name='nearby-points'),
    path('points/', views.DeliveryPointListView.as_view(), name='point-list'),
    path('points/<int:pk>/orders/', views.DeliveryPointOrdersView.as_view(), name='point-orders'),

    # Resources
    path('resources/', views.ResourceListView.as_view(), name='resource-list'),

    # Routes
    path('routes/blockages/', views.RouteBlockageListCreateView.as_view(), name='blockage-list'),
    path('routes/blockages/<uuid:pk>/', views.RouteBlockageDeleteView.as_view(), name='blockage-delete'),
    path('routes/is-blocked/', views.IsBlockedView.as_view(), name='is-blocked'),

    # Admin
    path('admin/users/', views.AdminUserListCreateView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/resources/', views.AdminResourceListCreateView.as_view(), name='admin-resources'),
    path('admin/resources/<int:pk>/', views.AdminResourceDeleteView.as_view(), name='admin-resource-delete'),
    path('admin/points/', views.AdminPointListCreateView.as_view(), name='admin-points'),
    path('admin/points/<int:pk>/', views.AdminPointDetailView.as_view(), name='admin-point-detail'),
    path('admin/demand/', views.AdminDemandListCreateView.as_view(), name='admin-demand'),
]
