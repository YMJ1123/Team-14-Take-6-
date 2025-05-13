
import unittest
from .card import Card, create_deck
from .core import GameState
# class CardTest(unittest.TestCase):
#     def test_bull_heads_calculation(self):
#         """測試牛頭分數計算是否正確"""
#         print("Testing bull heads calculation:")
#         self.assertEqual(Card(55).bull_heads, 7)  # 特例
#         self.assertEqual(Card(11).bull_heads, 5)  # 整除11
#         self.assertEqual(Card(22).bull_heads, 5)  # 整除11
#         self.assertEqual(Card(10).bull_heads, 3)  # 整除10
#         self.assertEqual(Card(5).bull_heads, 2)   # 整除5
#         self.assertEqual(Card(7).bull_heads, 1)   # 其他

#     def test_deck_creation(self):
#         """測試牌組生成是否正確"""
#         deck = create_deck()
#         print(f"Deck created with {len(deck)} cards.")
        
#         # 計算總牛頭數是否為171
#         total_bulls = sum(card.bull_heads for card in deck)
#         print(f"Total bull heads: {total_bulls}")
#         self.assertEqual(total_bulls, 171)

# class GameLogicTest(unittest.TestCase):
#     def test_game_initialization(self):
#         """測試遊戲初始化"""
#         game = GameState(4)  # 4名玩家
#         print("Game initialized:")
        
#         # 檢查牌桌是否有4列
#         print(f"Board rows: {len(game.board_rows)}")
#         self.assertEqual(len(game.board_rows), 4)
        
#         # 檢查每列是否有1張初始牌
#         for i, row in enumerate(game.board_rows):
#             print(f"Row {i+1}: {', '.join(str(card) for card in row)}")
#             self.assertEqual(len(row), 1)
        
#         # 檢查是否每個玩家有10張牌
#         for i, hand in enumerate(game.player_hands):
#             print(f"Player {i+1} hand: {', '.join(str(card) for card in hand)}")
#             self.assertEqual(len(hand), 10)

class GameFullPlayTest(unittest.TestCase):
    def test_full_game_play(self):
        """測試完整的遊戲過程，包括洗牌、發牌、出牌、排列、放置或收集牌"""
        # 初始化遊戲，假設有4名玩家
        game = GameState(4)
        print("\nGame initialized:")
        
        # 顯示初始狀態
        self.print_game_state(game)
        
        # 模擬10輪遊戲
        for round_num in range(10):
            print(f"\nRound {round_num + 1}:")
            round_results = game.play_round()  # 進行一輪遊戲
            self.print_round_result(round_results)  # 打印本回合結果
            self.print_game_state(game)  # 打印本回合後的遊戲狀態

    def print_game_state(self, game):
        """打印當前遊戲的狀態"""
        print(f"Board rows (after round {game.round}):")
        for i, row in enumerate(game.board_rows):
            print(f"Row {i}: {', '.join(str(card.value) for card in row)}")
        
        print("\nPlayer hands:")
        for i, hand in enumerate(game.player_hands):
            print(f"Player {i+1} hand: {', '.join(str(card.value) for card in hand)}")

    def print_round_result(self, round_results):
        """打印每一回合的結果"""
        print(round_results)
        for result in round_results:
            if result['action'] == 'collect':
                print(f"Player {result['player']} collects bull heads: {result['bull_heads']}")
            else:
                print(f"Player {result['player']} places card.")

if __name__ == '__main__':
    unittest.main()
