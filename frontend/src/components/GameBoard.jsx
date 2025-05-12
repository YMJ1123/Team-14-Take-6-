import React, { useState, useEffect, useRef } from "react";
import Card from "./Card";
import "../styles/game_board.css";

const GameBoard = ({ socket, isPrepared, isGameStarted }) => {
  const [board, setBoard] = useState([[], [], [], []]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [remainingCards, setRemainingCards] = useState([]);
  // 追蹤遊戲已經開始發牌
  const [hasDealtCards, setHasDealtCards] = useState(false);
  // 玩家人數
  const [playerCount, setPlayerCount] = useState(0);
  // 同步中狀態
  const [isSyncing, setIsSyncing] = useState(false);
  // 上次同步時間
  const [lastSyncTime, setLastSyncTime] = useState(null);
  // 同步成功狀態
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  // 生成完整牌組 - 固定順序的牌組，所有玩家都用這個順序
  const generateDeck = () => {
    const deck = [];
    for (let i = 1; i <= 104; i++) {
      // 計算牛頭數量
      let bullHeads = 1;
      if (i === 55) {
        bullHeads = 7;
      } else if (i % 11 === 0) {
        bullHeads = 5;
      } else if (i % 10 === 0) {
        bullHeads = 3;
      } else if (i % 5 === 0) {
        bullHeads = 2;
      }
      
      deck.push({ value: i, bull_heads: bullHeads });
    }
    
    // 牌組按值排序
    return deck.sort((a, b) => a.value - b.value);
  };
  
  // 使用固定種子的偽隨機洗牌算法
  // 確保所有玩家得到相同洗牌結果
  const seededShuffle = (array, seed = 12345) => {
    // 複製原數組
    const result = [...array];
    
    // 簡單的線性同餘法隨機數生成器
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    // Fisher-Yates 洗牌算法
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  };
  
  // 根據玩家索引和玩家總數，計算該玩家應該得到的牌
  const getPlayerCards = (playerIndex, totalPlayers) => {
    if (playerIndex < 0 || playerIndex >= totalPlayers) return [];
    
    // 生成固定順序的完整牌組
    const deck = generateDeck();
    
    // 使用固定種子洗牌
    const shuffledDeck = seededShuffle(deck);
    
    // 每位玩家10張牌
    const cardsPerPlayer = 10;
    
    // 計算該玩家應該拿到的牌的索引範圍
    const startIndex = playerIndex * cardsPerPlayer;
    const endIndex = startIndex + cardsPerPlayer;
    
    // 返回該玩家的牌
    return shuffledDeck.slice(startIndex, endIndex);
  };
  
  // 生成所有玩家的手牌，返回所有被抽走的牌
  const getAllPlayerCards = (totalPlayers) => {
    if (totalPlayers <= 0) return [];
    
    const allCards = [];
    
    for (let i = 0; i < totalPlayers; i++) {
      const playerCards = getPlayerCards(i, totalPlayers);
      allCards.push(...playerCards);
    }
    
    return allCards;
  };
  
  // 生成剩餘牌組 - 從完整牌組中移除所有玩家手牌後的牌
  const getRemainingCards = (totalPlayers) => {
    if (totalPlayers <= 0) return generateDeck();
    
    // 生成完整牌組
    const fullDeck = generateDeck();
    
    // 獲取所有玩家的手牌
    const allTakenCards = getAllPlayerCards(totalPlayers);
    
    // 從完整牌組中移除所有已被抽走的牌
    const remainingCards = fullDeck.filter(card => 
      !allTakenCards.some(takenCard => takenCard.value === card.value)
    );
    
    return remainingCards;
  };
  
  // 找出當前玩家在房間中的索引 (暫時假設為0)
  const findMyPlayerIndex = () => {
    // 如果有玩家ID或其他識別信息，可在此根據socket中的信息查找
    // 暫時假設為玩家0
    return 0;
  };
  
  // 初始化所有牌
  useEffect(() => {
    // 生成並設置初始牌組
    setRemainingCards(generateDeck());
  }, []);
  
  // 處理發牌
  const dealCards = () => {
    if (socket && isGameStarted && !hasDealtCards && playerCount > 0) {
      // 確定當前玩家在房間中的索引
      const playerIndex = findMyPlayerIndex();
      
      // 獲取當前玩家的手牌
      const playerHand = getPlayerCards(playerIndex, playerCount);
      
      // 設置玩家手牌
      setHand(playerHand);
      
      // 獲取並設置剩餘牌組
      const remaining = getRemainingCards(playerCount);
      setRemainingCards(remaining);
      
      // 標記已經發過牌
      setHasDealtCards(true);
      
      // 通知後端我們已經發牌
      const handValues = playerHand.map(card => card.value);
      socket.send(JSON.stringify({
        type: "cards_drawn",
        card_values: handValues
      }));
    }
  };
  
  // 遊戲開始時自動發牌
  useEffect(() => {
    if (isGameStarted && hand.length === 0 && !hasDealtCards && playerCount > 0) {
      dealCards();
    }
  }, [isGameStarted, hand.length, hasDealtCards, playerCount]);
  
  // 當玩家數量變更時，重新計算剩餘牌組
  useEffect(() => {
    if (isGameStarted && playerCount > 0) {
      const remaining = getRemainingCards(playerCount);
      setRemainingCards(remaining);
      
      // 如果尚未發牌，可以在這裡發牌
      if (!hasDealtCards && hand.length === 0) {
        dealCards();
      }
    }
  }, [playerCount, isGameStarted]);

  // Socket消息處理
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === "update_board") {
        setBoard(data.board);
      }
      
      if (data.type === "flipped_cards") {
        setFlippedCards(data.cards);
        setIsFlipping(false);
      }
      
      if (data.type === "player_flipping") {
        setIsFlipping(true);
      }
      
      // 更新玩家數量
      if (data.type === "player_count" || data.type === "room_info") {
        // 從不同消息類型中獲取玩家數量
        const count = data.count || (data.players ? data.players.length : 0);
        if (count > 0) {
          console.log(`Updated player count: ${count}`);
          setPlayerCount(count);
        }
      }
      
      // 處理玩家手牌
      if (data.type === "deal_cards") {
        const newHand = data.hand;
        setHand(newHand);
        setSelectedCard(null);
      }
    };

    socket.addEventListener("message", handleMessage);
    
    // 遊戲開始時請求房間信息
    if (isGameStarted) {
      // 請求房間信息
      socket.send(JSON.stringify({
        type: "get_room_info"
      }));
    }
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, isGameStarted]);

  // 創建空的牌位
  const createEmptyCardSlots = (rowIndex) => {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const card = board[rowIndex][i] || null;
      slots.push(
        <div key={`slot-${rowIndex}-${i}`} className="card-slot">
          {card ? (
            <Card
              value={card.value}
              bullHeads={card.bull_heads}
              isPlayed={true}
            />
          ) : null}
        </div>
      );
    }
    return slots;
  };
  
  // 建立翻牌區內容
  const renderFlipArea = () => {
    if (flippedCards.length > 0) {
      return flippedCards.map((card, index) => (
        <div key={`flip-${index}`} className="flipped-card">
          <Card
            value={card.value}
            bullHeads={card.bull_heads}
            isPlayed={true}
          />
          <div className="player-name">{card.player_name}</div>
        </div>
      ));
    } else {
      return (
        <div className="waiting-message">
          {isFlipping ? "翻牌中..." : "等待所有玩家出牌"}
        </div>
      );
    }
  };
  
  // 處理玩家出牌
  const playCard = (cardIndex) => {
    if (selectedCard === cardIndex) {
      // 確認出牌
      socket.send(JSON.stringify({
        type: "play_card",
        card_idx: cardIndex,
      }));
      setSelectedCard(null);
    } else {
      // 選擇牌
      setSelectedCard(cardIndex);
    }
  };
  
  // 渲染剩餘牌組 - 按數值排序顯示
  const renderRemainingCards = () => {
    // 沒有牌時不顯示
    if (remainingCards.length === 0) {
      return null;
    }

    // 剩餘牌數
    const displayedCount = remainingCards.length;
    
    // 理論上應有的剩餘牌數
    const expectedCount = playerCount > 0 ? 104 - (playerCount * 10) : displayedCount;
    
    // 是否需要顯示警告
    const showWarning = playerCount > 0 && displayedCount !== expectedCount;

    // 剩餘牌組已按值排序，直接顯示
    return (
      <div className="remaining-cards-container">
        <div className="remaining-title">剩餘牌數</div>
        <div className="all-cards-display">
          {remainingCards.map((card, index) => (
            <div 
              key={`remaining-${card.value}`} 
              className="card-in-display"
              style={{ 
                marginLeft: index > 0 ? '-25px' : '0'
              }}
            >
              <Card 
                value={card.value} 
                bullHeads={card.bull_heads} 
                smallSize={true} 
                isPlayed={true}
              />
            </div>
          ))}
        </div>
        <div className="card-distribution-info">
          剩餘: {displayedCount} 張
          {playerCount > 0 && (
            <div className="players-info">
              遊戲人數: {playerCount} 人 
              {showWarning && (
                <div className="warning">
                  (預期剩餘: {expectedCount} 張)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 手動同步剩餘牌
  const syncRemainingCards = () => {
    setIsSyncing(true);
    
    // 重新計算剩餘牌組
    if (playerCount > 0) {
      const remaining = getRemainingCards(playerCount);
      setRemainingCards(remaining);
      
      // 設置同步成功狀態
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSuccess(true);
        setLastSyncTime(new Date().toLocaleTimeString());
        
        // 3秒後清除成功狀態
        setTimeout(() => {
          setSyncSuccess(false);
        }, 3000);
      }, 500);
    } else {
      // 如果沒有玩家數量信息，嘗試獲取房間信息
      if (socket) {
        socket.send(JSON.stringify({
          type: "get_room_info"
        }));
        
        // 2秒後如果還沒有收到數據，取消同步狀態
        setTimeout(() => {
          if (isSyncing) {
            setIsSyncing(false);
          }
        }, 2000);
      }
    }
  };

  if (!isPrepared) {
    return null;
  }

  return (
    <div className="game-board-container">
      <div 
        className="game-board" 
        style={{ backgroundImage: "url('/images/2x2_background_table.jpeg')" }}
      >
        {/* 正常的4列遊戲牌桌 */}
        {board.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="board-row">
            <div className="row-header">第 {rowIndex + 1} 列</div>
            <div className="row-cards">
              {createEmptyCardSlots(rowIndex)}
            </div>
          </div>
        ))}
        
        {/* 作為第5列的同時翻牌 */}
        {!isGameStarted && (
          <div className="board-row flip-area-row">
            <div className="row-header">同時翻牌</div>
            <div className="flip-cards-container">
              {renderFlipArea()}
            </div>
          </div>
        )}
        
        {/* 整合進牌桌的我的手牌 - 移除框框 */}
        <div className="my-hand-row">
          <div className="row-header">我的手牌</div>
          <div className="my-hand-container">
            {isGameStarted ? (
              hand.length > 0 ? (
                <div className="player-hand">
                  {hand.map((card, index) => (
                    <div 
                      key={`hand-${index}`} 
                      className={`hand-card ${selectedCard === index ? 'selected' : ''}`}
                      style={{ 
                        transform: `rotate(${Math.random() * 2 - 1}deg)`,
                        marginLeft: index > 0 ? '-15px' : '0'
                      }}
                    >
                      <Card
                        value={card.value}
                        bullHeads={card.bull_heads}
                        isPlayed={false}
                        onClick={() => playCard(index)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="empty-hand-message">
                  發牌中...
                </span>
              )
            ) : (
              <span className="empty-hand-message">
                遊戲開始後將顯示您的牌
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* 剩餘牌組顯示 - 移到獨立區塊 */}
      {isGameStarted && renderRemainingCards()}
      
      {/* 同步按鈕 */}
      {isGameStarted && (
        <div className="sync-button-container" style={{ textAlign: 'center', margin: '10px 0' }}>
          <button 
            onClick={syncRemainingCards}
            disabled={isSyncing}
            className="sync-button"
            style={{
              padding: '8px 15px',
              background: isSyncing ? '#ccc' : syncSuccess ? '#27ae60' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s',
              fontSize: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isSyncing ? (
              <span>同步中...</span>
            ) : syncSuccess ? (
              <span>同步成功 ✓</span>
            ) : (
              <span>同步剩餘牌數</span>
            )}
          </button>
          {lastSyncTime && (
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '5px' 
            }}>
              上次同步: {lastSyncTime}
            </div>
          )}
        </div>
      )}
      
      {selectedCard !== null && (
        <div className="card-action">
          <button onClick={() => playCard(selectedCard)} className="confirm-play-btn">
            確認出牌
          </button>
          <button onClick={() => setSelectedCard(null)} className="cancel-btn">
            取消
          </button>
        </div>
      )}
      
      {/* 遊戲開始按鈕 */}
      {isPrepared && !isGameStarted && (
        <div className="game-controls">
          <button 
            className="start-game-btn"
            onClick={() => {
              socket.send(JSON.stringify({ type: "start_game" }));
            }}
          >
            遊戲開始
          </button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
