from django.shortcuts import render, redirect
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Room, GameSession, Player
from .serializers import RoomSerializer, GameSessionSerializer, PlayerSerializer
from .game_room import GameRoom, active_rooms
from django.utils import timezone
from datetime import timedelta
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from django.db.models import Count, OuterRef, Subquery, IntegerField

def home(request):
    return HttpResponse("Welcome to Take 6! Online Game API")

@api_view(['GET', 'POST'])
def room_list(request):
    if request.method == 'GET':
        # Subquery to get the count of active players in the active game session for each room
        active_game_session_players = Player.objects.filter(
            game__room=OuterRef('pk'),
            game__active=True
        ).values('game__room').annotate(c=Count('id')).values('c')

        rooms = Room.objects.filter(active=True).annotate(
            player_count_db=Subquery(active_game_session_players, output_field=IntegerField())
        ).order_by('-created_at')
        
        serializer = RoomSerializer(rooms, many=True, context={'request': request, 'active_rooms': active_rooms})
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

# 只給這個 ViewSet 用的 CSRF 豁免版本
class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return              # ← 直接跳過 CsrfViewMiddleware 的驗證

class RoomViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication]

    def get_queryset(self):
        # Subquery to get the count of active players in the active game session for each room
        active_game_session_players = Player.objects.filter(
            game__room=OuterRef('pk'),
            game__active=True
        ).values('game__room').annotate(c=Count('id')).values('c')

        queryset = Room.objects.filter(active=True).annotate(
            player_count_db=Subquery(active_game_session_players, output_field=IntegerField())
        ).order_by('-created_at')
        
        return queryset

    def get_serializer_context(self):
        # Pass active_rooms to the serializer context
        context = super().get_serializer_context()
        context['active_rooms'] = active_rooms
        return context

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

    @action(detail=True, methods=['get'], url_path='player_count')
    def get_player_count(self, request, pk=None):
        """獲取指定房間的當前玩家數量"""
        room = self.get_object() # This will use the optimized get_queryset if called for detail view, but get_object() itself doesn't apply list annotations.
        room_name = room.name
        
        # Try active_rooms cache first
        if room_name in active_rooms:
            return Response({'player_count': active_rooms[room_name].get_player_count()})
        
        # Fallback to DB query for a single room (already efficient for one room)
        game = GameSession.objects.filter(room=room, active=True).first()
        if game:
            player_count = Player.objects.filter(game=game).count()
        else:
            player_count = 0
        
        return Response({'player_count': player_count})

class GameSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GameSession.objects.all()
    serializer_class = GameSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]
