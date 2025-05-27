from rest_framework import serializers
from .models import Room, GameSession, Player

class RoomSerializer(serializers.ModelSerializer):
    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'name', 'created_at', 'active', 'player_count']
        read_only_fields = ['created_at']

    def get_player_count(self, obj):
        # obj is a Room instance
        active_rooms_cache = self.context.get('active_rooms', {})
        if obj.name in active_rooms_cache:
            return active_rooms_cache[obj.name].get_player_count()
        
        if hasattr(obj, 'player_count_db') and obj.player_count_db is not None:
            return obj.player_count_db
            
        # Fallback for safety, though ideally annotation covers this for lists.
        # For individual retrievals (not part of a list), annotation might not be present.
        game_session = GameSession.objects.filter(room=obj, active=True).first()
        if game_session:
            return Player.objects.filter(game=game_session).count()
        return 0

class PlayerSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = Player
        fields = ['id', 'username', 'score', 'joined_at']

class GameSessionSerializer(serializers.ModelSerializer):
    players = PlayerSerializer(many=True, read_only=True, source='player_set')
    room_name = serializers.ReadOnlyField(source='room.name')
    
    class Meta:
        model = GameSession
        fields = ['id', 'room_name', 'started_at', 'ended_at', 'active', 'players']