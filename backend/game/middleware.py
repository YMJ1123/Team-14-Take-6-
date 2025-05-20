# from django.contrib.auth.models import AnonymousUser
# from django.contrib.sessions.models import Session
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

@database_sync_to_async
def get_user_from_session_key(session_key):
    """從session key獲取用戶"""
    try:
        # 在函數內部導入，避免循環依賴
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import AnonymousUser
        from django.contrib.sessions.models import Session
        
        # 獲取session
        session = Session.objects.get(session_key=session_key)
        
        # 從session中獲取用戶ID (Django保存方式)
        session_data = session.get_decoded()
        user_id = session_data.get('_auth_user_id')
        
        # 如果找到用戶ID，返回用戶物件
        if user_id:
            User = get_user_model()
            return User.objects.get(id=user_id)
        return AnonymousUser()
    except Exception as e:
        print(f"Session認證錯誤: {str(e)}")
        return AnonymousUser()

class QueryAuthMiddleware(BaseMiddleware):
    """WebSocket認證中間件，處理自訂認證邏輯"""
    
    async def __call__(self, scope, receive, send):
        # 從scope中獲取cookies
        if 'cookies' not in scope:
            scope['cookies'] = {}
            
        # 獲取headers
        headers = dict(scope.get('headers', []))
        
        # 從URL參數獲取session_key (如果有)
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        session_key = query_params.get('session_key', [None])[0]
        
        # 從cookies中獲取session key
        cookie_header = headers.get(b'cookie', b'').decode()
        cookies = {}
        
        if cookie_header:
            # 解析cookies
            for cookie in cookie_header.split(';'):
                if '=' in cookie:
                    name, value = cookie.strip().split('=', 1)
                    cookies[name] = value
            
            # Django的session cookie名稱通常是'sessionid'
            session_key = cookies.get('sessionid') or session_key
        
        # 將cookies添加到scope
        scope['cookies'] = cookies
        
        # 如果找到session key，嘗試從中獲取用戶
        if session_key:
            scope['user'] = await get_user_from_session_key(session_key)
        else:
            from django.contrib.auth.models import AnonymousUser
            scope['user'] = AnonymousUser()
        
        # 輸出診斷信息
        print(f"WebSocket認證 - Session Key: {session_key}")
        print(f"WebSocket認證 - 用戶: {scope['user']}, 已認證: {scope['user'].is_authenticated}")
        
        # 調用下一個中間件或應用
        return await super().__call__(scope, receive, send)

# from urllib.parse import parse_qs
# from django.contrib.auth.models import AnonymousUser
# from channels.middleware import BaseMiddleware
# from channels.db import database_sync_to_async

# @database_sync_to_async
# def get_user_from_session_key(session_key):
#     """從session key獲取用戶"""
#     try:
#         # 在函數內部導入，避免循環依賴
#         from django.contrib.auth import get_user_model
#         from django.contrib.sessions.models import Session
        
#         # 獲取session
#         session = Session.objects.get(session_key=session_key)
        
#         # 從session中獲取用戶ID (Django保存方式)
#         session_data = session.get_decoded()
#         user_id = session_data.get('_auth_user_id')
        
#         # 如果找到用戶ID，返回用戶物件
#         if user_id:
#             User = get_user_model()
#             return User.objects.get(id=user_id)
#         return AnonymousUser()
#     except Exception as e:
#         print(f"Session認證錯誤: {str(e)}")
#         return AnonymousUser()

# class WebSocketAuthMiddleware(BaseMiddleware):
#     """WebSocket認證中間件，處理自訂認證邏輯"""
    
#     async def __call__(self, scope, receive, send):
#         # 從scope中獲取cookies
#         if 'cookies' not in scope:
#             scope['cookies'] = {}
            
#         # 獲取headers
#         headers = dict(scope.get('headers', []))
        
#         # 從URL參數獲取session_key (如果有)
#         query_string = scope.get('query_string', b'').decode()
#         query_params = parse_qs(query_string)
#         session_key = query_params.get('session_key', [None])[0]
        
#         # 從cookies中獲取session key
#         cookie_header = headers.get(b'cookie', b'').decode()
#         cookies = {}
        
#         if cookie_header:
#             # 解析cookies
#             for cookie in cookie_header.split(';'):
#                 if '=' in cookie:
#                     name, value = cookie.strip().split('=', 1)
#                     cookies[name] = value
            
#             # Django的session cookie名稱通常是'sessionid'
#             session_key = cookies.get('sessionid') or session_key
        
#         # 將cookies添加到scope
#         scope['cookies'] = cookies
        
#         # 如果找到session key，嘗試從中獲取用戶
#         if session_key:
#             scope['user'] = await get_user_from_session_key(session_key)
#         else:
#             scope['user'] = AnonymousUser()
        
#         # 輸出診斷信息
#         print(f"WebSocket認證 - Session Key: {session_key}")
#         print(f"WebSocket認證 - 用戶: {scope['user']}, 已認證: {scope['user'].is_authenticated}")
        
#         # 調用下一個中間件或應用
#         return await super().__call__(scope, receive, send) 