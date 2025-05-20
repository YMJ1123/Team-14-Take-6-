class AuthCorsMiddleware:
    """處理認證相關的CORS請求的中間件"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        # One-time configuration and initialization.
        
    def __call__(self, request):
        # 處理預檢請求
        if request.method == 'OPTIONS' and request.path.startswith('/api/auth/'):
            response = self.handle_preflight(request)
            return response
        
        # 正常處理請求
        response = self.get_response(request)
        
        # 當請求是認證相關路由時，添加CORS頭部
        if request.path.startswith('/api/auth/'):
            origin = request.META.get('HTTP_ORIGIN', 'http://localhost:5173')
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            
        return response
    
    def handle_preflight(self, request):
        """處理OPTIONS預檢請求"""
        from django.http import HttpResponse
        
        response = HttpResponse()
        origin = request.META.get('HTTP_ORIGIN', 'http://localhost:5173')
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "X-Requested-With, Content-Type, Accept, Origin, Authorization, Cache-Control, Pragma, Expires"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Max-Age"] = "86400"  # 24 hours
        
        return response 