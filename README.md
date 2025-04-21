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

python manage.py runserver (啟動後端django)

## 已經在本地開過之後
conda activate final_team14

cd frontend 

npm run dev

打開 http://localhost:5173/ 看畫面

開新的terminal:

conda activate final_team14

cd backend

(powershell:)$env:DJANGO_SETTINGS_MODULE = "take6.settings"
(bash:)DJANGO_SETTINGS_MODULE=take6.settings daphne -p 8000 take6.asgi:application

daphne -p 8000 take6.asgi:application

這個只支援http不支援WebSocket (python manage.py runserver)

打開 127.0.0.1:8000 看畫面

## 如果有安裝新套件
如果是python相關套件(for django): 

記得用 pip freeze > requirements.txt 更新原本的requirements.txt

如果是JavaScript相關套件(for react):

他應該會在安裝之後自動記錄到package.json裡面，不用自己更新
