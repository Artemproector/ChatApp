let win = document.querySelector('.window');
async function getJsonValue(path = '') {
    try {
        const response = await fetch('static/data/memory.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!path) return data;
        const value = path.split('.').reduce((obj, key) => obj?.[key], data);
        return value !== undefined ? value : 'error(VNF)';
    } catch (error) {
        return 'error(FNF)';
    }
}

let form_log = document.querySelector('.form_log');
form_log.addEventListener('submit', async function (e) {
    e.preventDefault();
    let pass = document.querySelector('#pass').value;
    let login = document.querySelector('#login').value;
    let found = false; // Флаг, что пользователь найден

    try {
        let accounts = await getJsonValue('accounts');

        // Проверяем каждый аккаунт
        for (let [key, value] of Object.entries(accounts)) {
            if (key === login && value.Pass === pass) {
                localStorage.setItem('userID', value.ID);
                localStorage.setItem('userName', value.Name);
                localStorage.setItem('userLogin', key);
                window.location = '/main';
                found = true;
                break;
            }
        }

        if (!found) {
            // Пользователь не найден или пароль неверный
            console.warn("LOGIN FAIL");
            win.style.animation = 'err 1s';
            setTimeout(function () {
                win.style.animation = 'none';
            }, 1000);
        }
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        alert('Ошибка при входе в систему');
    }
});
function login() {
    win.innerHTML = `<h1>Войдите в ChatApp</h1>
        <form class="form_log" action="#">
            <input type="text" name="login" id="login" class="login" placeholder="Логин" autocomplete="username">
            <input type="password" name="pass" id="pass" class="pass" placeholder="Пароль" autocomplete="name">
            <button type="submit">Войти</button>
            <a href="#" onclick="createAcc()">Создать аккаунт</a>
        </form>`
}
function createAcc() {
    win.innerHTML = `<h1>Создайте аккаунт в ChatApp</h1>
        <form class="form_create" onsubmit="submitRegistration(event)">
            <input type="tel" name="tel" id="tel" class="login" placeholder="Номер телефона(без +7)" autocomplete="tel">
            <input type="text" name="name" id="name" class="login" placeholder="Ваше имя" autocomplete="name">
            <input type="text" name="family" id="family" class="login" placeholder="Ваша фамилия" autocomplete="family-name">
            <input type="text" name="login" id="login" class="login" placeholder="Имя пользователя (@)" autocomplete="nickname">
            <input type="password" name="password" id="password" class="pass1" placeholder="Пароль" autocomplete="new-password">
            <input type="password" name="pass" id="pass" class="pass2" placeholder="Повторите пароль" autocomplete="new-password">
            <button type="submit">Создать аккаунт</button>
            <a href="#" onclick="login()">Войти</a>
        </form>`;
}

// Добавьте эту функцию
async function submitRegistration(event) {
    event.preventDefault();

    // Получаем значения полей
    let tel = document.getElementById('tel').value;
    let name = document.getElementById('name').value;
    let family = document.getElementById('family').value;
    let login = document.getElementById('login').value;
    let password = document.getElementById('password').value;
    let passConfirm = document.getElementById('pass').value;

    // Проверка совпадения паролей
    if (password !== passConfirm) {
        alert('Пароли не совпадают!');
        return;
    }

    // Проверка заполнения всех полей
    if (!tel || !name || !family || !login || !password) {
        alert('Заполните все поля!');
        return;
    }

    try {
        const response = await fetch('/api/create_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tel: tel,
                name: name,
                family: family,
                login: login,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            // Успешная регистрация
            alert('Аккаунт успешно создан!');
            location.reload()
        } else {
            alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        alert('Ошибка соединения с сервером');
    }
}