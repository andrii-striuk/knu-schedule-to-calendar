document.getElementById('parseBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.innerText = 'Авторизація...';

  // 1. Отримуємо токен OAuth2 для Google Calendar
  chrome.identity.getAuthToken({ interactive: true }, function(token) {
    if (chrome.runtime.lastError || !token) {
      statusDiv.innerText = 'Помилка авторизації: ' + chrome.runtime.lastError.message;
      return;
    }

    statusDiv.innerText = 'Збір даних зі сторінки...';

    // 2. Визначаємо активну вкладку
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const activeTab = tabs[0];
      
      // 3. Запускаємо content.js на сторінці, передаючи йому токен
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, () => {
        // Відправляємо токен всередину сторінки
        chrome.tabs.sendMessage(activeTab.id, { action: "startImport", token: token }, function(response) {
            if(response && response.status) {
                statusDiv.innerText = response.status;
            }
        });
      });
    });
  });
});