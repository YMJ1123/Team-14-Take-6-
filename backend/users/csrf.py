from django.middleware.csrf import get_token
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import ensure_csrf_cookie

@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """獲取 CSRF Token，用於前端 JavaScript 請求"""
    token = get_token(request)
    print(f"生成CSRF令牌: {token}")
    return JsonResponse({'csrfToken': token})
