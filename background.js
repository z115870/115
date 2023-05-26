const httpSend = ({ url, options }, resolve, reject) => {
  fetch(url, options).then((response) => {
    if (response.ok) {
      response.json().then((data) => {
        resolve(data)
      })
    } else {
      reject(response)
    }
  }).catch((err) => {
    reject(err)
  })
}
// https://developer.chrome.com/apps/runtime#event-onMessage
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.method) {
    case 'addScript':
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: [request.data]
      })
      break
    case 'rpcData':
      httpSend(request.data, () => {
        sendResponse(true)
      }, (err) => {
        console.log(err)
        sendResponse(false)
      })
      return true
    case 'configData':
      for (const key in request.data) {
        localStorage.setItem(key, request.data[key])
      }
      break
    case 'rpcVersion':
      httpSend(request.data, (data) => {
        sendResponse(data.result.version)
      }, (err) => {
        console.log(err)
        sendResponse(false)
      })
      return true
    case 'fetch':
      httpSend(request.data, (data) => {
        sendResponse(data)
      }, (err) => {
        console.log(err)
        sendResponse(err)
      })
      return true
    case 'getCookies':
      getCookies(request.data).then(value => sendResponse(value))
      return true
  }
})

// Promise style `chrome.cookies.get()`
const getCookie = (detail) => {
  return new Promise(function (resolve) {
    chrome.cookies.getAll(detail, resolve)
  })
}

const getCookies = (details) => {
  return new Promise(function (resolve) {
    const list = details.map(item => getCookie(item))
    Promise.all(list).then(function (cookies) {
      const obj = {}
      for (const cookie of cookies) {
        for (const item of cookie) {
          if (item !== null) {
            obj[item.name] = item.value
          }
        }
      }
      resolve(obj)
    })
  })
}

const showNotification = (id, opt) => {
  chrome.notifications.create(id, opt, () => {})
  setTimeout(() => {
    chrome.notifications.clear(id, () => {})
  }, 5000)
}
// 软件版本更新提示
(async () => {
  const manifest = chrome.runtime.getManifest()
  const { version: previousVersion } = await chrome.storage.local.get('version')
  if (previousVersion === '' || previousVersion !== manifest.version) {
    const opt = {
      type: 'basic',
      title: '更新',
      message: '115助手更新到' + manifest.version + '版本啦～\n此次更新修复导出下载~',
      iconUrl: 'img/icon.jpg'
    }
    const id = new Date().getTime().toString()
    showNotification(id, opt)
    await chrome.storage.local.set({
      version: manifest.version
    })
  }
})()
