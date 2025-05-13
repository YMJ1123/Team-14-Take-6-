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
  // 用戶已出的牌
  const [playedCard, setPlayedCard] = useState(null);
  // 確認按鈕狀態
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  // 當前用戶名
  const [currentUser, setCurrentUser] = useState("");
  
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
  
  // 找出當前玩家在房間中的索引
  const findMyPlayerIndex = () => {
    if (!playerId || players.length === 0) {
      console.warn("Player ID 或玩家列表尚未準備好 (findMyPlayerIndex).");
      return 0; 
    }
    const myIndex = players.findIndex(player => player.id === playerId); 
    
    if (myIndex === -1) {
      console.warn(`玩家 ID "${playerId}" 在玩家列表 ${JSON.stringify(players)} 中未找到.`);
      return 0; 
    }
    return myIndex;
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
      console.log("我在這個房間的順序編號是：", playerIndex);
      
      // 設置「發牌中」的狀態
      setHand([]);
      
      // 不再在客戶端計算手牌，而是向後端請求
      socket.send(JSON.stringify({
        type: "request_cards",
        player_index: playerIndex
      }));
      
      // 標記已經請求過牌
      setHasDealtCards(true);
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
      console.log("GameBoard received message:", data);
      
      if (data.type === "update_board") {
        setBoard(data.board);
      }
      
      if (data.type === "flipped_cards") {
        setFlippedCards(data.cards);
        setIsFlipping(false);
        // 收到所有翻開的牌後，重置已出牌狀態
        setPlayedCard(null);
      }
      
      if (data.type === "player_flipping") {
        setIsFlipping(true);
      }
      
      // 處理出牌確認 - 其他玩家出牌不會影響我們的手牌
      if (data.type === "card_played") {
        console.log("有玩家出牌:", data);
        
        // 檢查是否是其他玩家出的牌
        const isOtherPlayer = data.player_id !== playerId;
        
        // 只有在確實是其他玩家出的牌時才添加到翻牌區域
        if (isOtherPlayer) {
          // 創建一個臨時的牌對象，用於顯示其他玩家的牌（背面）
          const tempCard = {
            player_name: data.player_name || data.player_username || "其他玩家",
            player_id: data.player_id,
            isOtherPlayer: true  // 標記這是其他玩家的牌
          };
          
          // 將其他玩家出的牌（背面）添加到翻牌區
          setFlippedCards(prev => {
            // 過濾掉已存在的同玩家牌，避免重複
            const filtered = prev.filter(card => 
              !card.player_id || card.player_id !== tempCard.player_id
            );
            return [...filtered, tempCard];
          });
        } else {
          // 如果是自己出的牌，我們已經在本地顯示了，不需要重複添加 problem
          console.log("收到自己出牌的廣播，忽略");
        }
      }
      
      // 更新玩家資訊和玩家ID
      if (data.type === "room_info" && data.players) {
        setPlayers(data.players); // 儲存完整的玩家列表
        setPlayerCount(data.players.length);
        console.log(`房間目前有 ${data.players.length} 位玩家. 玩家資料:`, data.players);

        // 如果已取得 playerId，顯示自己在房間中的順序
        if (playerId) {
          const myIdx = players.findIndex(p => p.id === playerId);
          if (myIdx !== -1) {
            console.log(`我在房間中的順序編號是: ${myIdx} (從0開始計數)`);
          }
        }
      }

      // 處理來自後端的連接確認或身份訊息
      if (data.type === "connection_established") {
        if (data.playerId) { // 如果後端直接提供 playerId
          setPlayerId(data.playerId);
          console.log(`玩家 ID 已設定為: ${data.playerId}`);
          
          // 如果有用戶名，也設置它
          if (data.message) {
            const match = data.message.match(/歡迎\s+(.+?)!/);
            if (match && match[1]) {
              const username = match[1].trim();
              setCurrentUser(username);
              console.log(`設定當前用戶名為: ${username}`);
            }
          }
        }
      }
      
      // 更新玩家數量
      if (data.type === "player_count" && data.players === undefined) { 
        const count = data.count;
        if (count !== undefined && count > 0 && players.length === 0) { 
          console.log(`Updated player count via 'player_count': ${count}`);
          setPlayerCount(count);
        }
      }
      
      // 處理從後端接收到的卡牌分配
      if (data.type === "cards_assigned") {
        const newHand = data.cards;
        setHand(newHand);
        setSelectedCard(null);
        setPlayedCard(null); // 重置已出牌狀態
        console.log("收到手牌:", newHand);
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
  }, [socket, isGameStarted, playerId, players]);

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
  
  // 渲染翻牌區域
  const renderFlipArea = () => {
    const allCards = [];
    
    // 如果用戶已出牌，添加自己的牌到顯示列表
    if (playedCard) {
      allCards.push({
        key: `my-card`,
        element: (
          <div className="flipped-card">
            <Card
              value={playedCard.value}
              bullHeads={playedCard.bull_heads}
              isBack={true}  // 使用 isBack 屬性來顯示牌背 problem
              isPlayed={true}
            />
            <div className="player-name">我</div>
          </div>
        )
      });
    }
    
    // 如果有來自服務器的翻牌數據，添加到顯示列表
    if (flippedCards.length > 0) {
      flippedCards.forEach((card, index) => {
        // 檢查這張牌是否來自其他玩家（不是自己）
        const isFromOtherPlayer = card.isOtherPlayer;
        
        if (isFromOtherPlayer) {
          // 添加其他玩家的牌（背面）
          allCards.push({
            key: `other-player-${index}`,
            element: (
              <div className="flipped-card">
                <Card
                  value={1}  // 給一個默認值
                  bullHeads={1}
                  isBack={true}  // 顯示牌背
                  isPlayed={true}
                />
                <div className="player-name">{card.player_name}</div>
              </div>
            )
          });
        } else {
          // 正常顯示已翻開的牌
          allCards.push({
            key: `flipped-${index}`,
            element: (
              <div className="flipped-card">
                <Card
                  value={card.value}
                  bullHeads={card.bull_heads}
                  isPlayed={true}
                />
                <div className="player-name">{card.player_name}</div>
              </div>
            )
          });
        }
      });
    }
    
    // 如果有牌要顯示，渲染它們
    if (allCards.length > 0) {
      return allCards.map(item => (
        <React.Fragment key={item.key}>
          {item.element}
        </React.Fragment>
      ));
    }
    
    // 如果正在翻牌過程中
    if (isFlipping) {
      return (
        <div className="waiting-message">
          翻牌中...
        </div>
      );
    }
    
    // 默認狀態：等待所有玩家出牌
    return (
      <div className="waiting-message">
        請選擇一張牌出牌
      </div>
    );
  };
  
  // 處理玩家選擇牌
  const playCard = (cardIndex) => {
    // 如果已經出牌，不允許再選
    if (playedCard !== null) {
      return;
    }

    // 如果點擊的是已選中的牌，取消選擇
    if (selectedCard === cardIndex) {
      setSelectedCard(null);
      setShowConfirmButton(false);
    } else {
      // 選擇牌
      setSelectedCard(cardIndex);
      setShowConfirmButton(true);
    }
  };

  // 確認出牌
  const confirmPlayCard = () => {
    if (selectedCard === null) return;

    // 獲取選中的牌
    const card = hand[selectedCard];
    
    // 保存已出牌的信息
    setPlayedCard(card);
    
    // 從手牌中移除該牌
    const newHand = [...hand];
    newHand.splice(selectedCard, 1);
    setHand(newHand);
    
    // 發送出牌信息到服務器，包括更多信息 problem
    socket.send(JSON.stringify({
      type: "play_card",
      card_idx: selectedCard,
      player_id: playerId,  // 發送自己的 ID
      player_name: currentUser || "玩家", // 發送玩家名稱
      value: card.value, // 發送牌值（後端可以決定是否向其他玩家揭示）
      bull_heads: card.bull_heads // 發送牛頭數（後端可以決定是否向其他玩家揭示）
    }));
    
    // 重置選擇狀態
    setSelectedCard(null);
    setShowConfirmButton(false);
  };

  // 取消選擇
  const cancelSelection = () => {
    setSelectedCard(null);
    setShowConfirmButton(false);
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
        <div className="board-row flip-area-row">
          <div className="row-header">同時翻牌</div>
          <div className="flip-cards-container">
            {renderFlipArea()}
          </div>
        </div>
        
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
          <div>
              {selectedCard !== null && (
                <div className="card-action">
                  <button onClick={confirmPlayCard} className="confirm-play-btn">
                    確認出牌
                  </button>
                  <button onClick={cancelSelection} className="cancel-btn">
                    取消
                  </button>
                </div>
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
    </div>
  );
};

export default GameBoard;
