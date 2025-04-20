"""
線上牛頭王(Take 6!/6 Nimmt!)遊戲邏輯模組

此包含遊戲核心邏輯，與Django模型完全分離，
便於單元測試和邏輯驗證。
"""

# 定義從此包導入時可用的名稱
__all__ = [
    'Card', 'create_deck',              # 從card模組
    'GameState', 'find_closest_row',     # 從core模組
]

# 版本信息
__version__ = '0.1.0'

# 從子模塊導入核心類和函數
from .card import Card, create_deck
from .core import GameState

# 公開核心功能函數
def initialize_game(player_count):
    """
    初始化一個新的遊戲狀態
    
    參數:
        player_count (int): 玩家數量 (2-10)
        
    返回:
        GameState: 初始化後的遊戲狀態物件
    """
    if not 2 <= player_count <= 10:
        raise ValueError("玩家數量必須在2-10之間")
    
    return GameState(player_count)

def find_closest_row(card_value, board_rows):
    """
    找出一張牌應該放置的牌列(便捷函數)
    
    參數:
        card_value (int): 卡牌數值
        board_rows (list): 牌桌上的列表
        
    返回:
        int: 最接近的列索引，如果沒有合適的列則返回None
    """
    # 實現邏輯或呼叫core.py中的函數
    # 這是公開的便捷函數，方便在不創建GameState的情況下使用
    from .core import find_closest_row as _find_row
    return _find_row(card_value, board_rows)
