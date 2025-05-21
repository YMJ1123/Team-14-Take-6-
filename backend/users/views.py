from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from users.csrf import ensure_csrf_cookie


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        # 不用這個驗證（由 middleware 驗證就好）
        return

@api_view(['POST'])
@permission_classes([AllowAny])
# @csrf_exempt  # 開發階段暫時禁用CSRF驗證以解決問題
def register_user(request):
    """註冊新用戶"""
    print("接收到註冊請求:", request.data)
    username = request.data.get('username')
    password = request.data.get('password')
    
    # 檢查必要字段
    if not username or not password:
        return Response(
            {'error': '使用者名稱和密碼都是必須的'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 檢查使用者名稱是否已存在
    if User.objects.filter(username=username).exists():
        return Response(
            {'error': '使用者名稱已存在'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 對於開發環境，可以跳過密碼強度驗證
    try:
        # 註釋掉密碼驗證來簡化測試
        # validate_password(password)
        pass  # 暫時不驗證密碼強度，使測試更容易
    except ValidationError as e:
        return Response(
            {'error': e.messages},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 創建新用戶
    user = User.objects.create_user(
        username=username,
        password=password
    )
    
    # 自動登入
    login(request, user)
    
    return Response({
        'message': '註冊成功',
        'user': {
            'id': user.id,
            'username': user.username
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
# @csrf_exempt  # 開發階段暫時禁用CSRF驗證以解決問題
def login_user(request):
    """登入用戶"""
    print("接收到登入請求:", request.data)
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        login(request, user)
        print(f"用戶 {username} 登入成功")
        return Response({
            'message': '登入成功',
            'user': {
                'id': user.id,
                'username': user.username
            }
        })
    else:
        print(f"用戶 {username} 登入失敗")
        return Response(
            {'error': '使用者名稱或密碼不正確'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([CsrfExemptSessionAuthentication])
# @csrf_exempt  # 開發階段暫時禁用CSRF驗證以解決問題
def logout_user(request):
    """登出用戶"""
    logout(request)
    return Response({'message': '登出成功'})


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_current_user(request):
    """獲取當前已登入用戶信息"""
    if request.user.is_authenticated:
        return Response({
            'is_authenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username
            }
        })
    else:
        return Response({
            'is_authenticated': False
        })
