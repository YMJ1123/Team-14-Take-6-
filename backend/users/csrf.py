from django.middleware.csrf import get_token
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """獲取 CSRF Token，用於前端 JavaScript 請求"""
    token = get_token(request)
    print(f"生成CSRF令牌: {token}")
    return JsonResponse({'csrfToken': token})
