"""
ASGI config for take6 project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

# 一定要放最上面 這樣django的import才能正常運作
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'take6.settings')

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
# import game.routing
from take6.routing import websocket_urlpatterns

# Import middleware after Django is initialized
from game.middleware import QueryAuthMiddleware

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'take6.settings')

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    "websocket": QueryAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
    # 'websocket': AuthMiddlewareStack(
    #     URLRouter(websocket_urlpatterns)
    #     URLRouter(
    #         game.routing.websocket_urlpatterns
    #     )
    # ),
})
