import Core from './lib/core'
import UI from './lib/ui'
import Downloader from './lib/downloader'
import Secret from './lib/secret'

class Home extends Downloader {
  constructor () {
    const search = {
      aid: 1,
      limit: 1000,
      show_dir: 1,
      cid: ''
    }
    const listParameter = {
      search,
      url: `${location.protocol}//webapi.115.com/files?`,
      options: {
        credentials: 'include',
        method: 'GET'
      }
    }
    super(listParameter)
    this.mode = 'RPC'
    this.rpcURL = 'http://localhost:6800/jsonrpc'
    this.iframe = document.querySelector('iframe[rel="wangpan"]')
  }

  initialize () {
    this.context = document.querySelector('iframe[rel="wangpan"]').contentDocument
    UI.init()
    UI.addMenu(this.context.querySelector('#js_top_panel_box'), 'afterbegin')
    this.context.querySelector('.right-tvf').style.display = 'block'
    this.addMenuButtonEventListener()
    UI.addContextMenuRPCSectionWithCallback(() => {
      this.addContextMenuEventListener()
    })
    Core.showToast('初始化成功!', 'inf')
    return this
  }

  startListen () {
    const exportFiles = (files) => {
      files.forEach((item) => {
        if (item.isdir) {
          this.addFolder(item)
        } else {
          this.addFile(item)
        }
      })
      this.start(Core.getConfigData('interval'), (fileDownloadInfo) => {
        if (this.mode === 'RPC') {
          Core.aria2RPCMode(this.rpcURL, fileDownloadInfo)
        }
        if (this.mode === 'TXT') {
          Core.aria2TXTMode(fileDownloadInfo)
          document.querySelector('#textMenu').classList.add('open-o')
        }
        if (this.mode === 'OPEN') {
          for (const f of fileDownloadInfo) {
            window.open('https://115.com/?ct=play&ac=location&pickcode=' + f.pickcode)
          }
        }
      })
    }

    window.addEventListener('message', (event) => {
      const type = event.data.type
      if (!type) {
        return
      }
      if (type === 'selected' || type === 'hovered') {
        this.reset()
        const selectedFile = event.data.data
        if (selectedFile.length === 0) {
          Core.showToast('请选择一下你要保存的文件哦', 'war')
          return
        }
        exportFiles(selectedFile)
      }
    })
    this.iframe.addEventListener('load', () => {
      this.initialize()
      window.postMessage({ type: 'refresh' }, location.origin)
    })
  }

  addMenuButtonEventListener () {
    const menuButton = this.context.querySelector('#aria2List')
    menuButton.addEventListener('click', (event) => {
      const rpcURL = event.target.dataset.url
      if (rpcURL) {
        this.rpcURL = rpcURL
        this.getSelected()
        this.mode = 'RPC'
      }
      if (event.target.id === 'aria2Text') {
        this.getSelected()
        this.mode = 'TXT'
      }
      if (event.target.id === 'batchOpen') {
        this.getSelected()
        this.mode = 'OPEN'
      }
    })
  }

  addContextMenuEventListener () {
    const section = this.context.querySelector('#more-menu-rpc-section')
    section.addEventListener('click', (event) => {
      const rpcURL = event.target.dataset.url
      if (rpcURL) {
        this.rpcURL = rpcURL
        this.getHovered()
        this.mode = 'RPC'
      }
    })
  }

  getSelected () {
    window.postMessage({ type: 'getSelected' }, location.origin)
  }

  getHovered () {
    window.postMessage({ type: 'getHovered' }, location.origin)
  }

  getFile (pickcode) {
    const vip = Core.getConfigData('vip')
    if (vip) {
      return this.getFileFromProAPI(pickcode)
    } else {
      return this.getFileFromWebAPI(pickcode)
    }
  }

  getFileFromWebAPI (pickcode) {
    const options = {
      credentials: 'include',
      method: 'GET'
    }
    return new Promise((resolve) => {
      Core.sendToBackground('fetch', {
        url: `${location.protocol}//webapi.115.com/files/download?pickcode=${pickcode}`,
        options
      }, (data) => {
        if (data.file_url) {
          const path = data.file_url.match(/.*115.com(\/.*\/)/)[1]
          Core.requestCookies([{ path }]).then((cookies) => {
            data.cookies = cookies
            resolve(data)
          })
        } else {
          Core.showToast('无法获取下载地址!', 'err')
          resolve(pickcode)
        }
      })
    })
  }

  getFileFromProAPI (pickcode) {
    const now = Date.now()
    const timestamp = Math.floor(now / 1000)
    const { data, key } = Secret.encode(JSON.stringify({
      pickcode
    }), timestamp)
    const options = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include',
      method: 'POST',
      body: `data=${encodeURIComponent(data)}`
    }
    return new Promise((resolve) => {
      Core.sendToBackground('fetch', {
        url: `https://proapi.115.com/app/chrome/downurl?t=${timestamp}`,
        options
      }, (json) => {
        if (json.state) {
          const result = JSON.parse(Secret.decode(json.data, key))
          const data = Object.values(result).pop()
          data.pickcode = data.pick_code
          data.file_url = data.url.url
          if (data.file_url) {
            Core.requestCookies([{ url: 'https://proapi.115.com/', name: 'acw_tc' }]).then((cookies) => {
              data.cookies = cookies
              resolve(data)
            })
          } else {
            Core.showToast('无法获取下载地址!', 'err')
            resolve(pickcode)
          }
        } else {
          resolve(pickcode)
        }
      })
    })
  }

  async getFiles (files) {
    for (const pickcode in files) {
      await this.sleep(Core.getConfigData('interval'))
      const file = await this.getFile(pickcode)
      if (this.isObject(file)) {
        this.fileDownloadInfo.push({
          name: files[file.pickcode].path + file.file_name,
          link: file.file_url,
          size: file.file_size,
          sha1: files[file.pickcode].sha1,
          cookies: file.cookies,
          pickcode: file.pickcode
        })
      } else {
        console.log(files[file])
      }
    }
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  isObject (obj) {
    return obj !== null && typeof obj === 'object'
  }
}

const home = new Home()

home.initialize().startListen()
