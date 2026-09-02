chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "startImport" && request.token) {
    const token = request.token;
    const rows = document.querySelectorAll('tr');
    
    let promises = [];
    let eventsFound = 0;

    rows.forEach((row) => {
      const startSpan = row.querySelector('.start');
      const endSpan = row.querySelector('.end');
      
      if (!startSpan || !endSpan) return; 
      
      const startTimeStr = startSpan.textContent.trim();
      const endTimeStr = endSpan.textContent.trim();
      const cells = row.querySelectorAll('td');
      
      cells.forEach((cell) => {
        const popover = cell.querySelector('div[data-toggle="popover"]');
        if (!popover) return;

        const originalTitle = popover.getAttribute('data-original-title');
        if (!originalTitle) return;

        const dateMatch = originalTitle.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!dateMatch) return;
        
        const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`; 
        
        let contentHtml = popover.getAttribute('data-content') || "";
        contentHtml = contentHtml.replace(/&lt;br\s*\/?[;&gt;>]/gi, '\n')
                                 .replace(/<br\s*\/?>/gi, '\n');
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        const cleanText = tempDiv.textContent; 
        
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length >= 2) {
            eventsFound++; // Рахуємо одразу знайдене заняття
            
            // Додаємо асинхронну операцію в масив обіцянок
            const promise = (async () => {
                const subject = lines[0]; 
                const baseLocation = lines[1]; 
                let extraInfo = lines.slice(2).filter(line => !line.startsWith('Додано:')).join('\n');
                let finalLocation = baseLocation; 
                
                const r1 = popover.parentElement.querySelector('a.btn-show-ads')?.getAttribute('data-r1');
                const r2 = popover.parentElement.querySelector('a.btn-show-ads')?.getAttribute('data-r2');
                
                if (r1 && r2) {
                    try {
                        const announcementText = await fetchAnnouncementDetails(r1, r2);
                        if (announcementText) {
                            extraInfo += `\n\n--- Оголошення ---\n` + announcementText;
                            const meetMatch = announcementText.match(/https:\/\/meet\.google\.com\/[a-z-]+/);
                            if (meetMatch) {
                                finalLocation = meetMatch[0];
                            }
                        }
                    } catch (e) {
                        console.error("Не вдалося завантажити оголошення для", r2, e);
                    }
                }
                
                const event = {
                  'summary': subject,
                  'location': finalLocation,
                  'description': extraInfo,
                  'start': {
                    'dateTime': `${isoDate}T${startTimeStr}:00`,
                    'timeZone': 'Europe/Kyiv'
                  },
                  'end': {
                    'dateTime': `${isoDate}T${endTimeStr}:00`,
                    'timeZone': 'Europe/Kyiv'
                  }
                };
                
                await sendEventToCalendar(event, token);
            })();
            
            promises.push(promise);
        }
      });
    });

    // Чекаємо, доки абсолютно всі запити оголошень та відправки в календар завершаться
    Promise.all(promises).then(() => {
        sendResponse({ status: `Успішно опрацьовано та додано: ${eventsFound} занять.` });
    });
  }
  return true; // Обов'язково для асинхронної відповіді в Chrome extension
});

async function fetchAnnouncementDetails(r1, r2) {
  try {
    const response = await fetch(`https://asu.knu.edu.ua/time-table/show-ads?r1=${r1}&r2=${r2}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) return null;
    const jsonData = await response.json();
    
    if (jsonData && jsonData.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(jsonData.html, 'text/html');
        return doc.body.innerText.trim();
    }
  } catch (err) {
    console.log("Помилка при запиті оголошення:", err);
  }
  return null;
}

function sendEventToCalendar(eventData, token) {
  return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  })
  .then(response => response.json())
  .then(data => {
    console.log("[Успіх] Додано:", data.summary, data.start.dateTime);
  })
  .catch((error) => {
    console.error('[Помилка] при додаванні:', error);
  });
}