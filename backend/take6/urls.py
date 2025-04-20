"""
URL configuration for take6 project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from game.views import RoomViewSet, GameSessionViewSet, PlayerViewSet, index
from django.views.generic import TemplateView

router = routers.DefaultRouter()
router.register(r'rooms', RoomViewSet)
router.register(r'games', GameSessionViewSet)
router.register(r'players', PlayerViewSet)

urlpatterns = [
    path('', index, name='index'),  # 提供前端應用的入口點
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    # 新增遊戲房間頁面路由
    path('game/<str:room_name>/', TemplateView.as_view(template_name='game_room.html'), name='game_room'),
]
