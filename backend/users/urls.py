from django.urls import path
from . import views
from .csrf import get_csrf_token

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('logout/', views.logout_user, name='logout'),
    path('current_user/', views.get_current_user, name='current_user'),
    path('csrf_token/', get_csrf_token, name='csrf_token'),
]
