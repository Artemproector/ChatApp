from flask import Flask, render_template, request, jsonify
import os
import json
import time
import random
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE_PATH = os.path.join(BASE_DIR, 'static', 'memory.json')
KEY_FILE = os.path.join(BASE_DIR, 'secret.key')

def load_or_create_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, 'wb') as f:
            f.write(key)
        try:
            os.chmod(KEY_FILE, 0o600)
        except:
            pass
        return key
try:
    SECRET_KEY = load_or_create_key()
    cipher_suite = Fernet(SECRET_KEY)
    print("✓ Шифрование инициализировано")
except Exception as e:
    print(f"✗ Ошибка инициализации шифрования: {e}")
    cipher_suite = None
def encrypt_message(message):
    if cipher_suite is None:
        return message
    try:
        encrypted = cipher_suite.encrypt(message.encode('utf-8'))
        return base64.b64encode(encrypted).decode('utf-8')
    except Exception as e:
        print(f"Ошибка шифрования: {e}")
        return message
def decrypt_message(encrypted_message):
    if cipher_suite is None or not encrypted_message:
        return encrypted_message
    try:
        encrypted_bytes = base64.b64decode(encrypted_message.encode('utf-8'))
        decrypted = cipher_suite.decrypt(encrypted_bytes)
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Ошибка расшифровки: {e}")
        return encrypted_message

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')

@app.route('/main', methods=['GET', 'POST'])
def main():
    return render_template('main.html',)

@app.route('/sending', methods=['POST'])
def send():
    try:
        chat_id = request.form.get('chat_id')
        message_text = request.form.get('msg')
        usersend = request.form.get('user')

        if not chat_id or not message_text:
            return '<script>alert("Не указан ID чата или сообщение"); window.location = "/main";</script>'

        save_message(chat_id, message_text, usersend)

        return f'<script>localStorage.setItem("currentChatId", "{chat_id}");window.location = "/main";</script>'
    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")
        import traceback
        print(f"Полный трейсбэк: {traceback.format_exc()}")
        return f'<script>alert("Ошибка при сохранении: {str(e)}");window.location = "/main";</script>'

@app.route('/api/send_message', methods=['POST'])
def api_send_message():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Нет данных'})
    
        chat_id = data.get('chat_id')
        message_text = data.get('text')
        user_id = data.get('user_id')
        
        if not chat_id or not message_text or not user_id:
            return jsonify({'success': False, 'error': 'Не указан ID чата, сообщение или ID пользователя'})
        try:
            with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                data_json = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({'success': False, 'error': 'Ошибка чтения файла данных'})

        user_name = None
        for account_key, account_data in data_json.get("accounts", {}).items():
            if account_data.get("ID") == user_id:
                user_name = account_data.get("Name")
                break
        if not user_name:
            return jsonify({'success': False, 'error': 'Пользователь не найден'})
        message_id = save_message(chat_id, message_text, user_name)

        return jsonify({
            'success': True, 
            'message_id': message_id,
            'sender': user_name,
            'text': message_text, 
            'timestamp': int(time.time())
        })
    except Exception as e:
        print(f"Ошибка при отправке сообщения: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})
@app.route('/api/get_messages/<chat_id>', methods=['GET'])
def api_get_messages(chat_id):
    try:
        try:
            with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({'success': False, 'error': 'Файл данных не найден'})
        
        chat = data.get("Chats", {}).get(chat_id)
        if not chat:
            return jsonify({'success': False, 'error': 'Чат не найден'})
        
        messages = []
        msgs = chat.get("Msgs", {})
        
        for msg_id, msg_data in msgs.items():
            # Расшифровываем текст сообщения
            encrypted_text = msg_data.get("text", "")
            if encrypted_text:
                decrypted_text = decrypt_message(encrypted_text)
            else:
                decrypted_text = msg_data.get("text", "")
            
            messages.append({
                'id': msg_id,
                'sender': msg_data.get('sender', 'Неизвестно'),
                'text': decrypted_text,
                'timestamp': msg_data.get('timestamp', 0)
            })
        messages.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'messages': messages
        })
        
    except Exception as e:
        print(f"Ошибка при получении сообщений: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/create_chat', methods=['POST'])
def create_chat():
    try:
        data = request.json
        chat_id = data.get('chat_id')
        chat_name = data.get('chat_name')
        users = data.get('users', [])

        if not chat_id or not chat_name:
            return jsonify({'success': False, 'error': 'Не указан ID чата или название'})

        if not users:
            return jsonify({'success': False, 'error': 'Не выбраны участники чата'})

        try:
            with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {"accounts": {}, "Chats": {}}
        data["Chats"][chat_id] = {
            "ID": chat_id,
            "ChatName": chat_name,
            "PeoplesNames": users,
            "Msgs": {
                f"msg_{int(time.time())}_system": {
                    "sender": "Система",
                    "text": f"Чат '{chat_name}' создан. Все сообщения этого чата шифруются и даже разработчик не может посмотреть ваши сообщения",
                    "timestamp": int(time.time())
                }
            }
        }
        for user_id in users:
            for account_key, account_data in data["accounts"].items():
                if account_data["ID"] == user_id:
                    if "AvaliableChatsID" not in account_data:
                        account_data["AvaliableChatsID"] = []
                    if chat_id not in account_data["AvaliableChatsID"]:
                        account_data["AvaliableChatsID"].append(chat_id)
                    break

        # Сохраняем обновленные данные
        with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'chat_id': chat_id})
    except Exception as e:
        print(f"Ошибка при создании чата: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/create_user', methods=['POST'])
def create_user():
    try:
        # Пытаемся получить данные из JSON
        if request.is_json:
            data = request.json
        else:
            # Если не JSON, берём из формы
            data = {
                'tel': request.form.get('tel'),
                'name': request.form.get('name'),
                'family': request.form.get('family'),
                'login': request.form.get('login'),
                'password': request.form.get('password')
            }
        
        tel = data.get('tel')
        name = data.get('name')
        family = data.get('family')
        login = data.get("login")
        password = data.get('password')
        
        # Проверка обязательных полей
        if not all([tel, name, family, login, password]):
            return jsonify({'success': False, 'error': 'Все поля обязательны'}), 400
        
        # Загрузка данных
        try:
            with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            json_data = {"accounts": {}, "Chats": {}}
        
        # Создание пользователя
        json_data["accounts"][login] = {
            "ID": tel,
            "Name": f"{name} {family}",
            "Pass": password,
            "Login": login,
            "Role": "User",
            "AvaliableChatsID": ["854157"]
        }
        
        # Сохранение
        with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        # Возвращаем JSON, а не HTML
        return jsonify({'success': True, 'message': 'Пользователь создан'})
        
    except Exception as e:
        print(f"Ошибка при создании пользователя: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
def save_message(chat_id, message_text, sender_name):
    if not JSON_FILE_PATH:
        raise Exception("Не указан путь к JSON файлу")

    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        data = {
            "accounts": {},
            "Chats": {}
        }

    if "Chats" not in data:
        data["Chats"] = {}

    if chat_id not in data["Chats"]:
        data["Chats"][chat_id] = {
            "ID": chat_id,
            "PeoplesNames": [],
            "ChatName": f"Чат {chat_id}",
            "Msgs": {}
        }

    # Создаем уникальный ID для сообщения
    message_id = f"msg_{int(time.time())}_{random.randint(1000, 9999)}"

    # Шифруем текст сообщения
    encrypted_text = encrypt_message(message_text)

    # Сохраняем зашифрованное сообщение
    data["Chats"][chat_id]["Msgs"][message_id] = {
        "sender": sender_name,
        "text": encrypted_text,  # Сохраняем зашифрованный текст
        "timestamp": int(time.time())
    }

    try:
        with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise Exception(f"Ошибка при записи файла: {str(e)}")
    
    return message_id

@app.route('/api/get_chats', methods=['GET'])
def api_get_chats():
    """Получение списка чатов пользователя"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'Не указан ID пользователя'})

        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        user_chats = []
        accounts = data.get("accounts", {})
        
        # Находим пользователя и его чаты
        for account_key, account_data in accounts.items():
            if account_data.get("ID") == user_id:
                available_chats = account_data.get("AvaliableChatsID", [])
                
                for chat_id in available_chats:
                    chat = data.get("Chats", {}).get(chat_id)
                    if chat:
                        user_chats.append({
                            'id': chat_id,
                            'name': chat.get("ChatName", f"Чат {chat_id}"),
                            'last_message_time': get_last_message_time(chat)
                        })
                break
        
        # Сортируем по времени последнего сообщения
        user_chats.sort(key=lambda x: x['last_message_time'], reverse=True)
        
        return jsonify({'success': True, 'chats': user_chats})
        
    except Exception as e:
        print(f"Ошибка при получении чатов: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

def get_last_message_time(chat):
    """Получает время последнего сообщения в чате"""
    msgs = chat.get("Msgs", {})
    if not msgs:
        return 0
    
    timestamps = [msg.get("timestamp", 0) for msg in msgs.values()]
    return max(timestamps) if timestamps else 0

if __name__ == "__main__":
    print("ChatApp с шифрованием сообщений")
    print(f"Ключ шифрования: {'присутствует' if cipher_suite else 'отсутствует'}")
    app.run(host='0.0.0.0', port=5000, debug=True)