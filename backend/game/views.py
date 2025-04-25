from django.shortcuts import render, redirect
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Room, GameSession, Player
from .serializers import RoomSerializer, GameSessionSerializer, PlayerSerializer

def home(request):
    return HttpResponse("Welcome to Take 6! Online Game API")

@api_view(['GET', 'POST'])
def room_list(request):
    if request.method == 'GET':
        rooms = Room.objects.all().order_by('-created_at')
        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# def index(request):
#     # 如果是表單提交，創建新房間並重定向
#     if request.method == 'POST':
#         room_name = request.POST.get('room_name')
#         if room_name:
#             room, created = Room.objects.get_or_create(name=room_name)
#             return redirect('game_room', room_name=room_name)
    
#     # 獲取活躍的房間列表
#     active_rooms = Room.objects.filter(active=True)
    
#     # 傳遞房間列表到模板
#     return render(request, 'index.html', {'rooms': active_rooms})

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.filter(active=True)
    serializer_class = RoomSerializer
    # 測試階段可以暫時移除權限控制
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]  # 允許所有人訪問
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        room = self.get_object()
        user = request.user
        
        # 檢查用戶是否已在房間中
        game = GameSession.objects.filter(room=room, active=True).first()
        if not game:
            # 創建新遊戲會話
            game = GameSession.objects.create(room=room)
        
        # 檢查玩家是否已加入
        player, created = Player.objects.get_or_create(
            user=user,
            game=game
        )
        
        return Response({'status': 'joined room'}, status=status.HTTP_200_OK)

class GameSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GameSession.objects.all()
    serializer_class = GameSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]
