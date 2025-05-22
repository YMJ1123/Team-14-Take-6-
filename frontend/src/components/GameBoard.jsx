import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./Card";
import "../styles/game_board.css";

const GameBoard = ({ socket, isPrepared, isGameStarted }) => {
  const navigate = useNavigate();
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
  const [currentUser, setCurrentUser] = useState(null);
  // 新增：用於存儲需要選擇的列和牛頭數
  const [choosingRows, setChoosingRows] = useState([]);
  // 新增：等待選擇的玩家名
  const [waitingPlayer, setWaitingPlayer] = useState(null);
  const [gameRound, setGameRound] = useState(1); // 追蹤遊戲輪次
  const [showRestartMessage, setShowRestartMessage] = useState(false); // 顯示重新開始的訊息
  // 遊戲是否結束
  const [isGameOver, setIsGameOver] = useState(false);
  // 遊戲結束數據
  const [gameOverData, setGameOverData] = useState(null);
  
  // 獲取當前登入用戶資訊
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/current-user/');
      if (response.ok) {
        const userData = await response.json();
        console.log("獲取到當前用戶資訊:", userData);
        setCurrentUser(userData);
        // 如果有用戶ID，設置playerId
        if (userData && userData.id) {
          setPlayerId(userData.id);
          console.log(`從用戶資訊設定玩家ID: ${userData.id}`);
        }
      } else {
        console.error("獲取當前用戶資訊失敗:", response.status);
      }
    } catch (error) {
      console.error("獲取當前用戶信息時出錯:", error);
    }
  };
  
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
    // 獲取當前用戶信息
    fetchCurrentUser();

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
      
      // 處理遊戲結束消息
      if (data.type === "game_over") {
        console.log("收到遊戲結束消息:", data);
        setIsGameOver(true);
        setGameOverData(data.data);
        // 清除所有遊戲狀態
        setFlippedCards([]);
        setIsFlipping(false);
        setPlayedCard(null);
        setSelectedCard(null);
        setChoosingRows([]);
        setWaitingPlayer(null);
      }
      
      // 處理出牌確認 - 其他玩家出牌不會影響我們的手牌
      if (data.type === "card_played") {
        console.log("收到卡牌出牌消息:", data);
        console.log("當前玩家ID:", playerId);
        
        // 檢查是否是其他玩家出的牌 - 只需檢查sender_id是否不等於自己的playerId
        const isOtherPlayer = data.sender_id !== playerId;
        
        console.log(`是否為其他玩家出的牌: ${isOtherPlayer} (sender_id=${data.sender_id}, playerId=${playerId})`);
        
        // 只有在確實是其他玩家出的牌時才添加到翻牌區域
        if (isOtherPlayer) {
          // 創建一個臨時的牌對象，用於顯示其他玩家的牌
          const tempCard = {
            player_name: data.player_name || data.player_username || "其他玩家",
            player_id: data.player_id || data.sender_id, // 優先使用player_id，如果沒有則使用sender_id
            player_idx: data.player_idx,
            isOtherPlayer: true,  // 標記這是其他玩家的牌
            value: data.card_value || 0,  // 保存牌值（雖然暫時不顯示）
            bull_heads: data.bull_heads || 0  // 保存牛頭數（雖然暫時不顯示）
          };
          
          console.log("添加其他玩家出的牌到翻牌區:", tempCard);
          
          // 將其他玩家出的牌添加到翻牌區
          setFlippedCards(prev => {
            // 過濾掉已存在的同玩家牌，避免重複
            const filtered = prev.filter(card => 
              !card.player_id || card.player_id !== tempCard.player_id
            );
            const newCards = [...filtered, tempCard];
            console.log("更新後的翻牌區:", newCards);
            return newCards;
          });
        } else {
          // 如果是自己出的牌，我們已經在本地顯示了，不需要重複添加
          console.log("收到自己出牌的廣播，忽略");
        }
      }
      // 處理收哪排的消息
      if (data.type === "i_choose_row") {
        console.log("我要選則收某排牌", data);
        // 設置需要選擇的列和每列對應的牛頭數
        const rowBullHeads = data.bull_heads;
        // // 獲取每列的牛頭數
        // for (let i = 0; i < board.length; i++) {
        //   let rowBulls = 0;
        //   board[i].forEach(card => {
        //     if (card && card.bull_heads) {
        //       rowBulls += card.bull_heads;
        //     }
        //   });
        //   rowBullHeads.push(rowBulls);
        // }
        setChoosingRows(rowBullHeads);
        // 清除等待狀態
        setWaitingPlayer(null);
      }
      
      if (data.type === "wait_choose_card") {
        console.log("等待某玩家收某排牌", data);
        // 設置等待的玩家名
        if (data.player_name) {
          setWaitingPlayer(data.player_name);
        } else {
          // 如果沒有直接提供名字，嘗試從 player_id 獲取
          if (data.player_id && players.length > 0) {
            const player = players.find(p => p.id === data.player_id);
            if (player) {
              setWaitingPlayer(player.username);
            } else {
              setWaitingPlayer("某玩家");
            }
          } else {
            setWaitingPlayer("某玩家");
          }
        }
        // 清除選擇狀態
        setChoosingRows([]);
      }

      // 處理回合完成的消息（所有玩家都已出牌）
      if (data.type === "round_completed") {
        console.log("回合完成，所有玩家已出牌:", data);
        
        // 清除選擇和等待狀態
        setChoosingRows([]);
        setWaitingPlayer(null);
        
        // 更新牌桌
        if (data.board) {
          setBoard(data.board);
        }
        
        // 清空同時出牌區域
        setFlippedCards([]);
        setIsFlipping(false);
        setPlayedCard(null); // 重置已出牌狀態
        
        console.log("牌桌更新完成，翻牌區已清空");
      }
      
      // 處理遊戲重新發牌的消息
      if (data.type === "game_restarted") {
        console.log("遊戲重新發牌:", data);
        
        // 顯示遊戲重新發牌的消息
        setShowRestartMessage(true);
        
        // 更新遊戲輪次
        setGameRound(prevRound => prevRound + 1);
        
        // 更新牌桌
        if (data.board) {
          setBoard(data.board);
        }
        
        // 清空同時出牌區域和手牌
        setFlippedCards([]);
        setIsFlipping(false);
        setPlayedCard(null);
        setHand([]);
        
        console.log("遊戲重置完成，請求新手牌");
      }
      
      // 處理請求新手牌的消息
      if (data.type === "request_new_cards") {
        console.log("請求新手牌:", data);
        
        // 請求新手牌
        // if (socket && playerId !== null) {
        const playerIndex = findMyPlayerIndex();
        socket.send(JSON.stringify({
          type: "request_cards_again",
          // player_index: playerIndex
        }));
        // }
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
          
          // 連接建立後立即請求房間信息
          socket.send(JSON.stringify({
            type: "get_room_info"
          }));
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

  // 自動消失重新開始訊息
  useEffect(() => {
    if (showRestartMessage) {
      const timer = setTimeout(() => {
        setShowRestartMessage(false);
      }, 5000); // 5秒後自動隱藏
      
      return () => clearTimeout(timer);
    }
  }, [showRestartMessage]);

  // 修改 createEmptyCardSlots 函數以顯示牛頭數
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
              // smallSize={true}
              // mediumSize={true}
            />
          ) : null}
        </div>
      );
    }
    
    // 如果當前行需要選擇，顯示牛頭數
    if (choosingRows.length > 0 && rowIndex < choosingRows.length) {
      return (
        <React.Fragment>
          {slots}
          <div className="row-bull-heads-container">
            <div className="row-bull-heads">
              <img src="/images/bull-head-icon.png" alt="Bull" className="bull-icon" />
              <span className="bull-count">{choosingRows[rowIndex]}</span>
            </div>
            <button 
              className="choose-row-btn"
              onClick={() => handleChooseRow(rowIndex)}
            >
              選擇此列
            </button>
          </div>
        </React.Fragment>
      );
    }
    
    return slots;
  };
  
  // 添加選擇列的處理函數
  const handleChooseRow = (rowIndex) => {
    // 發送選擇的列到服務器
    if (socket) {
      socket.send(JSON.stringify({
        type: "choose_row_response",
        row_index: rowIndex,
        player_id: playerId
      }));
      
      // 清除選擇狀態
      setChoosingRows([]);
    }
  };

  // 修改 renderFlipArea 函數以顯示等待覆蓋層
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
              isBack={false}  // 使用 isBack 屬性來顯示牌背
              isPlayed={true}
              // mediumSize={true}
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
        
        // 嘗試從玩家列表查找正確的用戶名
        let displayName = card.player_name;
        
        // 如果有player_id，優先使用玩家列表中的username
        if (card.player_id && players.length > 0) {
          const foundPlayer = players.find(p => p.id === card.player_id);
          if (foundPlayer) {
            displayName = foundPlayer.username || foundPlayer.display_name;
            if (!foundPlayer.username) {
              displayName += " (訪客)";
            }
          }
        }
        
        // 當收到 i_choose_row 或 wait_choose_card 消息時，所有牌都顯示正面
        const shouldShowFaceUp = choosingRows.length > 0 || waitingPlayer !== null;
        
        // 添加其他玩家的牌
        allCards.push({
          key: `other-player-${index}`,
          element: (
            <div className="flipped-card">
              <Card
                value={shouldShowFaceUp ? card.value : 1}  // 如果應該顯示正面，則使用實際值
                bullHeads={shouldShowFaceUp ? card.bull_heads : 1}
                isBack={!shouldShowFaceUp && isFromOtherPlayer}  // 根據條件決定是否顯示牌背
                isPlayed={true}
                // mediumSize={true}
              />
              <div className="player-name">{displayName}</div>
            </div>
          )
        });
      });
    }
    
    // 等待選擇的覆蓋層
    const waitingOverlay = waitingPlayer ? (
      <div className="waiting-overlay">
        <div className="waiting-message">
          <span className="waiting-player">{waitingPlayer}</span> 正在選擇要收哪排
        </div>
      </div>
    ) : null;
    
    // 如果有牌要顯示，渲染它們
    if (allCards.length > 0) {
      return (
        <div className="flip-area-content">
          {allCards.map(item => (
            <React.Fragment key={item.key}>
              {item.element}
            </React.Fragment>
          ))}
          {waitingOverlay}
        </div>
      );
    }
    
    // 如果正在翻牌過程中
    if (isFlipping) {
      return (
        <div className="waiting-message">
          翻牌中...
          {waitingOverlay}
        </div>
      );
    }
    
    // 默認狀態：等待所有玩家出牌
    return (
      <div className="waiting-message">
        請選擇一張牌出牌
        {waitingOverlay}
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
    
    // 獲取自己在房間中的索引
    const myIndex = findMyPlayerIndex();
    console.log(`出牌時我的房間索引是: ${myIndex}`);
    
    // 準備玩家名稱 - 優先使用當前登入用戶名
    let playerName = "訪客";
    if (currentUser && currentUser.username) {
      playerName = currentUser.username;
    } else if (players.length > 0 && playerId) {
      const playerInfo = players.find(p => p.id === playerId);
      if (playerInfo) {
        playerName = playerInfo.username || playerInfo.display_name || "訪客";
      }
    }
    
    console.log(`出牌玩家資訊: ID=${playerId}, 名稱=${playerName}, 索引=${myIndex}`);
    
    // 發送出牌信息到服務器
    socket.send(JSON.stringify({
      type: "play_card",
      card_idx: selectedCard,
      player_id: playerId,  // 發送自己的 ID
      player_index: myIndex, // 發送自己在房間中的索引
      player_name: playerName, // 使用準備好的玩家名稱
      value: card.value, // 發送牌值
      bull_heads: card.bull_heads // 發送牛頭數
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

  // 處理返回大廳按鈕
  const handleBackToLobby = () => {
    // 關閉 WebSocket 連接
    if (socket && socket.readyState === WebSocket.OPEN) {
      // 正常關閉 WebSocket
      socket.close(1000, "用戶離開遊戲");
    }
    
    // 導航回主頁面
    navigate('/');
  };

  // 渲染遊戲結束畫面
  const renderGameOver = () => {
    if (!isGameOver || !gameOverData) return null;
    
    const { losers, winners, all_players } = gameOverData;
    const winner = winners[0];
    const loser = losers[0];
    const isCurrentUserLoser = currentUser && loser.id === currentUser.id;
    
    return (
      <div className="game-over-overlay">
        <div className="game-over-modal">
          <h2>遊戲結束</h2>
          <p>
            {isCurrentUserLoser ? 
              '您的分數已歸零，遊戲結束！' : 
              `玩家 ${loser.username || loser.display_name}${!loser.username ? ' (訪客)' : ''} 分數歸零，遊戲結束！`}
          </p>
          
          <div className="loser-section">
            <h3>🥺 輸家</h3>
            <div className="loser-info">
              <span className="player-name">
                {isCurrentUserLoser ? '您' : (loser.username || loser.display_name)}
                {isCurrentUserLoser && <span className="self-indicator">（您自己）</span>}
                {!isCurrentUserLoser && !loser.username && " (訪客)"}
              </span>
              <span className="player-score negative-score">{loser.score} 分</span>
            </div>
          </div>
          
          <div className="winner-section">
            <h3>🏆 贏家</h3>
            <div className="winner-info">
              <span className="player-name">
                {currentUser && winner.id === currentUser.id ? '您' : (winner.username || winner.display_name)}
                {currentUser && winner.id === currentUser.id && <span className="self-indicator">（您自己）</span>}
                {!(currentUser && winner.id === currentUser.id) && !winner.username && " (訪客)"}
              </span>
              <span className="player-score">{winner.score} 分</span>
            </div>
          </div>
          
          <div className="all-players-ranking">
            <h3>所有玩家排名</h3>
            <div className="ranking-list">
              {all_players.map((player, index) => (
                <div 
                  key={`rank-${index}`} 
                  className={`player-rank ${player.score <= 0 ? 'eliminated-player' : ''} ${currentUser && player.id === currentUser.id ? 'current-player' : ''}`}
                >
                  <span className="rank-number">#{index + 1}</span>
                  <span className="player-name">
                    {currentUser && player.id === currentUser.id ? '您' : player.username}
                    {currentUser && player.id === currentUser.id && <span className="self-indicator">（您自己）</span>}
                  </span>
                  <span className={`player-score ${player.score <= 0 ? 'negative-score' : ''}`}>
                    {player.score} 分
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <button className="back-to-lobby-btn" onClick={handleBackToLobby}>
            返回大廳
          </button>
        </div>
      </div>
    );
  };

  if (!isPrepared) {
    return null;
  }

  return (
    <div className="game-board-container">
      {/* 遊戲結束覆蓋層 */}
      {renderGameOver()}
      
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
          <div className="my-hand-container" style={{
            backgroundColor: 'rgba(5, 30, 12, 0.95)',
            backgroundImage: 'linear-gradient(135deg, rgba(5, 25, 10, 0.9) 0%, rgba(8, 35, 15, 0.9) 50%, rgba(5, 25, 10, 0.9) 100%)',
            border: '2px solid #d4af37',
            borderRadius: '8px',
            boxShadow: '0 0 15px rgba(255, 215, 0, 0.4), inset 0 0 30px rgba(0, 0, 0, 0.5)'
          }}>
            {isGameStarted && !isGameOver ? (
              hand.length > 0 ? (
                <div className="player-hand" style={{
                  backgroundColor: 'rgba(5, 30, 12, 0.95)',
                  backgroundImage: 'linear-gradient(135deg, rgba(8, 40, 15, 0.9) 0%, rgba(10, 50, 20, 0.9) 50%, rgba(8, 40, 15, 0.9) 100%)',
                  padding: '20px',
                  border: '2px solid rgba(212, 175, 55, 0.4)',
                  borderRadius: '8px',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
                }}>
                  {hand.map((card, index) => (
                    <div 
                      key={`hand-${index}`} 
                      className={`hand-card ${selectedCard === index ? 'selected' : ''}`}
                      style={{ 
                        transform: `rotate(${Math.random() * 2 - 1}deg)`,
                        marginLeft: index > 0 ? '-25px' : '0' /* Increased overlap from -15px to -25px */
                      }}
                    >
                      <Card
                        value={card.value}
                        bullHeads={card.bull_heads}
                        isPlayed={false}
                        onClick={() => playCard(index)}
                        onDoubleClick={() => {
                          // On double-click, automatically select and confirm the card
                          setSelectedCard(index);
                          setTimeout(() => confirmPlayCard(), 10);
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="empty-hand-message">
                  發牌中...
                </span>
              )
            ) : isGameOver ? (
              <div className="empty-hand-container">
                <span className="empty-hand-message">
                  遊戲已結束
                </span>
              </div>
            ) : (
              <div className="empty-hand-container">
                <span className="empty-hand-message">
                  遊戲開始後將顯示您的牌
                </span>
              </div>
            )}
          </div>
          <div>
              {selectedCard !== null && !isGameOver && (
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
      {isGameStarted && !isGameOver && renderRemainingCards()}
      
      {/* 同步按鈕 */}
      {isGameStarted && !isGameOver && (
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
