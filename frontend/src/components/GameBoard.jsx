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
  // 玩家ID
  const [playerId, setPlayerId] = useState(null);
  // 所有玩家資訊
  const [players, setPlayers] = useState([]);
  // 發牌動畫
  const [isDealing, setIsDealing] = useState(false);
  // 發牌進度 (0-100%)
  const [dealProgress, setDealProgress] = useState(0);
  
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
  
  // 找出當前玩家在房間中的索引
  const findMyPlayerIndex = () => {
    if (!playerId || players.length === 0) return 0;
    
    // 在players數組中查找當前玩家的索引
    const myIndex = players.findIndex(player => player.id === playerId);
    return myIndex >= 0 ? myIndex : 0;
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
  
  // 調試用 - 檢查所有玩家的手牌分配
  const debugPlayerCards = (totalPlayers) => {
    console.log(`=== 玩家手牌分配 (共${totalPlayers}名玩家) ===`);
    for (let i = 0; i < totalPlayers; i++) {
      const cards = getPlayerCards(i, totalPlayers);
      const cardValues = cards.map(c => c.value).join(', ');
      console.log(`玩家 ${i}: ${cardValues}`);
    }
  };
  
  // 初始化所有牌
  useEffect(() => {
    // 生成並設置初始牌組
    setRemainingCards(generateDeck());
  }, []);
  
  // 處理發牌
  const dealCards = () => {
    if (socket && isGameStarted && !hasDealtCards && playerCount > 0) {
      // 設置發牌動畫狀態
      setIsDealing(true);
      setDealProgress(0);
      
      // 確定當前玩家在房間中的索引
      const playerIndex = findMyPlayerIndex();
      
      console.log(`我是玩家 ${playerIndex}, 總共 ${playerCount} 名玩家`);
      
      // 調試 - 檢查所有玩家的手牌分配
      debugPlayerCards(playerCount);
      
      // 獲取當前玩家的手牌
      const playerHand = getPlayerCards(playerIndex, playerCount);
      
      // 模擬發牌動畫
      let progress = 0;
      const dealInterval = setInterval(() => {
        progress += 10;
        setDealProgress(progress);
        
        // 逐漸增加手牌數量，製造發牌效果
        if (progress % 20 === 0) {
          const cardIndex = (progress / 20) - 1;
          if (cardIndex < playerHand.length) {
            setHand(prev => [...prev, playerHand[cardIndex]]);
          }
        }
        
        // 發牌完畢
        if (progress >= 100) {
          clearInterval(dealInterval);
          setIsDealing(false);
          
          // 確保所有牌都顯示了
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
      }, 150);
    }
  };
  
  // 遊戲開始時自動發牌
  useEffect(() => {
    if (isGameStarted && hand.length === 0 && !hasDealtCards && playerCount > 0) {
      dealCards();
    }
  }, [isGameStarted, hand.length, hasDealtCards, playerCount, players, playerId]);
  
  // 當玩家數量或玩家列表變更時，重新計算剩餘牌組
  useEffect(() => {
    if (isGameStarted && playerCount > 0) {
      const remaining = getRemainingCards(playerCount);
      setRemainingCards(remaining);
      
      // 如果尚未發牌，可以在這裡發牌
      if (!hasDealtCards && hand.length === 0) {
        dealCards();
      }
    }
  }, [isGameStarted, playerCount, players, playerId]);
  
  // 監聽WebSocket訊息以更新玩家資訊和玩家ID
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log("GameBoard received message:", data);
        
        if (data.type === "room_info" && data.players) {
          setPlayers(data.players);
          setPlayerCount(data.players.length);
          console.log(`Room has ${data.players.length} players`);
        }
        
        if (data.type === "connection_established") {
          // 從連接成功訊息中提取玩家ID
          const match = data.message.match(/歡迎\s+(.+?)!/);
          if (match && match[1]) {
            setPlayerId(match[1].trim());
            console.log(`Player ID set to: ${match[1].trim()}`);
          }
        }
        
        if (data.type === "sync_remaining_cards" && data.cards) {
          // 接收同步的剩餘牌組資料
          setRemainingCards(data.cards);
          setSyncSuccess(true);
          setIsSyncing(false);
          setLastSyncTime(new Date().toLocaleTimeString());
          
          // 2秒後清除同步成功提示
          setTimeout(() => {
            setSyncSuccess(false);
          }, 2000);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };
    
    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);
  
  // 手動同步剩餘牌組
  const syncRemainingCards = () => {
    if (socket && socket.readyState === WebSocket.OPEN && playerCount > 0) {
      setIsSyncing(true);
      
      // 重新計算剩餘牌組
      const remaining = getRemainingCards(playerCount);
      setRemainingCards(remaining);
      
      // 發送同步請求
      socket.send(JSON.stringify({
        type: "sync_remaining_cards",
        cards: remaining
      }));
      
      // 如果5秒內沒有收到回應，結束同步狀態
      setTimeout(() => {
        if (isSyncing) {
          setIsSyncing(false);
        }
      }, 5000);
    }
  };
  
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
    
    // 判斷是否有同步問題
    const hasDiscrepancy = displayedCount !== expectedCount;
    
    return (
      <div className="remaining-cards-container" style={{ position: 'relative' }}>
        <h2 className="remaining-title">剩餘牌組 ({displayedCount} 張)</h2>
        
        {/* 同步狀態顯示 */}
        {lastSyncTime && (
          <div className="sync-status" style={{ 
            position: 'absolute', 
            right: '15px', 
            top: '15px',
            fontSize: '12px',
            color: '#fff'
          }}>
            上次同步: {lastSyncTime}
          </div>
        )}
        
        {/* 牌組同步警告 */}
        {hasDiscrepancy && (
          <div className="sync-warning" style={{
            color: '#e74c3c',
            padding: '5px',
            marginBottom: '10px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            牌組同步有誤! 應有 {expectedCount} 張牌，實際顯示 {displayedCount} 張。
            建議點擊下方的同步按鈕。
          </div>
        )}
        
        <div className="all-cards-display">
          {remainingCards.map((card, index) => (
            <div 
              key={`remaining-${card.value}`}
              className="card-in-display"
              style={{ 
                transform: `rotate(${(Math.random() * 4 - 2)}deg)`,
                zIndex: index % 10,
                marginLeft: index > 0 ? '-30px' : '0',
                transition: 'transform 0.3s ease'
              }}
            >
              <Card 
                value={card.value}
                bullHeads={card.bull_heads}
                isPlayed={true}
                smallSize={true}
                isDealing={false}
              />
            </div>
          ))}
        </div>
        
        <div className="card-distribution-info">
          遊戲共 104 張牌，
          牌桌上放置 4 張初始牌，
          {playerCount > 0 ? `${playerCount} 名玩家各持有 10 張牌` : "等待玩家加入..."}
        </div>
      </div>
    );
  };
  
  // 計算玩家手牌在牌桌上的位置
  const calculateHandPosition = (index, total) => {
    const angle = -30 + (60 / (total - 1 || 1)) * index;
    const distance = 10;
    return {
      transform: `rotate(${angle}deg) translateY(${-distance}px)`,
      transformOrigin: 'bottom center',
      marginRight: '-25px',
      zIndex: index
    };
  };
  
  // 渲染發牌進度條
  const renderDealProgress = () => {
    if (!isDealing) return null;
    
    return (
      <div className="dealing-progress-container" style={{
        width: '100%',
        marginBottom: '15px',
        borderRadius: '4px',
        overflow: 'hidden',
        height: '8px',
        backgroundColor: '#e0e0e0'
      }}>
        <div className="dealing-progress-bar" style={{
          width: `${dealProgress}%`,
          height: '100%',
          backgroundColor: '#3498db',
          transition: 'width 0.2s ease'
        }}></div>
      </div>
    );
  };

  if (!isPrepared) {
    return null;
  }

  return (
    <div className="game-board-container">
      <div
        className="game-board"
        style={{ backgroundImage: "url('/images/bg.jpg')" }}
      >
        {/* 牌桌區域 */}
        {[0, 1, 2, 3].map((rowIndex) => (
          <div key={rowIndex} className="board-row">
            <div className="row-header">第 {rowIndex + 1} 列</div>
            <div className="row-cards">{createEmptyCardSlots(rowIndex)}</div>
          </div>
        ))}

        {/* 翻牌區 */}
        <div className="board-row flip-area-row">
          <div className="row-header">翻牌區</div>
          <div className="flip-cards-container">{renderFlipArea()}</div>
        </div>

        {/* 我的手牌區域 */}
        <div className="board-row my-hand-row">
          <div className="row-header">我的手牌</div>
          <div className="my-hand-container">
            {renderDealProgress()}
            {isGameStarted ? (
              hand.length > 0 ? (
                <div className="player-hand">
                  {hand.map((card, index) => (
                    <div
                      key={index}
                      className={`hand-card ${
                        selectedCard === index ? "selected" : ""
                      }`}
                      style={calculateHandPosition(index, hand.length)}
                    >
                      <Card
                        value={card.value}
                        bullHeads={card.bull_heads}
                        isPlayed={false}
                        onClick={() => playCard(index)}
                        isDealing={isDealing && index === hand.length - 1}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="empty-hand-message">
                  {isDealing ? "發牌中..." : "等待發牌..."}
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
              <>
                <span className="sync-spinner" style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  marginRight: '8px',
                  animation: 'spin 1s linear infinite'
                }}></span>
                同步中...
              </>
            ) : syncSuccess ? (
              <>
                <span style={{ marginRight: '8px' }}>✓</span>
                同步成功!
              </>
            ) : (
              <>
                <span style={{ marginRight: '8px' }}>↻</span>
                同步牌組
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
