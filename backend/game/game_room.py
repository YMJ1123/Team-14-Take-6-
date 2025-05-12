from game_logic.core import GameState

# 全局字典，用於保存所有活躍的遊戲房間
active_rooms = {}

class GameRoom:
    """管理單個遊戲房間的共享狀態"""
    
    def __init__(self, room_name):
        self.name = room_name
        self.game_state = None  # 遊戲狀態，初始為空
        self.connected_players = set()  # 使用集合存儲連接到該房間的用戶ID
    
    def initialize_game_state(self, player_count):
        """初始化房間的遊戲狀態（確保只初始化一次）"""
        if self.game_state is None:
            print(f"房間 {self.name} 初始化 GameState，玩家數: {player_count}")
            self.game_state = GameState(player_count)
        return self.game_state
    
    def has_game_state(self):
        """檢查房間是否已經初始化了遊戲狀態"""
        return self.game_state is not None
    
    def add_player(self, user_id):
        """將玩家添加到房間"""
        self.connected_players.add(user_id)
        print(f"玩家 {user_id} 加入房間 {self.name}，目前玩家數: {len(self.connected_players)}")
    
    def remove_player(self, user_id):
        """從房間中移除玩家"""
        if user_id in self.connected_players:
            self.connected_players.remove(user_id)
            print(f"玩家 {user_id} 離開房間 {self.name}，剩餘玩家數: {len(self.connected_players)}")
    
    def get_player_count(self):
        """獲取當前房間的玩家數量"""
        return len(self.connected_players)
    
    @staticmethod
    def get_room(room_name):
        """獲取或創建指定名稱的房間"""
        if room_name not in active_rooms:
            active_rooms[room_name] = GameRoom(room_name)
        return active_rooms[room_name]
    
    @staticmethod
    def remove_room(room_name):
        """移除房間（當房間為空時）"""
        if room_name in active_rooms:
            room = active_rooms[room_name]
            if len(room.connected_players) == 0:
                del active_rooms[room_name]
                print(f"房間 {room_name} 已被移除（無玩家）") 