from rest_framework import serializers
from .models import Room, GameSession, Player

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'created_at', 'active']
        read_only_fields = ['created_at']

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