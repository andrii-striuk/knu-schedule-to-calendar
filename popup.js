document.getElementById('parseBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');

  // 1. Визначаємо активну вкладку перед початком будь-яких дій
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs[0];

    // 2. Перевіряємо URL на наявність потрібних фрагментів
    if (!activeTab || !activeTab.url || !activeTab.url.includes('asu.knu.edu.ua') || !activeTab.url.includes('time-table')) {
      statusDiv.innerText = 'Помилка: Відкрийте сторінку розкладу на сайті АСУ ЗВО (https://asu.knu.edu.ua/).';
      return; // Зупиняємо виконання скрипта
    }

    statusDiv.innerText = 'Авторизація...';

    // 3. Запитуємо токен лише якщо вкладка правильна
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError || !token) {
        statusDiv.innerText = 'Помилка авторизації: ' + chrome.runtime.lastError.message;
        return;
      }

      statusDiv.innerText = 'Збір даних зі сторінки...';

      // 4. Запускаємо парсер на сторінці
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, () => {
        // Відправляємо повідомлення і перевіряємо, чи повернув content.js відповідь
        chrome.tabs.sendMessage(activeTab.id, { action: "startImport", token: token }, function(response) {
            // Перевірка на випадок, якщо content.js не зміг виконатися
            if (chrome.runtime.lastError) {
                statusDiv.innerText = 'Помилка: Перезавантажте сторінку розкладу (F5) та спробуйте ще раз.';
            } else if (response && response.status) {
                statusDiv.innerText = response.status;
            } else {
                // Відповідь не надійшла, отже таблиці на сторінці немає
                statusDiv.innerText = 'Помилка: Не знайдено таблицю з розкладом.';
            }
        });
      });
    });
  });
});