import React, { useState, useEffect, useRef } from "react";
import "../styles/game_room.css";

const ChatBox = ({ socket }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const chatRef = useRef(null);
  const audioRef = useRef(null);
  const userRef = useRef("");      // ← 存放自己的使用者名稱

  // 點擊頁面後才允許播放聲音
  const [soundEnabled, setSoundEnabled] = useState(false);
  useEffect(() => {
    const onClick = () => { setSoundEnabled(true); document.removeEventListener("click", onClick); };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 處理 WebSocket 收到的訊息
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);

      // 產生唯一的 key
      const id = Date.now() + Math.random();

      if (data.type === "connection_established") {
        // 解析自己的使用者名稱
        const m = data.message.match(/歡迎 (.+?)!/);
        if (m) userRef.current = m[1].trim();
        setMessages(prev => [...prev, {
          id, sender: "系統", text: data.message, isSystem: true
        }]);
      }
      else if (data.type === "chat_message") {
        const sender = data.username || "系統";
        const isSelf = sender === userRef.current;

        setMessages(prev => [...prev, {
          id, sender, text: data.message,
          isSystem: false, isSelf
        }]);
      }
      else if (data.type === "user_notification") {
        setMessages(prev => [...prev, {
          id, sender: "系統", text: data.message, isSystem: true
        }]);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  // 滾動到最新訊息
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // 發送訊息
  const sendMessage = () => {
    if (!message.trim() || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "chat_message", message: message.trim() }));
    playSound();
    setMessage("");
  };

  // 播放送出聲音
  const playSound = () => {
    if (!soundEnabled) return;
    const audio = new Audio("https://soundbible.com/mp3/Click2-Sebastian-759472264.mp3");
    audio.volume = 0.3;
    audio.play().catch(()=>{/* 靜默失敗 */});
  };

  return (
    <div id="chatContainer">
      <h2>聊天室:</h2>
      <div id="chatMessages" ref={chatRef} style={{
        height: 300, 
        overflowY: "auto", 
        padding: 10,
        border: "1px solid #ccc", 
        background: "#ffffff", // 改為白色背景
        fontFamily: "monospace",
        fontSize: "1rem" // 增大字體
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            marginBottom: "8px", // 增大間距
            padding: "2px 0",
            // 移除底部邊框
          }}>
            {msg.isSystem ? (
              // 系統訊息
              <div style={{
                color: "#777",
                fontStyle: "italic",
                textAlign: "center",
                padding: "2px 0",
                fontSize: "1rem" // 增大字體
              }}>
                *** {msg.text} ***
              </div>
            ) : (
              // 一般訊息 - 使用傳統的格式
              <div style={{
                color: msg.isSelf ? "blue" : "black",
                fontSize: "1rem" // 增大字體
              }}>
                <span style={{
                  fontWeight: "bold",
                  color: msg.isSelf ? "blue" : "#444"
                }}>
                  {msg.sender}:
                </span>{" "}
                {msg.text}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 8 }}>
        <input
          type="text" 
          value={message} 
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          style={{ 
            flex: 1, 
            padding: 8, 
            border: "1px solid #ccc",
            fontSize: "1rem" // 增大輸入框字體
          }}
        />
        <button 
          onClick={sendMessage} 
          style={{
            marginLeft: 4, 
            padding: "4px 12px",
            background: "#3498db", 
            color: "#fff",
            border: "1px solid #2980b9",
            fontSize: "1rem" // 增大按鈕字體
          }}
        >
          發送
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
