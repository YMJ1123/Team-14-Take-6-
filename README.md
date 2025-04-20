# Team-14-Take-6-

### 首次打開
conda create -n final_team14(自己取名) python=3.10

conda activate final_team14

pip install -r requirements.txt

cd backend

python manage.py makemigrations

python manage.py migrate

python manage.py runserver

### 已經在本地開過之後
conda activate final_team14

cd backend

python manage.py runserver

打開127.0.0.1:8000看畫面

### 如果有安裝新套件
記得用 pip freeze > requirements.txt 更新原本的requirements.txt
