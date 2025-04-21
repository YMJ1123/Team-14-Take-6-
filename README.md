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

(powershell 分兩行跑:)$env:DJANGO_SETTINGS_MODULE = "take6.settings"

daphne -p 8000 take6.asgi:application

(bash:)DJANGO_SETTINGS_MODULE=take6.settings daphne -p 8000 take6.asgi:application

這個只支援http不支援WebSocket (python manage.py runserver)

## 已經在本地開過之後
conda activate final_team14

cd frontend 

npm run dev

打開 http://localhost:5173/ 看畫面

開新的terminal:

conda activate final_team14

cd backend

daphne -p 8000 take6.asgi:application

這個只支援http不支援WebSocket (python manage.py runserver)

打開 127.0.0.1:8000 看畫面

## 如果有安裝新套件
如果是python相關套件(for django): 

記得用 pip freeze > requirements.txt 更新原本的requirements.txt

如果是JavaScript相關套件(for react):

他應該會在安裝之後自動記錄到package.json裡面，不用自己更新

## 進度
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
