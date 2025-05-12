# Team-14-Take-6-

## 先確認是否有以下套件
- Python 3.10+
- pip（通常隨 Python 安裝）
- Node.js (含 npm)：
  - 安裝方式請見：https://nodejs.org/
  - 建議版本：Node.js 18 或以上
- 用 node -v 和 npm -v 來確認是否安裝完成

## 首次打開
### 前端 (vite + react)
cd frontend

npm install

如果出現類似"2 moderate severity vulnerabilities"這種問題的話

可以輸入npm audit fix --force來解決，確定有出現found 0 vulnerabilities就可以了

npm run dev (啟動前端react)

### 後端
conda create -n final_team14(自己取名) python=3.10

conda activate final_team14

pip install -r requirements.txt

cd backend

python manage.py makemigrations

python manage.py migrate

(powershell 跑這兩行:)$env:DJANGO_SETTINGS_MODULE = "take6.settings"

daphne -p 8000 take6.asgi:application

(bash 跑後面這一行就好:)DJANGO_SETTINGS_MODULE=take6.settings daphne -p 8000 take6.asgi:application

原本這個指令只支援http不支援WebSocket: python manage.py runserver

## 已經在本地開過之後
conda activate final_team14

cd frontend 

npm run dev

打開 http://localhost:5173/ 看畫面

開新的terminal:

conda activate final_team14

cd backend

daphne -p 8000 take6.asgi:application

打開 127.0.0.1:8000 看畫面

原本這個指令只支援http不支援WebSocket: python manage.py runserver

## 如果有安裝新套件
如果是python相關套件(for django): 

記得用 pip freeze > requirements.txt 更新原本的requirements.txt

如果是JavaScript相關套件(for react):

他應該會在安裝之後自動記錄到package.json裡面，不用自己更新

## 如果本地db有問題 pull別人正常的之後 還是有問題
- Stop your Django development server.

- Delete backend/db.sqlite3.

- Delete migration files:
    - Go to backend/game/migrations/ and delete all files inside it except __init__.py.
    - Go to backend/users/migrations/ and delete all files inside it except __init__.py (if this folder and migration files exist).

- Activate your Conda environment (final_team14).

- Recreate migrations:
    - From your project root (C:\Users\USER\Downloads\Team-14-Take-6-), run:
        - python backend/manage.py makemigrations game
        - python backend/manage.py makemigrations users

- Apply migrations:
    - Run python backend/manage.py migrate

## 進度

- 0509 AndyChen
    - 牌設計（顯示於剩餘牌數區）
        - 真實104張牌的視覺化顯示，每張牌都有對應的數字和牛頭數
        - 調整牌的排列方式，使它們部分重疊以改善顯示效果
        - 根據牛頭數量為牌設置不同顏色
        - 增加了牌中央的bull-head-bg.png底圖，並調整大小和可見度
    - 遊戲界面布局
        - 桌底進行了以下設計和優化 使用了2x2_background_table.jpeg作為遊戲桌面的背景圖像
        - 同時翻牌區 整合到遊戲板 
        - 我的手牌整合到牌桌內
        - 調整了各元素的大小和位置，使界面更加協調
    - 整體視覺提升
        - 調整了重疊牌的間距和層級，使其看起來更自然
        - 增強了牌的懸停效果，改善用戶交互體驗
        - 統一了視覺風格，使界面更專業、更吸引人
    - 音樂
        - 背景音樂: 在遊戲大廳和準備階段播放輕鬆的背景音樂
        - 遊戲開始音效: 當玩家準備並開始遊戲時播放特殊的開始音效
        - 音樂控制按鈕: 提供了開關音樂的控制按鈕，顯示當前音樂狀態


- 0425 AndyChen
    - 聊天室改進
        - 讓訊息可以順利傳送
        - 加上離開聊天室和進入聊天室的通知
        - 新增「用戶名: 訊息」的格式
        - 增大字體，使整體風格與旁邊版面保持一致。
    - 主畫面改進
        - 顯示現有房間列表，可供加入房間
        - 每個房間新增顯示房間人數與建立時間
    - 創建房間介面
        - 改善創建房間表單樣式，包括輸入框與按鈕的字體及顏色
        - 增加表單交互效果，提升使用體驗
    - 房間內功能
        - 在遊戲房間頁面內新增「刪除房間」選項
        - 加入返回大廳的按鈕，方便使用者操作
    - 房間人數
        - 先加入主畫面但目前人數功能尚未完成

- 0422 0007 hyc
    - 把vite+react加上去
    - 前端要在http://localhost:5173看
    - 後端可以在127.0.0.1:8000看資料庫內容
        - 例如: 127.0.0.1:8000/api/rooms 可以看到全部的房間
        - 因為有用WebSocket所以開的方法和之前不同 (詳閱上面的解說)
    - 按下主頁的"創建"新房間 會跳轉到 http://localhost:5173/game/"房間名稱"/
    - 主頁是pages/Home.jsx
        - 由上到下包含components/RoomList, CreateRoomForm, AboutGame, ApiDocs(這個之後可以刪掉)
    - 跳轉到新創房間是pages/GameRoom.jsx
        - 由上到下包含components/GameStatus, GameBoard, PlayerHand, ChatBox

    - 分別的css都寫在styles資料夾底下
    - backend/templates應該可以刪掉了
    - 在fetch的時候，需要注意清楚後端資料庫設定名稱為何

    - 錯誤raise
        - 出現raise ImproperlyConfigured(
        django.core.exceptions.ImproperlyConfigured: Requested setting INSTALLED_APPS, but settings are not configured. You must either define the environment variable DJANGO_SETTINGS_MODULE or call settings.configure() before accessing settings. 錯誤的話，代表backend/consumers.py某些東西import要放在需要的def裡面，不能在開頭用 
    - 未來需更新點
        - 之後要設定安全設定，不能隨便更改url為其他gameroom名稱就能跳到其他gameroom
        - 目前還不知道為什麼backend/take6/settings.py裡面的CORS_ALLOW_ORIGINS不能設定前端的網站，如果不開放全部通過，就會出現error

- 0420 ymj
    - 用django完成前後端，可以創立遊戲間 
